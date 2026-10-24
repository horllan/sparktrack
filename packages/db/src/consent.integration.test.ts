import { createHmac, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import * as dotenv from 'dotenv';
import { afterAll, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { createKyselyClient } from './connection.js';
import { consentQueries, onboardingQueries } from './queries.js';

dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createKyselyClient(databaseUrl) : null;

function hash(challengeId: string, code: string) {
  return createHmac('sha256', 'test-only-consent-secret-which-is-32-bytes')
    .update(`${challengeId}:${code}`)
    .digest('hex');
}

describe('parental consent persistence', () => {
  afterAll(async () => {
    await db?.destroy();
  });

  it.skipIf(!db)(
    'onboards a learner and activates consent once the guardian verifies the SMS code',
    async () => {
      const learnerId = randomUUID();
      const challengeId = randomUUID();
      let guardianId: string | undefined;

      try {
        const onboarding = await onboardingQueries.onboard(db!, learnerId, {
          fullName: 'Consent Integration Learner',
          dateOfBirth: '2012-05-10',
          educationStage: 'JSS2',
          declaredInterests: ['Coding'],
          guardian: { fullName: 'Consent Integration Guardian', phoneNumber: '+2348012345678' },
        });
        expect(onboarding.status).toBe('created');
        if (onboarding.status !== 'created') return;
        guardianId = onboarding.guardianId;

        const created = await consentQueries.createChallenge(db!, {
          id: challengeId,
          learnerId,
          guardianId,
          otpHmac: hash(challengeId, '012345'),
          expiresAt: new Date(Date.now() + 10 * 60_000),
        });
        expect(created).toBe(challengeId);

        const incorrect = await consentQueries.verify(db!, {
          challengeId,
          otpHmac: hash(challengeId, '999999'),
          consentGiven: true,
          allowPublicPortfolio: false,
          allowPartnerTalentDiscovery: false,
        });
        expect(incorrect.status).toBe('invalid');

        const verified = await consentQueries.verify(db!, {
          challengeId,
          otpHmac: hash(challengeId, '012345'),
          consentGiven: true,
          allowPublicPortfolio: true,
          allowPartnerTalentDiscovery: false,
        });
        expect(verified.status).toBe('verified');
        expect(await consentQueries.recipient(db!, learnerId)).toMatchObject({ consent_status: 'VERIFIED_ACTIVE' });

        const audit = await sql<{ allow_public_portfolio: boolean; allow_partner_talent_discovery: boolean }>`
          SELECT allow_public_portfolio, allow_partner_talent_discovery
          FROM evidence.parental_consent_audit WHERE challenge_id = ${challengeId}::uuid
        `.execute(db!);
        expect(audit.rows).toEqual([{ allow_public_portfolio: true, allow_partner_talent_discovery: false }]);

        const replay = await consentQueries.verify(db!, {
          challengeId,
          otpHmac: hash(challengeId, '012345'),
          consentGiven: true,
          allowPublicPortfolio: false,
          allowPartnerTalentDiscovery: true,
        });
        expect(replay.status).toBe('already_verified');
        expect(await consentQueries.recipient(db!, learnerId)).toMatchObject({ consent_status: 'VERIFIED_ACTIVE' });
      } finally {
        await sql`DELETE FROM evidence.parental_consent_audit WHERE challenge_id = ${challengeId}::uuid`.execute(db!);
        await sql`DELETE FROM evidence.parental_consent_challenges WHERE id = ${challengeId}::uuid`.execute(db!);
        await sql`DELETE FROM core.learner_profiles WHERE learner_id = ${learnerId}::uuid`.execute(db!);
        if (guardianId) await sql`DELETE FROM core.users WHERE id = ${guardianId}::uuid`.execute(db!);
        await sql`DELETE FROM core.users WHERE id = ${learnerId}::uuid`.execute(db!);
      }
    },
    30_000,
  );
});
