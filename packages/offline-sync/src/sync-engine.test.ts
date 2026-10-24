import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { SparkTrackOfflineDB } from './database';
import { SyncEngine } from './sync-engine';

describe('SyncEngine offline-first queue', () => {
  it('queues artifacts locally in IndexedDB and marks synced on 200', async () => {
    const testDb = new SparkTrackOfflineDB(`test-${Date.now()}`);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const engine = new SyncEngine({
      apiBaseUrl: 'http://localhost:4000',
      getAccessToken: async () => 'test-jwt',
      db: testDb,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await engine.queueArtifact({
      clientSyncId: '11111111-1111-4111-8111-111111111111',
      learnerId: '22222222-2222-4222-8222-222222222222',
      artifactType: 'PROJECT_SUBMISSION',
      title: 'Python sensor script',
      storageR2Keys: [],
      externalUrls: [],
      payload: { schema_version: '1.0', skill_codes: ['SKILL_PYTHON_PROG'] },
      complexityWeight: 1.0,
      capturedOfflineAt: new Date().toISOString(),
    });

    expect((await engine.getStatus()).pendingArtifacts).toBe(1);
    await engine.syncAll();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await engine.getStatus()).pendingArtifacts).toBe(0);
  });
});

