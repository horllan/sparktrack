import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import * as dotenv from 'dotenv';
import { afterAll, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { createKyselyClient } from './connection.js';
import { mentorshipQueries } from './queries.js';

dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createKyselyClient(databaseUrl) : null;

describe('access-control query boundaries', () => {
  afterAll(async () => {
    await db?.destroy();
  });

  it.skipIf(!db)(
    'limits mentor queue and verification to assigned, consented learners',
    async () => {
      const ids = {
        orgA: randomUUID(),
        orgB: randomUUID(),
        mentor: randomUUID(),
        unassignedMentor: randomUUID(),
        schoolAdmin: randomUUID(),
        superAdmin: randomUUID(),
        learnerA: randomUUID(),
        learnerB: randomUUID(),
        learnerPending: randomUUID(),
        cohortA: randomUUID(),
        cohortB: randomUUID(),
        artifactA: randomUUID(),
        artifactB: randomUUID(),
        artifactPending: randomUUID(),
        missingMentor: randomUUID(),
      };

      try {
        await sql`
          INSERT INTO core.organisations (id, name, org_type)
          VALUES
            (${ids.orgA}::uuid, 'Security Test School A', 'SCHOOL'),
            (${ids.orgB}::uuid, 'Security Test School B', 'SCHOOL')
        `.execute(db!);
        await sql`
          INSERT INTO core.users (id, role, organisation_id, full_name)
          VALUES
            (${ids.mentor}::uuid, 'MENTOR'::core.user_role, NULL, 'Assigned Mentor'),
            (${ids.unassignedMentor}::uuid, 'MENTOR'::core.user_role, NULL, 'Unassigned Mentor'),
            (${ids.schoolAdmin}::uuid, 'SCHOOL_ADMIN'::core.user_role, ${ids.orgA}::uuid, 'School Admin'),
            (${ids.superAdmin}::uuid, 'SUPER_ADMIN'::core.user_role, NULL, 'Super Admin'),
            (${ids.learnerA}::uuid, 'LEARNER'::core.user_role, NULL, 'Learner A'),
            (${ids.learnerB}::uuid, 'LEARNER'::core.user_role, NULL, 'Learner B'),
            (${ids.learnerPending}::uuid, 'LEARNER'::core.user_role, NULL, 'Pending Learner')
        `.execute(db!);
        await sql`
          INSERT INTO core.programme_cohorts
            (id, organisation_id, title, programme_type, start_date, end_date, max_capacity)
          VALUES
            (${ids.cohortA}::uuid, ${ids.orgA}::uuid, 'Security Cohort A', 'HOLIDAY_CAMP', '2026-11-01', '2026-12-01', 10),
            (${ids.cohortB}::uuid, ${ids.orgB}::uuid, 'Security Cohort B', 'HOLIDAY_CAMP', '2026-11-01', '2026-12-01', 10)
        `.execute(db!);
        await sql`
          INSERT INTO core.learner_profiles
            (learner_id, date_of_birth, current_school_id, education_stage, consent_status)
          VALUES
            (${ids.learnerA}::uuid, '2012-01-01', ${ids.orgA}::uuid, 'JSS2', 'VERIFIED_ACTIVE'),
            (${ids.learnerB}::uuid, '2012-01-01', ${ids.orgB}::uuid, 'JSS2', 'VERIFIED_ACTIVE'),
            (${ids.learnerPending}::uuid, '2012-01-01', ${ids.orgA}::uuid, 'JSS2', 'PENDING_PARENTAL_CONSENT')
        `.execute(db!);
        await sql`
          INSERT INTO core.cohort_enrolments (learner_id, cohort_id, enrolment_status)
          VALUES
            (${ids.learnerA}::uuid, ${ids.cohortA}::uuid, 'ACTIVE'),
            (${ids.learnerB}::uuid, ${ids.cohortB}::uuid, 'ACTIVE'),
            (${ids.learnerPending}::uuid, ${ids.cohortA}::uuid, 'ACTIVE')
        `.execute(db!);
        await sql`
          INSERT INTO evidence.artifacts (id, client_sync_id, learner_id, programme_cohort_id, artifact_type, title, payload)
          VALUES
            (${ids.artifactA}::uuid, ${randomUUID()}::uuid, ${ids.learnerA}::uuid, ${ids.cohortA}::uuid,
             'PROJECT_SUBMISSION', 'Assigned Artifact', '{"schema_version":"1.0"}'::jsonb),
            (${ids.artifactB}::uuid, ${randomUUID()}::uuid, ${ids.learnerB}::uuid, ${ids.cohortB}::uuid,
             'PROJECT_SUBMISSION', 'Unassigned Artifact', '{"schema_version":"1.0"}'::jsonb),
            (${ids.artifactPending}::uuid, ${randomUUID()}::uuid, ${ids.learnerPending}::uuid, ${ids.cohortA}::uuid,
             'PROJECT_SUBMISSION', 'Pending Consent Artifact', '{"schema_version":"1.0"}'::jsonb)
        `.execute(db!);
        await sql`
          INSERT INTO core.mentor_assignments (mentor_id, cohort_id, is_active)
          VALUES (${ids.mentor}::uuid, ${ids.cohortA}::uuid, TRUE)
        `.execute(db!);

        const mentorQueue = await mentorshipQueries.pendingQueue(db!, {
          userId: ids.mentor,
          role: 'MENTOR',
          organisationId: null,
        });
        expect(mentorQueue.map((artifact) => artifact.artifactId)).toEqual([ids.artifactA]);

        const schoolQueue = await mentorshipQueries.pendingQueue(db!, {
          userId: ids.schoolAdmin,
          role: 'SCHOOL_ADMIN',
          organisationId: ids.orgA,
        });
        expect(schoolQueue.map((artifact) => artifact.artifactId)).toEqual([ids.artifactA]);

        const globalQueue = await mentorshipQueries.pendingQueue(db!, {
          userId: ids.superAdmin,
          role: 'SUPER_ADMIN',
          organisationId: null,
        });
        expect(
          globalQueue
            .map((artifact) => artifact.artifactId)
            .filter((artifactId) =>
              [ids.artifactA, ids.artifactB, ids.artifactPending].includes(artifactId),
            )
            .sort(),
        ).toEqual([ids.artifactA, ids.artifactB].sort());

        expect(
          await mentorshipQueries.verifyArtifact(db!, {
            artifactId: ids.artifactB,
            mentorId: ids.mentor,
            actorRole: 'MENTOR',
            qualityScore: 0.8,
          }),
        ).toBeNull();
        expect(
          await mentorshipQueries.verifyArtifact(db!, {
            artifactId: ids.artifactPending,
            mentorId: ids.mentor,
            actorRole: 'MENTOR',
            qualityScore: 0.8,
          }),
        ).toBeNull();
        expect(
          await mentorshipQueries.verifyArtifact(db!, {
            artifactId: ids.artifactA,
            mentorId: ids.mentor,
            actorRole: 'MENTOR',
            qualityScore: 0.8,
          }),
        ).toMatchObject({ artifactId: ids.artifactA, learnerId: ids.learnerA });

        expect(
          await mentorshipQueries.assignMentor(db!, {
            mentorId: ids.missingMentor,
            cohortId: ids.cohortA,
            actor: { id: ids.superAdmin, role: 'SUPER_ADMIN', organisationId: null },
          }),
        ).toBeNull();
        const missingMentor = await sql`SELECT id FROM core.users WHERE id = ${ids.missingMentor}::uuid`.execute(db!);
        expect(missingMentor.rows).toHaveLength(0);

        expect(
          await mentorshipQueries.assignMentor(db!, {
            mentorId: ids.mentor,
            cohortId: ids.cohortB,
            actor: { id: ids.schoolAdmin, role: 'SCHOOL_ADMIN', organisationId: ids.orgA },
          }),
        ).toBeNull();
      } finally {
        await sql`DELETE FROM evidence.artifacts WHERE id IN (${ids.artifactA}::uuid, ${ids.artifactB}::uuid, ${ids.artifactPending}::uuid)`.execute(db!);
        await sql`DELETE FROM core.mentor_assignments WHERE mentor_id IN (${ids.mentor}::uuid, ${ids.unassignedMentor}::uuid, ${ids.missingMentor}::uuid)`.execute(db!);
        await sql`DELETE FROM core.cohort_enrolments WHERE learner_id IN (${ids.learnerA}::uuid, ${ids.learnerB}::uuid, ${ids.learnerPending}::uuid)`.execute(db!);
        await sql`DELETE FROM core.learner_profiles WHERE learner_id IN (${ids.learnerA}::uuid, ${ids.learnerB}::uuid, ${ids.learnerPending}::uuid)`.execute(db!);
        await sql`DELETE FROM core.users WHERE id IN (${ids.mentor}::uuid, ${ids.unassignedMentor}::uuid, ${ids.schoolAdmin}::uuid, ${ids.superAdmin}::uuid, ${ids.learnerA}::uuid, ${ids.learnerB}::uuid, ${ids.learnerPending}::uuid)`.execute(db!);
        await sql`DELETE FROM core.programme_cohorts WHERE id IN (${ids.cohortA}::uuid, ${ids.cohortB}::uuid)`.execute(db!);
        await sql`DELETE FROM core.organisations WHERE id IN (${ids.orgA}::uuid, ${ids.orgB}::uuid)`.execute(db!);
      }
    },
    30_000,
  );
});
