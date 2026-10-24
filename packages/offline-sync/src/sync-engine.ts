import type { SparkTrackOfflineDB, PendingArtifact, PendingRubric } from './database';
import { db as defaultDb } from './database';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingArtifacts: number;
  pendingRubrics: number;
  totalPending: number;
}

export interface SyncEngineOptions {
  apiBaseUrl: string;
  /** Returns the current Supabase access token (refreshing if needed). */
  getAccessToken: () => Promise<string | null>;
  db?: SparkTrackOfflineDB;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
}

type QueueInput<T> = Omit<T, 'localId' | 'syncStatus' | 'retryCount' | 'nextAttemptAt' | 'queuedAt' | 'lastError'>;

/**
 * Background sync with exponential backoff. 4xx (except 408/429) are permanent failures — retrying would
 * never succeed — so they are marked failed with no further attempts. Safe to call concurrently (single flight).
 */
export class SyncEngine {
  private inFlight: Promise<void> | null = null;
  private readonly db: SparkTrackOfflineDB;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;

  constructor(private readonly opts: SyncEngineOptions) {
    this.db = opts.db ?? defaultDb;
    this.fetchImpl = opts.fetchImpl ?? ((...a) => fetch(...a));
    this.maxRetries = opts.maxRetries ?? 6;
  }

  async queueArtifact(a: QueueInput<PendingArtifact>) {
    await this.db.pendingArtifacts.add({ ...a, syncStatus: 'pending', retryCount: 0, nextAttemptAt: 0, queuedAt: new Date().toISOString() } as PendingArtifact);
  }
  async queueRubric(r: QueueInput<PendingRubric>) {
    await this.db.pendingRubrics.add({ ...r, syncStatus: 'pending', retryCount: 0, nextAttemptAt: 0, queuedAt: new Date().toISOString() } as PendingRubric);
  }

  async getStatus(): Promise<SyncStatus> {
    const open = ['pending', 'failed', 'syncing'];
    const [pa, pr] = await Promise.all([
      this.db.pendingArtifacts.where('syncStatus').anyOf(open).count(),
      this.db.pendingRubrics.where('syncStatus').anyOf(open).count(),
    ]);
    return { isOnline: typeof navigator === 'undefined' ? true : navigator.onLine, isSyncing: this.inFlight !== null,
      pendingArtifacts: pa, pendingRubrics: pr, totalPending: pa + pr };
  }

  syncAll(): Promise<void> {
    this.inFlight ??= this.run().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async run() {
    await this.drain(this.db.pendingArtifacts as never, '/api/v1/evidence/sync');
    await this.drain(this.db.pendingRubrics as never, '/api/v1/evidence/mentor-rubric');
  }

  private async drain(table: PendingTable, path: string) {
    const token = await this.opts.getAccessToken();
    if (!token) return;
    const now = Date.now();
    // 'syncing' rows left over from a crashed tab are retried too.
    const rows = (await table.where('syncStatus').anyOf('pending', 'failed', 'syncing').toArray())
      .filter((r) => r.nextAttemptAt <= now && r.retryCount < this.maxRetries);
    for (const row of rows) {
      await table.update(row.localId!, { syncStatus: 'syncing' });
      try {
        const { localId: _l, syncStatus: _s, retryCount: _r, nextAttemptAt: _n, lastError: _e, queuedAt: _q, ...body } = row;
        const res = await this.fetchImpl(`${this.opts.apiBaseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (res.ok) { await table.update(row.localId!, { syncStatus: 'synced', lastError: undefined }); continue; }
        const permanent = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
        await this.fail(table, row, `HTTP ${res.status}`, permanent);
      } catch (err) {
        await this.fail(table, row, err instanceof Error ? err.message : 'network error', false);
      }
    }
  }

  private async fail(table: PendingTable, row: QueueMetaRow, message: string, permanent: boolean) {
    const retryCount = permanent ? this.maxRetries : row.retryCount + 1;
    const backoff = Math.min(60 * 60_000, 2 ** retryCount * 5_000) + Math.random() * 1_000;
    await table.update(row.localId!, { syncStatus: 'failed', retryCount, lastError: message, nextAttemptAt: Date.now() + backoff });
  }
}

interface QueueMetaRow { localId?: number; syncStatus: string; retryCount: number; nextAttemptAt: number; lastError?: string; queuedAt: string }
interface PendingTable {
  where(k: string): { anyOf(...v: string[]): { toArray(): Promise<Array<QueueMetaRow & Record<string, unknown>>> } };
  update(id: number, changes: Partial<QueueMetaRow>): Promise<unknown>;
}

