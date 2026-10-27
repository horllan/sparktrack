import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { createKyselyClient } from './connection.js';
import { ledgerQueries, onboardingQueries } from './queries.js';

const databaseUrl = process.env.SPARKTRACK_TEST_DATABASE_URL;
if (databaseUrl && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('SPARKTRACK_TEST_DATABASE_URL must target a local disposable database.');
}
const db = databaseUrl ? createKyselyClient(databaseUrl) : null;

describe('cryptographic ledger immutability', () => {
  afterAll(async () => {
    await db?.destroy();
  });

  it.skipIf(!db)(
    'seals artifacts into the SHA-256 hash chain and rejects UPDATE and DELETE',
    async () => {
      const learnerId = randomUUID();
      const clientSyncId = randomUUID();

      await onboardingQueries.onboard(db!, learnerId, {
        fullName: 'Ledger Test Learner',
        dateOfBirth: '2013-02-14',
        educationStage: 'JSS3',
        declaredInterests: ['Graphic Design'],
        guardian: { fullName: 'Ledger Test Guardian', phoneNumber: '+2348099999999' },
      });

      const sealed = await ledgerQueries.syncAndSeal(db!, {
        clientSyncId,
        learnerId,
        artifactType: 'PROJECT_SUBMISSION',
        title: 'Immutable Ledger Verification Artifact',
        storageR2Keys: [],
        externalUrls: [],
        payload: { schema_version: '1.0', skill_codes: ['SKILL_PYTHON_PROG'] },
        complexityWeight: 1.0,
        capturedOfflineAt: new Date(),
      });

      expect(sealed.alreadySynced).toBe(false);
      if (sealed.alreadySynced) return;
      expect(sealed.rowSignatureHash).toMatch(/^[0-9a-f]{64}$/);

      await Promise.all([
        expect(
          sql`UPDATE evidence.cryptographic_ledger SET payload_canonical_hash = 'tampered' WHERE artifact_id = ${sealed.artifactId}::uuid`.execute(db!),
        ).rejects.toThrow(/SparkTrack Security Violation/i),
        expect(
          sql`DELETE FROM evidence.cryptographic_ledger WHERE artifact_id = ${sealed.artifactId}::uuid`.execute(db!),
        ).rejects.toThrow(/SparkTrack Security Violation/i),
      ]);

      const chain = await ledgerQueries.verifyChain(db!);
      expect(chain.every((entry) => entry.isValid)).toBe(true);
    },
    30_000,
  );
});
