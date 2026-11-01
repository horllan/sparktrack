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
  vocationalOrgId: '11111111-1111-4111-8111-000000000003',
  cohortId: '11111111-1111-4111-8111-000000000010',
  cohortSolarId: '11111111-1111-4111-8111-000000000011',
  cohortNyscId: '11111111-1111-4111-8111-000000000012',
  cohortCreativeId: '11111111-1111-4111-8111-000000000013',
  mentorId: '11111111-1111-4111-8111-000000000020',
  guardianId: '11111111-1111-4111-8111-000000000030',
  schoolAdminId: '11111111-1111-4111-8111-000000000040',
  superAdminId: '11111111-1111-4111-8111-000000000050',
  explorerLearnerId: '11111111-1111-4111-8111-111111111113',
  aishaLearnerId: '11111111-1111-4111-8111-111111111114',
  tundeLearnerId: '11111111-1111-4111-8111-111111111115',
  zainabLearnerId: '11111111-1111-4111-8111-111111111116',
} as const;

const DEMO_PASSWORD = 'SparkTrackDemo!2026';

async function ensureSupabaseAuthUser(params: {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: string;
}) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || serviceKey.startsWith('REPLACE_WITH')) return;

  const adminBase = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users`;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // Try updating existing user by ID first
    const updateRes = await fetch(`${adminBase}/${params.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        email: params.email,
        password: params.password,
        email_confirm: true,
        user_metadata: { full_name: params.fullName, role: params.role },
      }),
    });
    if (updateRes.ok) return;

    // Otherwise create with deterministic UUID
    await fetch(adminBase, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: params.id,
        email: params.email,
        password: params.password,
        email_confirm: true,
        user_metadata: { full_name: params.fullName, role: params.role },
      }),
    });
  } catch {
    // Non-fatal if offline
  }
}

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
    // 0. Provision Real Supabase Auth Demo Accounts (for 1-click sign-in)
    await Promise.all([
      ensureSupabaseAuthUser({
        id: DEMO_IDS.explorerLearnerId,
        email: 'student@sparktrack.africa',
        password: DEMO_PASSWORD,
        fullName: 'Chidi Okafor (13yo Explorer)',
        role: 'LEARNER',
      }),
      ensureSupabaseAuthUser({
        id: DEMO_IDS.guardianId,
        email: 'guardian@sparktrack.africa',
        password: DEMO_PASSWORD,
        fullName: 'Mrs. Ngozi Okafor',
        role: 'PARENT',
      }),
      ensureSupabaseAuthUser({
        id: DEMO_IDS.mentorId,
        email: 'mentor@sparktrack.africa',
        password: DEMO_PASSWORD,
        fullName: 'Dr. Amina Bello',
        role: 'MENTOR',
      }),
      ensureSupabaseAuthUser({
        id: DEMO_IDS.schoolAdminId,
        email: 'school@sparktrack.africa',
        password: DEMO_PASSWORD,
        fullName: "Principal Adewale (Queen's College Hub)",
        role: 'SCHOOL_ADMIN',
      }),
      ensureSupabaseAuthUser({
        id: DEMO_IDS.superAdminId,
        email: 'admin@sparktrack.africa',
        password: DEMO_PASSWORD,
        fullName: 'SparkTrack Operations Lead',
        role: 'SUPER_ADMIN',
      }),
    ]);

    // 1. Partner Organisations
    await sql`
      INSERT INTO core.organisations (id, name, org_type, country_code, subscription_tier)
      VALUES
        (${DEMO_IDS.schoolOrgId}::uuid, 'Queen''s College Lagos Innovation Hub', 'SCHOOL', 'NG', 'SCHOOL_STANDARD'),
        (${DEMO_IDS.ngoOrgId}::uuid, 'SparkTrack Africa Foundation', 'NGO', 'NG', 'ENTERPRISE_SPONSOR'),
        (${DEMO_IDS.vocationalOrgId}::uuid, 'Kano Community Solar & Maker Hub', 'TRAINING_PROVIDER', 'NG', 'SCHOOL_STANDARD')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `.execute(db);

    // 2. Demo Users (Mentor, Guardian, School Admin, Super Admin + 4 Case Study Learners)
    await sql`
      INSERT INTO core.users (id, role, organisation_id, full_name, email, phone_number)
      VALUES
        (${DEMO_IDS.mentorId}::uuid, 'MENTOR'::core.user_role, ${DEMO_IDS.ngoOrgId}::uuid, 'Dr. Amina Bello', 'mentor@sparktrack.africa', '+2348020000001'),
        (${DEMO_IDS.guardianId}::uuid, 'PARENT'::core.user_role, NULL, 'Mrs. Ngozi Okafor', 'guardian@sparktrack.africa', '+2348030000002'),
        (${DEMO_IDS.schoolAdminId}::uuid, 'SCHOOL_ADMIN'::core.user_role, ${DEMO_IDS.schoolOrgId}::uuid, 'Principal Adewale (Queen''s College Hub)', 'school@sparktrack.africa', '+2348050000003'),
        (${DEMO_IDS.superAdminId}::uuid, 'SUPER_ADMIN'::core.user_role, ${DEMO_IDS.ngoOrgId}::uuid, 'SparkTrack Operations Lead', 'admin@sparktrack.africa', '+2348090000004'),
        (${DEMO_IDS.explorerLearnerId}::uuid, 'LEARNER'::core.user_role, ${DEMO_IDS.schoolOrgId}::uuid, 'Chidi Okafor (13yo Explorer)', 'student@sparktrack.africa', NULL),
        (${DEMO_IDS.aishaLearnerId}::uuid, 'LEARNER'::core.user_role, ${DEMO_IDS.vocationalOrgId}::uuid, 'Aisha Musa (19yo Vocational Maker)', 'aisha.demo@sparktrack.africa', '+2348061112233'),
        (${DEMO_IDS.tundeLearnerId}::uuid, 'LEARNER'::core.user_role, ${DEMO_IDS.ngoOrgId}::uuid, 'Tunde Adeyemi (23yo NYSC Track)', 'tunde.demo@sparktrack.africa', '+2348072223344'),
        (${DEMO_IDS.zainabLearnerId}::uuid, 'LEARNER'::core.user_role, ${DEMO_IDS.schoolOrgId}::uuid, 'Zainab Ibrahim (15yo SS1 Creative)', 'zainab.demo@sparktrack.africa', NULL)
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        organisation_id = EXCLUDED.organisation_id
    `.execute(db);

    // 3. Learner Profiles for All 4 Case Studies
    await sql`
      INSERT INTO core.learner_profiles (
        learner_id, date_of_birth, age_group, current_school_id, education_stage,
        learner_stage, education_level, learning_goal, "current_role", target_role,
        primary_guardian_id, consent_status, consent_verified_at, consent_verification_method,
        allow_public_portfolio, allow_partner_talent_discovery, declared_interests
      )
      VALUES
        (
          ${DEMO_IDS.explorerLearnerId}::uuid,
          '2013-04-12'::date,
          'UNDER_18',
          ${DEMO_IDS.schoolOrgId}::uuid,
          'JSS3',
          'SECONDARY_SCHOOL',
          'JSS3',
          'EXPLORE_INTERESTS',
          'JSS3 Co-Curricular Prefect',
          'Robotics, AI & Cybersecurity Engineer',
          ${DEMO_IDS.guardianId}::uuid,
          'VERIFIED_ACTIVE'::core.consent_status,
          NOW(),
          'SMS_OTP',
          TRUE,
          TRUE,
          ARRAY['Graphic Design']::text[]
        ),
        (
          ${DEMO_IDS.aishaLearnerId}::uuid,
          '2007-02-18'::date,
          'ADULT',
          ${DEMO_IDS.vocationalOrgId}::uuid,
          'Vocational / Apprenticeship',
          'NO_FORMAL_EDUCATION',
          'Vocational Trade & Maker Apprenticeship',
          'BUILD_PRACTICAL_SKILLS',
          'Apprentice Solar & Inverter Technician',
          'Lead Renewable Energy Field Engineer',
          NULL,
          'VERIFIED_ACTIVE'::core.consent_status,
          NOW(),
          'ADULT_SELF_ATTESTATION',
          TRUE,
          TRUE,
          ARRAY['Robotics', 'Business & Entrepreneurship']::text[]
        ),
        (
          ${DEMO_IDS.tundeLearnerId}::uuid,
          '2003-07-09'::date,
          'ADULT',
          ${DEMO_IDS.ngoOrgId}::uuid,
          'University / College',
          'NYSC',
          'B.Sc. Computer Science / NYSC Corps Member',
          'GET_FIRST_JOB',
          'NYSC SAED Tech Lead',
          'Full-Stack Product & Data Engineer',
          NULL,
          'VERIFIED_ACTIVE'::core.consent_status,
          NOW(),
          'ADULT_SELF_ATTESTATION',
          TRUE,
          TRUE,
          ARRAY['Web Development', 'AI & Data Science']::text[]
        ),
        (
          ${DEMO_IDS.zainabLearnerId}::uuid,
          '2011-08-24'::date,
          'UNDER_18',
          ${DEMO_IDS.schoolOrgId}::uuid,
          'SS1',
          'SECONDARY_SCHOOL',
          'SS1 Creative & Commercial Stream',
          'START_BUSINESS',
          'School Design & Enterprise Club Lead',
          'Product Designer & Sustainable Brand Founder',
          ${DEMO_IDS.guardianId}::uuid,
          'VERIFIED_ACTIVE'::core.consent_status,
          NOW(),
          'SMS_OTP',
          TRUE,
          TRUE,
          ARRAY['Graphic Design', 'Video Production', 'Business & Entrepreneurship']::text[]
        )
      ON CONFLICT (learner_id) DO UPDATE SET
        age_group = EXCLUDED.age_group,
        consent_status = 'VERIFIED_ACTIVE'::core.consent_status,
        allow_public_portfolio = TRUE,
        allow_partner_talent_discovery = TRUE,
        primary_guardian_id = EXCLUDED.primary_guardian_id,
        learner_stage = EXCLUDED.learner_stage,
        education_level = EXCLUDED.education_level,
        learning_goal = EXCLUDED.learning_goal,
        "current_role" = EXCLUDED."current_role",
        target_role = EXCLUDED.target_role
    `.execute(db);

    // 4. Programme Cohorts & Enrolments & Mentor Assignments
    await sql`
      INSERT INTO core.programme_cohorts (
        id, organisation_id, title, description, programme_type,
        start_date, end_date, max_capacity, current_enrolment_count, price_ngn, is_active
      )
      VALUES
        (
          ${DEMO_IDS.cohortId}::uuid,
          ${DEMO_IDS.ngoOrgId}::uuid,
          'Lagos Robotics, Cyber & Creative Explorer Camp 2026',
          'Hands-on interdisciplinary exploration across Python, Cybersecurity, Robotics, and Design.',
          'HOLIDAY_CAMP'::core.programme_type,
          '2026-08-01'::date,
          '2026-12-20'::date,
          45,
          4,
          15000,
          TRUE
        ),
        (
          ${DEMO_IDS.cohortSolarId}::uuid,
          ${DEMO_IDS.vocationalOrgId}::uuid,
          'Kano Solar Inverter, Battery Telemetry & Maker Guild 2026',
          'Vocational renewable energy hardware, IoT battery telemetry, and micro-grid service operations.',
          'WEEKEND_WORKSHOP'::core.programme_type,
          '2026-06-01'::date,
          '2026-12-15'::date,
          30,
          1,
          0,
          TRUE
        ),
        (
          ${DEMO_IDS.cohortNyscId}::uuid,
          ${DEMO_IDS.ngoOrgId}::uuid,
          'NYSC SAED Full-Stack, Data & AI Employability Accelerator 2026',
          'Bridging university and NYSC corps members into verified engineering portfolios.',
          'ONLINE_COHORT'::core.programme_type,
          '2026-07-01'::date,
          '2026-12-20'::date,
          40,
          1,
          20000,
          TRUE
        ),
        (
          ${DEMO_IDS.cohortCreativeId}::uuid,
          ${DEMO_IDS.schoolOrgId}::uuid,
          'Queen''s College UI/UX Design & Green Youth Venture Club 2026',
          'Co-curricular product design, digital storytelling, and student micro-enterprise lab.',
          'SCHOOL_TERM_COCURRICULAR'::core.programme_type,
          '2026-09-01'::date,
          '2026-12-18'::date,
          45,
          2,
          15000,
          TRUE
        )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        current_enrolment_count = EXCLUDED.current_enrolment_count
    `.execute(db);

    const enrolments = [
      { learnerId: DEMO_IDS.explorerLearnerId, cohortId: DEMO_IDS.cohortId },
      { learnerId: DEMO_IDS.aishaLearnerId, cohortId: DEMO_IDS.cohortSolarId },
      { learnerId: DEMO_IDS.tundeLearnerId, cohortId: DEMO_IDS.cohortNyscId },
      { learnerId: DEMO_IDS.zainabLearnerId, cohortId: DEMO_IDS.cohortCreativeId },
    ];
    for (const enr of enrolments) {
      await sql`
        INSERT INTO core.cohort_enrolments (
          learner_id, cohort_id, enrolment_status, payment_provider, scholarship_tag
        )
        VALUES (
          ${enr.learnerId}::uuid,
          ${enr.cohortId}::uuid,
          'ACTIVE'::core.enrolment_status,
          'SCHOLARSHIP'::core.payment_provider,
          'SPARKTRACK_PILOT_2026'
        )
        ON CONFLICT (learner_id, cohort_id) DO NOTHING
      `.execute(db);

      await sql`
        INSERT INTO core.mentor_assignments (mentor_id, cohort_id, learner_id, is_active)
        VALUES (${DEMO_IDS.mentorId}::uuid, ${enr.cohortId}::uuid, ${enr.learnerId}::uuid, TRUE)
        ON CONFLICT (mentor_id, cohort_id, COALESCE(learner_id, '00000000-0000-0000-0000-000000000000'::uuid))
        DO NOTHING
      `.execute(db);
    }

    // 5. Seal Deterministic Artifacts into the SHA-256 Cryptographic Ledger across all 4 Case Studies
    const demoArtifacts = [
      // Chidi Okafor (JSS3)
      {
        clientSyncId: '11111111-1111-4111-8111-000000000101',
        learnerId: DEMO_IDS.explorerLearnerId,
        cohortId: DEMO_IDS.cohortId,
        title: 'Holiday Camp Poster & Brand Layout',
        description: 'Initial Graphic Design poster exploration.',
        skills: ['SKILL_GRAPHIC_DESIGN'],
        score: 0.58 as number | undefined,
        verified: true,
      },
      {
        clientSyncId: '11111111-1111-4111-8111-000000000102',
        learnerId: DEMO_IDS.explorerLearnerId,
        cohortId: DEMO_IDS.cohortId,
        title: 'Python Network Log Parser & Alert Script',
        description: 'Automated parsing of server logs to detect anomalous traffic spikes.',
        skills: ['SKILL_PYTHON_PROG', 'SKILL_DEBUGGING_LOGIC'],
        score: 0.93,
        verified: true,
      },
      {
        clientSyncId: '11111111-1111-4111-8111-000000000103',
        learnerId: DEMO_IDS.explorerLearnerId,
        cohortId: DEMO_IDS.cohortId,
        title: 'Wireshark Packet Capture & Threat Analysis Lab',
        description: 'Identified Cleartext credentials and ARP spoofing patterns in lab PCAP.',
        skills: ['SKILL_CYBER_FUND', 'SKILL_DEBUGGING_LOGIC'],
        score: 0.95,
        verified: true,
      },
      {
        clientSyncId: '11111111-1111-4111-8111-000000000104',
        learnerId: DEMO_IDS.explorerLearnerId,
        cohortId: DEMO_IDS.cohortId,
        title: 'Autonomous Ultrasonic Obstacle Avoidance Rover',
        description: 'Microcontroller sensor loop in Python with servo steering calibration.',
        skills: ['SKILL_ROBOTICS_IOT', 'SKILL_PYTHON_PROG'],
        score: 0.89,
        verified: true,
      },
      {
        clientSyncId: '11111111-1111-4111-8111-000000000105',
        learnerId: DEMO_IDS.explorerLearnerId,
        cohortId: DEMO_IDS.cohortId,
        title: 'Smart Solar Classroom Telemetry Node (Awaiting Mentor Review)',
        description: 'Unverified student submission ready for the Mentor 3-Minute Micro-Rubric queue.',
        skills: ['SKILL_ROBOTICS_IOT', 'SKILL_DATA_ANALYSIS'],
        score: undefined,
        verified: false,
      },
      // Aisha Musa (19yo Vocational Solar & IoT Maker)
      {
        clientSyncId: '11111111-1111-4111-8111-000000000202',
        learnerId: DEMO_IDS.aishaLearnerId,
        cohortId: DEMO_IDS.cohortSolarId,
        title: '3.5kVA Solar Cold-Storage Backup for Pharmacy Clinic',
        description: 'Full load audit, PV array protection wiring, and changeover relay installation.',
        skills: ['SKILL_ROBOTICS_IOT', 'SKILL_DEBUGGING_LOGIC'],
        score: 0.94,
        verified: true,
      },
      {
        clientSyncId: '11111111-1111-4111-8111-000000000203',
        learnerId: DEMO_IDS.aishaLearnerId,
        cohortId: DEMO_IDS.cohortSolarId,
        title: 'GSM SMS Low-Voltage Battery Guardian Node',
        description: 'Hardware monitor alerting shop owners via SMS before deep-discharge damages inverter batteries.',
        skills: ['SKILL_ROBOTICS_IOT', 'SKILL_DATA_ANALYSIS'],
        score: 0.96,
        verified: true,
      },
      // Tunde Adeyemi (23yo University / NYSC Track)
      {
        clientSyncId: '11111111-1111-4111-8111-000000000303',
        learnerId: DEMO_IDS.tundeLearnerId,
        cohortId: DEMO_IDS.cohortNyscId,
        title: 'Zero-Trust Cooperative Ledger API (B.Sc. Capstone)',
        description: 'Auditable savings & loan backend with SHA-256 hash chaining and role-based access control.',
        skills: ['SKILL_PYTHON_PROG', 'SKILL_CYBER_FUND'],
        score: 0.95,
        verified: true,
      },
      {
        clientSyncId: '11111111-1111-4111-8111-000000000304',
        learnerId: DEMO_IDS.tundeLearnerId,
        cohortId: DEMO_IDS.cohortNyscId,
        title: 'MamaCare NYSC — Primary Health Centre Immunization Triage System',
        description: 'Built during NYSC Community Development Service; reduced clinic wait times by 42%.',
        skills: ['SKILL_PYTHON_PROG', 'SKILL_DATA_ANALYSIS'],
        score: 0.97,
        verified: true,
      },
      // Zainab Ibrahim (15yo SS1 Creative & Youth Venture)
      {
        clientSyncId: '11111111-1111-4111-8111-000000000402',
        learnerId: DEMO_IDS.zainabLearnerId,
        cohortId: DEMO_IDS.cohortCreativeId,
        title: 'StudyBuddy NG — Low-Bandwidth Peer Revision App UI/UX Prototype',
        description: 'Interactive 18-screen mobile prototype tested with JSS3 students preparing for BECE.',
        skills: ['SKILL_GRAPHIC_DESIGN'],
        score: 0.94,
        verified: true,
      },
    ];

    const artifactIds: string[] = [];
    for (const item of demoArtifacts) {
      const sealed = await ledgerQueries.syncAndSeal(db, {
        clientSyncId: item.clientSyncId,
        learnerId: item.learnerId,
        programmeCohortId: item.cohortId,
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
    const skillTargets: Array<{
      learnerId: string;
      code: string;
      score: number;
      progression: 'DEVELOPING' | 'COMPETENT' | 'ADVANCED';
      count: number;
    }> = [
      { learnerId: DEMO_IDS.explorerLearnerId, code: 'SKILL_CYBER_FUND', score: 0.89, progression: 'ADVANCED', count: 2 },
      { learnerId: DEMO_IDS.explorerLearnerId, code: 'SKILL_DEBUGGING_LOGIC', score: 0.88, progression: 'ADVANCED', count: 2 },
      { learnerId: DEMO_IDS.explorerLearnerId, code: 'SKILL_PYTHON_PROG', score: 0.86, progression: 'ADVANCED', count: 2 },
      { learnerId: DEMO_IDS.explorerLearnerId, code: 'SKILL_ROBOTICS_IOT', score: 0.81, progression: 'COMPETENT', count: 2 },
      { learnerId: DEMO_IDS.explorerLearnerId, code: 'SKILL_GRAPHIC_DESIGN', score: 0.56, progression: 'DEVELOPING', count: 1 },
      { learnerId: DEMO_IDS.aishaLearnerId, code: 'SKILL_ROBOTICS_IOT', score: 0.94, progression: 'ADVANCED', count: 2 },
      { learnerId: DEMO_IDS.tundeLearnerId, code: 'SKILL_PYTHON_PROG', score: 0.95, progression: 'ADVANCED', count: 2 },
      { learnerId: DEMO_IDS.zainabLearnerId, code: 'SKILL_GRAPHIC_DESIGN', score: 0.92, progression: 'ADVANCED', count: 2 },
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
        learnerId: st.learnerId,
        nodeId,
        score: st.score,
        progression: st.progression,
        evidenceCount: st.count,
        mentorAgreementRatio: 1.0,
        artifactIds,
      });
    }

    console.log('✓ Seeded SparkTrack 4-Case-Study Presentation & Production Demo Ecosystem:');
    console.log(`  • Student Demo:   student@sparktrack.africa  / ${DEMO_PASSWORD} (${DEMO_IDS.explorerLearnerId})`);
    console.log(`  • Guardian Demo:  guardian@sparktrack.africa / ${DEMO_PASSWORD} (${DEMO_IDS.guardianId})`);
    console.log(`  • Mentor Demo:    mentor@sparktrack.africa   / ${DEMO_PASSWORD} (${DEMO_IDS.mentorId})`);
    console.log(`  • School Demo:    school@sparktrack.africa   / ${DEMO_PASSWORD} (${DEMO_IDS.schoolAdminId})`);
    console.log(`  • Admin Demo:     admin@sparktrack.africa    / ${DEMO_PASSWORD} (${DEMO_IDS.superAdminId})`);
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
