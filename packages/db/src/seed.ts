import { resolve } from 'node:path';
import * as dotenv from 'dotenv';
import { sql } from 'kysely';
import { createKyselyClient } from './connection.js';
import { bitemporalQueries, ledgerQueries, rubricQueries } from './queries.js';

dotenv.config({ path: resolve(process.cwd(), '../../.env') });
dotenv.config();

export const DEMO_IDS = {
  schoolOrgId: '11111111-1111-4111-8111-000000000001',
  ngoOrgId: '11111111-1111-4111-8111-000000000002',
  cohortId: '11111111-1111-4111-8111-000000000010',
  mentorId: '11111111-1111-4111-8111-000000000020',
  guardianId: '11111111-1111-4111-8111-000000000030',
  explorerLearnerId: '11111111-1111-4111-8111-111111111113',
} as const;

async function main() {
  const stage = process.env.SPARKTRACK_STAGE || process.env.NODE_ENV || 'development';
  if (stage === 'production' && !process.argv.includes('--allow-demo-seed')) {
    throw new Error(
      'Refusing to seed synthetic demo learner profiles in Stage 4 (production). Pass --allow-demo-seed only for non-production sandboxes.',
    );
  }
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL or DIRECT_DATABASE_URL is required to run db:seed');

  const db = createKyselyClient(url);
  try {
    // 1. Partner Organisations
    await sql`
      INSERT INTO core.organisations (id, name, org_type, country_code, subscription_tier)
      VALUES
        (${DEMO_IDS.schoolOrgId}::uuid, 'Queen''s College Lagos Innovation Hub', 'SCHOOL', 'NG', 'SCHOOL_STANDARD'),
        (${DEMO_IDS.ngoOrgId}::uuid, 'SparkTrack Africa Foundation', 'NGO', 'NG', 'ENTERPRISE_SPONSOR')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `.execute(db);

    // 2. Demo Users (Mentor, Guardian, and 13-Year-Old Explorer Learner)
    await sql`
      INSERT INTO core.users (id, role, organisation_id, full_name, email, phone_number)
      VALUES
        (${DEMO_IDS.mentorId}::uuid, 'MENTOR'::core.user_role, ${DEMO_IDS.ngoOrgId}::uuid, 'Dr. Amina Bello', 'mentor@sparktrack.africa', '+2348020000001'),
        (${DEMO_IDS.guardianId}::uuid, 'PARENT'::core.user_role, NULL, 'Mrs. Ngozi Okafor', 'guardian@sparktrack.africa', '+2348030000002'),
        (${DEMO_IDS.explorerLearnerId}::uuid, 'LEARNER'::core.user_role, ${DEMO_IDS.schoolOrgId}::uuid, 'Chidi Okafor (13yo Explorer)', 'explorer@sparktrack.africa', NULL)
      ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name
    `.execute(db);

    // 3. Learner Profile with Verified Guardian Consent + Opt-In Public Portfolio & Talent Discovery
    await sql`
      INSERT INTO core.learner_profiles (
        learner_id, date_of_birth, current_school_id, education_stage, primary_guardian_id,
        consent_status, consent_verified_at, consent_verification_method,
        allow_public_portfolio, allow_partner_talent_discovery, declared_interests
      )
      VALUES (
        ${DEMO_IDS.explorerLearnerId}::uuid,
        '2013-04-12'::date,
        ${DEMO_IDS.schoolOrgId}::uuid,
        'JSS3',
        ${DEMO_IDS.guardianId}::uuid,
        'VERIFIED_ACTIVE'::core.consent_status,
        NOW(),
        'SMS_OTP',
        TRUE,
        TRUE,
        ARRAY['Graphic Design']::text[]
      )
      ON CONFLICT (learner_id) DO UPDATE SET
        consent_status = 'VERIFIED_ACTIVE'::core.consent_status,
        allow_public_portfolio = TRUE,
        allow_partner_talent_discovery = TRUE
    `.execute(db);

    // 4. Programme Cohort & Enrolment & Mentor Assignment
    await sql`
      INSERT INTO core.programme_cohorts (
        id, organisation_id, title, description, programme_type,
        start_date, end_date, max_capacity, current_enrolment_count, price_ngn, is_active
      )
      VALUES (
        ${DEMO_IDS.cohortId}::uuid,
        ${DEMO_IDS.ngoOrgId}::uuid,
        'Lagos Robotics, Cyber & Creative Explorer Camp 2026',
        'Hands-on interdisciplinary exploration across Python, Cybersecurity, Robotics, and Design.',
        'HOLIDAY_CAMP'::core.programme_type,
        '2026-08-01'::date,
        '2026-12-20'::date,
        30,
        1,
        0,
        TRUE
      )
      ON CONFLICT (id) DO NOTHING
    `.execute(db);

    await sql`
      INSERT INTO core.cohort_enrolments (
        learner_id, cohort_id, enrolment_status, payment_provider, scholarship_tag
      )
      VALUES (
        ${DEMO_IDS.explorerLearnerId}::uuid,
        ${DEMO_IDS.cohortId}::uuid,
        'ACTIVE'::core.enrolment_status,
        'SCHOLARSHIP'::core.payment_provider,
        'SPARKTRACK_EXPLORER_2026'
      )
      ON CONFLICT (learner_id, cohort_id) DO NOTHING
    `.execute(db);

    await sql`
      INSERT INTO core.mentor_assignments (mentor_id, cohort_id, learner_id, is_active)
      VALUES (${DEMO_IDS.mentorId}::uuid, ${DEMO_IDS.cohortId}::uuid, ${DEMO_IDS.explorerLearnerId}::uuid, TRUE)
      ON CONFLICT (mentor_id, cohort_id, COALESCE(learner_id, '00000000-0000-0000-0000-000000000000'::uuid))
      DO NOTHING
    `.execute(db);

    // 5. Seal Deterministic Artifacts into the SHA-256 Cryptographic Ledger
    const demoArtifacts = [
      {
        clientSyncId: '11111111-1111-4111-8111-000000000101',
        title: 'Holiday Camp Poster & Brand Layout',
        description: 'Initial Graphic Design poster exploration.',
        skills: ['SKILL_GRAPHIC_DESIGN'],
        score: 0.58 as number | undefined,
        verified: true,
      },
      {
        clientSyncId: '11111111-1111-4111-8111-000000000102',
        title: 'Python Network Log Parser & Alert Script',
        description: 'Automated parsing of server logs to detect anomalous traffic spikes.',
        skills: ['SKILL_PYTHON_PROG', 'SKILL_DEBUGGING_LOGIC'],
        score: 0.93,
        verified: true,
      },
      {
        clientSyncId: '11111111-1111-4111-8111-000000000103',
        title: 'Wireshark Packet Capture & Threat Analysis Lab',
        description: 'Identified Cleartext credentials and ARP spoofing patterns in lab PCAP.',
        skills: ['SKILL_CYBER_FUND', 'SKILL_DEBUGGING_LOGIC'],
        score: 0.95,
        verified: true,
      },
      {
        clientSyncId: '11111111-1111-4111-8111-000000000104',
        title: 'Autonomous Ultrasonic Obstacle Avoidance Rover',
        description: 'Microcontroller sensor loop in Python with servo steering calibration.',
        skills: ['SKILL_ROBOTICS_IOT', 'SKILL_PYTHON_PROG'],
        score: 0.89,
        verified: true,
      },
      {
        clientSyncId: '11111111-1111-4111-8111-000000000105',
        title: 'Smart Solar Classroom Telemetry Node (Awaiting Mentor Review)',
        description: 'Unverified student submission ready for the Mentor 3-Minute Micro-Rubric queue.',
        skills: ['SKILL_ROBOTICS_IOT', 'SKILL_DATA_ANALYSIS'],
        score: undefined,
        verified: false,
      },
    ];

    const artifactIds: string[] = [];
    for (const item of demoArtifacts) {
      const sealed = await ledgerQueries.syncAndSeal(db, {
        clientSyncId: item.clientSyncId,
        learnerId: DEMO_IDS.explorerLearnerId,
        programmeCohortId: DEMO_IDS.cohortId,
        artifactType: 'PROJECT_SUBMISSION',
        title: item.title,
        description: item.description,
        storageR2Keys: [],
        externalUrls: ['https://github.com/sparktrack-africa/explorer-labs'],
        payload: { schema_version: '1.0', skill_codes: item.skills },
        mentorVerifierId: item.verified ? DEMO_IDS.mentorId : undefined,
        qualityScore: item.score,
        complexityWeight: 1.2,
        capturedOfflineAt: new Date(),
      });
      if (!sealed.alreadySynced && sealed.artifactId) artifactIds.push(sealed.artifactId);
    }

    // 6. Seed Mentor Behavioural Signal Observations
    await rubricQueries.insertSignals(db, [
      {
        id: '11111111-1111-4111-8111-000000000201',
        mentorId: DEMO_IDS.mentorId,
        learnerId: DEMO_IDS.explorerLearnerId,
        artifactId: null,
        cohortId: DEMO_IDS.cohortId,
        signal: 'analytical_thinking',
        intensity: 4,
        note: 'Methodically isolated network packet anomalies and ultrasonic sensor noise.',
        capturedOfflineAt: new Date(),
      },
      {
        id: '11111111-1111-4111-8111-000000000202',
        mentorId: DEMO_IDS.mentorId,
        learnerId: DEMO_IDS.explorerLearnerId,
        artifactId: null,
        cohortId: DEMO_IDS.cohortId,
        signal: 'persistence',
        intensity: 4,
        note: 'Persisted through three hardware wiring revisions until the rover stabilised.',
        capturedOfflineAt: new Date(),
      },
    ]);

    // 7. Seed Bitemporal Skill States so Dashboards & Analytics have Immediate Active Profiles
    const skillTargets: Array<{ code: string; score: number; progression: 'DEVELOPING' | 'COMPETENT' | 'ADVANCED'; count: number }> = [
      { code: 'SKILL_CYBER_FUND', score: 0.89, progression: 'ADVANCED', count: 2 },
      { code: 'SKILL_DEBUGGING_LOGIC', score: 0.88, progression: 'ADVANCED', count: 2 },
      { code: 'SKILL_PYTHON_PROG', score: 0.86, progression: 'ADVANCED', count: 2 },
      { code: 'SKILL_ROBOTICS_IOT', score: 0.81, progression: 'COMPETENT', count: 2 },
      { code: 'SKILL_GRAPHIC_DESIGN', score: 0.56, progression: 'DEVELOPING', count: 1 },
    ];

    const nodes = await sql<{ id: string; code: string }>`
      SELECT id, code FROM intelligence.graph_nodes WHERE code IN (
        'SKILL_CYBER_FUND', 'SKILL_DEBUGGING_LOGIC', 'SKILL_PYTHON_PROG', 'SKILL_ROBOTICS_IOT', 'SKILL_GRAPHIC_DESIGN'
      )
    `.execute(db);
    const nodeByCode = Object.fromEntries(nodes.rows.map((n) => [n.code, n.id]));

    for (const st of skillTargets) {
      const nodeId = nodeByCode[st.code];
      if (!nodeId) continue;
      await bitemporalQueries.transition(db, {
        learnerId: DEMO_IDS.explorerLearnerId,
        nodeId,
        score: st.score,
        progression: st.progression,
        evidenceCount: st.count,
        mentorAgreementRatio: 1.0,
        artifactIds,
      });
    }

    console.log('✓ Seeded SparkTrack demo ecosystem:');
    console.log(`  • 13yo Explorer Learner UUID: ${DEMO_IDS.explorerLearnerId}`);
    console.log(`  • Programme Cohort UUID:      ${DEMO_IDS.cohortId}`);
    console.log(`  • Lead Mentor UUID:           ${DEMO_IDS.mentorId}`);
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
