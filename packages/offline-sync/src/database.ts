import Dexie, { type Table } from 'dexie';
import type { EvidenceSyncPayload, MentorMicroRubric } from '@sparktrack/contracts';

export type SyncState = 'pending' | 'syncing' | 'synced' | 'failed';

interface QueueMeta {
  localId?: number;
  syncStatus: SyncState;
  retryCount: number;
  nextAttemptAt: number; // epoch ms (exponential backoff)
  lastError?: string;
  queuedAt: string;
}
export type PendingArtifact = EvidenceSyncPayload & QueueMeta;
export type PendingRubric = MentorMicroRubric & QueueMeta;

/** Everything is written here FIRST (offline-first), then synced idempotently via clientSyncId. */
export class SparkTrackOfflineDB extends Dexie {
  pendingArtifacts!: Table<PendingArtifact, number>;
  pendingRubrics!: Table<PendingRubric, number>;

  constructor(name = 'SparkTrackOffline') {
    super(name);
    this.version(1).stores({
      pendingArtifacts: '++localId, &clientSyncId, learnerId, syncStatus, nextAttemptAt',
      pendingRubrics: '++localId, &clientSyncId, mentorId, syncStatus, nextAttemptAt',
    });
  }
}

export const db = new SparkTrackOfflineDB();

