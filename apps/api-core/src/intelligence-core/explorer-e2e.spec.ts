import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { sql } from 'kysely';
import { createKyselyClient, ledgerQueries, onboardingQueries, rubricQueries } from '@sparktrack/db';
import { CapabilityGraphService } from './capability-graph/capability-graph.service';
import { SkillEngineService } from './skill-engine/skill-engine.service';
import { ProgressEngineService } from './progress-engine/progress-engine.service';
import { PathwayEngineService } from './pathway-engine/pathway-engine.service';
import { RecommendationEngineService } from './recommendation-engine/recommendation-engine.service';

const databaseUrl = process.env.SPARKTRACK_TEST_DATABASE_URL;
if (databaseUrl) {
  const hostname = new URL(databaseUrl).hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) {
    throw new Error('SPARKTRACK_TEST_DATABASE_URL must target a local disposable database.');
  }
}

const db = databaseUrl ? createKyselyClient(databaseUrl) : null;

describe('Section 37: 13-Year-Old Explorer End-to-End Pipeline', () => {
  afterAll(async () => {
    await db?.destroy();
  });

  it.skipIf(!db)(
    'seals evidence, computes bitemporal skills, detects declared-vs-observed divergence, and generates a guardrail-safe 13-part report',
    async () => {
      const learnerId = randomUUID();
      const mentorId = randomUUID();

      // 1. Onboard 13-year-old JSS3 learner who declares interest in Graphic Design
      const onboard = await onboardingQueries.onboard(db!, learnerId, {
        fullName: ' Explorer E2E Learner',
        dateOfBirth: '2013-06-15',
        educationStage: 'JSS3',
        declaredInterests: ['Graphic Design'],
        guardian: { fullName: 'Explorer Guardian', phoneNumber: '+2348011112222' },
      });
      expect(onboard.status).toBe('created');

      // Activate parental consent and create a mentor account
      await sql`
        UPDATE core.learner_profiles
        SET consent_status = 'VERIFIED_ACTIVE'::core.consent_status, consent_verified_at = NOW(), consent_verification_method = 'SMS_OTP'
        WHERE learner_id = ${learnerId}::uuid
      `.execute(db!);
      await sql`
        INSERT INTO core.users (id, role, full_name) VALUES (${mentorId}::uuid, 'MENTOR'::core.user_role, 'Explorer Mentor')
      `.execute(db!);

      // 2. Seal offline-first evidence across Graphic Design (0.58) and Python, Cybersecurity & Robotics (0.88 - 0.94)
      const submissions = [
        { title: 'Holiday Poster Layout', score: 0.58, skills: ['SKILL_GRAPHIC_DESIGN'] },
        { title: 'Python Log Parser & Automation', score: 0.92, skills: ['SKILL_PYTHON_PROG', 'SKILL_DEBUGGING_LOGIC'] },
        { title: 'Network Packet Capture & Threat Analysis', score: 0.94, skills: ['SKILL_CYBER_FUND', 'SKILL_DEBUGGING_LOGIC'] },
        { title: 'Autonomous Ultrasonic Obstacle Rover', score: 0.88, skills: ['SKILL_ROBOTICS_IOT', 'SKILL_PYTHON_PROG'] },
      ];

      for (const sub of submissions) {
        const res = await ledgerQueries.syncAndSeal(db!, {
          clientSyncId: randomUUID(),
          learnerId,
          artifactType: 'PROJECT_SUBMISSION',
          title: sub.title,
          storageR2Keys: [],
          externalUrls: [],
          payload: { schema_version: '1.0', skill_codes: sub.skills },
          mentorVerifierId: mentorId,
          qualityScore: sub.score,
          complexityWeight: 1.2,
          capturedOfflineAt: new Date(),
        });
        expect(res.alreadySynced).toBe(false);
      }

      // Record mentor behavioural signal observations
      await rubricQueries.insertSignals(db!, [
        {
          id: randomUUID(),
          mentorId,
          learnerId,
          artifactId: null,
          cohortId: null,
          signal: 'analytical_thinking',
          intensity: 4,
          note: 'Consistently decomposed packet and sensor bugs methodically',
          capturedOfflineAt: new Date(),
        },
        {
          id: randomUUID(),
          mentorId,
          learnerId,
          artifactId: null,
          cohortId: null,
          signal: 'persistence',
          intensity: 4,
          note: 'Iterated on ultrasonic calibration until stable',
          capturedOfflineAt: new Date(),
        },
      ]);

      // 3. Run the SparkTrack Intelligence engines
      const skillEngine = new SkillEngineService(db!);
      const progressEngine = new ProgressEngineService(db!);
      const graphService = new CapabilityGraphService(db!);
      const pathwayEngine = new PathwayEngineService(db!, graphService, skillEngine);
      const recommendationEngine = new RecommendationEngineService(
        db!,
        new ConfigService({ GOOGLE_GENERATIVE_AI_API_KEY: 'your-test-placeholder' }),
        skillEngine,
        pathwayEngine,
      );

      const skills = await skillEngine.computeAll(learnerId);
      expect(skills.length).toBeGreaterThanOrEqual(5);

      const changedCount = await progressEngine.applySkills(learnerId, skills);
      expect(changedCount).toBeGreaterThanOrEqual(5);

      // Verify bitemporal time-travel query returns active capabilities
      const snapshot = await progressEngine.profileAsOf(learnerId, new Date());
      expect(snapshot.length).toBeGreaterThanOrEqual(5);

      // Verify pathway affinities & divergence detection
      const affinities = await pathwayEngine.affinities(learnerId);
      const byCode = Object.fromEntries(affinities.map((a) => [a.pathwayCode, a]));
      expect(byCode.PATH_CYBERSECURITY?.isDivergentFromDeclared).toBe(true);
      expect(byCode.PATH_SOFTWARE_AI?.isDivergentFromDeclared).toBe(true);
      expect(byCode.PATH_ROBOTICS_ENG?.isDivergentFromDeclared).toBe(true);
      expect(byCode.PATH_PRODUCT_DESIGN?.isDivergentFromDeclared).toBe(false);

      // 4. Generate 13-part Development Report & verify Child-Safety Non-Deterministic Guardrail
      const report = await recommendationEngine.generate(learnerId);
      expect(report.version).toBe(1);
      expect(report.guardrailResult.passed).toBe(true);
      expect(report.guardrailResult.deterministicViolations).toHaveLength(0);
      expect(report.declaredVsObserved.narrative).toMatch(/Graphic Design/i);
    },
    90_000,
  );
});
