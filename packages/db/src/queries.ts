import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { SparkTrackDatabase } from './kysely-types.js';

export type Db = Kysely<SparkTrackDatabase>;
export type Progression = 'BEGINNER' | 'DEVELOPING' | 'COMPETENT' | 'ADVANCED';

/** Deterministic JSON (sorted keys) so the ledger hash is stable across clients/servers. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex');

export interface ArtifactInput {
  clientSyncId: string; learnerId: string; programmeCohortId?: string; activityNodeId?: string;
  artifactType: string; title: string; description?: string; storageR2Keys: string[]; externalUrls: string[];
  payload: Record<string, unknown>; mentorVerifierId?: string; qualityScore?: number;
  complexityWeight: number; capturedOfflineAt: Date;
}

/** Ledger: INSERT ONLY. Triggers chain hashes; UPDATE/DELETE/TRUNCATE raise exceptions. */
export const ledgerQueries = {
  /** Atomically insert the artifact (idempotent on client_sync_id) and seal it in the ledger. */
  async syncAndSeal(db: Db, a: ArtifactInput) {
    return db.transaction().execute(async (trx) => {
      const hash = sha256Hex(canonicalJson({
        title: a.title, type: a.artifactType, payload: a.payload,
        r2: a.storageR2Keys, urls: a.externalUrls, q: a.qualityScore ?? null, c: a.complexityWeight,
      }));
      const ins = await sql<{ id: string }>`
        INSERT INTO evidence.artifacts (client_sync_id, learner_id, programme_cohort_id, activity_node_id,
          artifact_type, title, description, storage_r2_keys, external_urls, payload, mentor_verifier_id,
          quality_score, complexity_weight, captured_offline_at)
        VALUES (${a.clientSyncId}::uuid, ${a.learnerId}::uuid, ${a.programmeCohortId ?? null}::uuid,
          ${a.activityNodeId ?? null}::uuid, ${a.artifactType}::evidence.artifact_type, ${a.title},
          ${a.description ?? null}, ${sql.val(a.storageR2Keys)}::text[], ${sql.val(a.externalUrls)}::text[],
          ${JSON.stringify(a.payload)}::jsonb, ${a.mentorVerifierId ?? null}::uuid,
          ${a.qualityScore ?? null}, ${a.complexityWeight}, ${a.capturedOfflineAt.toISOString()}::timestamptz)
        ON CONFLICT (client_sync_id) DO NOTHING
        RETURNING id`.execute(trx);
      const artifactId = ins.rows[0]?.id;
      if (!artifactId) return { alreadySynced: true as const, artifactId: null };

      const led = await sql<{ ledger_seq: string; row_signature_hash: string }>`
        INSERT INTO evidence.cryptographic_ledger (artifact_id, learner_id, verifier_id, payload_canonical_hash,
          previous_ledger_hash, row_signature_hash)
        VALUES (${artifactId}::uuid, ${a.learnerId}::uuid, ${a.mentorVerifierId ?? null}::uuid, ${hash}, '', '')
        RETURNING ledger_seq, row_signature_hash`.execute(trx);
      const row = led.rows[0]!;
      return { alreadySynced: false as const, artifactId, ledgerSeq: Number(row.ledger_seq), rowSignatureHash: row.row_signature_hash };
    });
  },

  /** Recompute the whole chain and report broken links. */
  async verifyChain(db: Db) {
    const r = await sql<{ ledger_seq: string; is_valid: boolean }>`
      SELECT ledger_seq,
        previous_ledger_hash = COALESCE(LAG(row_signature_hash) OVER (ORDER BY ledger_seq), 'SPARKTRACK_GENESIS_BLOCK_2026')
        AND row_signature_hash = encode(sha256(convert_to(previous_ledger_hash || '|' || artifact_id::text || '|' ||
              learner_id::text || '|' || payload_canonical_hash, 'UTF8')), 'hex') AS is_valid
      FROM evidence.cryptographic_ledger ORDER BY ledger_seq`.execute(db);
    return r.rows.map((x) => ({ ledgerSeq: Number(x.ledger_seq), isValid: x.is_valid }));
  },
};

export const bitemporalQueries = {
  async profileAsOf(db: Db, learnerId: string, asOf: Date = new Date()) {
    const r = await sql<{ node_code: string; node_name: string; node_type: string; category: string | null;
      score: string; progression: Progression; evidence_count: number }>`
      SELECT * FROM intelligence.fn_get_learner_profile_as_of(${learnerId}::uuid, ${asOf.toISOString()}::timestamptz)`
      .execute(db);
    return r.rows.map((x) => ({ ...x, score: Number(x.score) }));
  },

  /** Close the open period and open a new one in a single transaction. No-ops if the state is unchanged. */
  async transition(db: Db, p: { learnerId: string; nodeId: string; score: number; progression: Progression;
    evidenceCount: number; mentorAgreementRatio: number | null; artifactIds: string[] }) {
    return db.transaction().execute(async (trx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${p.learnerId + p.nodeId}))`.execute(trx);
      const cur = await sql<{ computed_score: string; progression_state: string }>`
        SELECT computed_score, progression_state FROM intelligence.learner_capability_temporal
        WHERE learner_id = ${p.learnerId}::uuid AND node_id = ${p.nodeId}::uuid AND upper_inf(valid_period)`
        .execute(trx);
      const c = cur.rows[0];
      if (c && Number(c.computed_score) === Number(p.score.toFixed(4)) && c.progression_state === p.progression) {
        return { changed: false };
      }
      await sql`UPDATE intelligence.learner_capability_temporal
        SET valid_period = tstzrange(lower(valid_period), NOW(), '[)')
        WHERE learner_id = ${p.learnerId}::uuid AND node_id = ${p.nodeId}::uuid AND upper_inf(valid_period)`
        .execute(trx);
      await sql`INSERT INTO intelligence.learner_capability_temporal
        (learner_id, node_id, computed_score, progression_state, evidence_count, mentor_agreement_ratio,
         supporting_artifact_ids, valid_period)
        VALUES (${p.learnerId}::uuid, ${p.nodeId}::uuid, ${p.score.toFixed(4)}, ${p.progression}::intelligence.progression_level,
          ${p.evidenceCount}, ${p.mentorAgreementRatio}, ${sql.val(p.artifactIds)}::uuid[], tstzrange(NOW(), NULL, '[)'))`
        .execute(trx);
      return { changed: true };
    });
  },
};

export const graphQueries = {
  /** Weighted recursive traversal. Cycle-safe via path tracking and depth cap. */
  async traverse(db: Db, startNodeIds: string[], maxDepth = 4) {
    const r = await sql<{ node_id: string; node_code: string; node_name: string; node_type: string;
      path_weight: string; depth: number }>`
      WITH RECURSIVE walk AS (
        SELECT n.id AS node_id, n.code, n.name, n.node_type::text AS node_type,
               1.0::numeric AS path_weight, 0 AS depth, ARRAY[n.id] AS path
        FROM intelligence.graph_nodes n WHERE n.id = ANY(${sql.val(startNodeIds)}::uuid[])
        UNION ALL
        SELECT n.id, n.code, n.name, n.node_type::text, w.path_weight * e.contribution_weight, w.depth + 1, w.path || n.id
        FROM walk w
        JOIN intelligence.graph_edges e ON e.source_node_id = w.node_id AND e.relationship_type <> 'AMPLIFIES_CAPABILITY'
        JOIN intelligence.graph_nodes n ON n.id = e.target_node_id
        WHERE w.depth < ${maxDepth} AND NOT n.id = ANY(w.path))
      SELECT DISTINCT ON (node_id) node_id, code AS node_code, name AS node_name, node_type, path_weight, depth
      FROM walk ORDER BY node_id, path_weight DESC`.execute(db);
    return r.rows.map((x) => ({ ...x, path_weight: Number(x.path_weight) }));
  },

  /** Cosine similarity over halfvec(768) HNSW index. */
  async similar(db: Db, embedding: number[], limit = 10) {
    if (embedding.length !== 768) throw new Error('Embedding must have 768 dimensions');
    const v = `[${embedding.join(',')}]`;
    const r = await sql<{ id: string; code: string; name: string; node_type: string; similarity: string }>`
      SELECT id, code, name, node_type::text, 1 - (embedding <=> ${v}::halfvec(768)) AS similarity
      FROM intelligence.graph_nodes WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${v}::halfvec(768) LIMIT ${limit}`.execute(db);
    return r.rows.map((x) => ({ ...x, similarity: Number(x.similarity) }));
  },

  /** Pathway requirements: (skill|capability) -> pathway edges, for affinity computation. */
  async edgesWithNodes(db: Db) {
    const r = await sql<{ source_code: string; source_type: string; target_code: string; target_type: string;
      target_name: string; weight: string; is_required: boolean; relationship_type: string; source_name: string;
      source_id: string; target_id: string }>`
      SELECT s.id AS source_id, s.code AS source_code, s.name AS source_name, s.node_type::text AS source_type,
             t.id AS target_id, t.code AS target_code, t.name AS target_name, t.node_type::text AS target_type,
             e.contribution_weight AS weight, e.is_required, e.relationship_type
      FROM intelligence.graph_edges e
      JOIN intelligence.graph_nodes s ON s.id = e.source_node_id
      JOIN intelligence.graph_nodes t ON t.id = e.target_node_id`.execute(db);
    return r.rows.map((x) => ({ ...x, weight: Number(x.weight) }));
  },

  async fullTopology(db: Db) {
    const [nodes, edges] = await Promise.all([
      sql<{
        id: string;
        node_type: string;
        code: string;
        name: string;
        category: string | null;
        description: string;
      }>`
        SELECT id, node_type::text, code, name, category::text, description
        FROM intelligence.graph_nodes
        ORDER BY node_type, name
      `.execute(db),
      graphQueries.edgesWithNodes(db),
    ]);
    return {
      nodes: nodes.rows.map((n) => ({
        id: n.id,
        nodeType: n.node_type,
        code: n.code,
        name: n.name,
        category: n.category,
        description: n.description,
      })),
      edges,
    };
  },
};

/** Evidence read model for the Skill Engine. Convention: artifact.payload.skill_codes = string[]. */
export const evidenceReadQueries = {
  async forLearner(db: Db, learnerId: string) {
    const r = await sql<{ id: string; artifact_type: string; quality_score: string; complexity_weight: string;
      mentor_verified: boolean; captured_offline_at: Date; skill_codes: string[] }>`
      SELECT a.id, a.artifact_type::text, COALESCE(a.quality_score, 0.6500)::text AS quality_score, a.complexity_weight,
             (a.mentor_verifier_id IS NOT NULL) AS mentor_verified, a.captured_offline_at,
             COALESCE(ARRAY(SELECT jsonb_array_elements_text(a.payload->'skill_codes')), '{}') AS skill_codes
      FROM evidence.artifacts a
      WHERE a.learner_id = ${learnerId}::uuid
      ORDER BY a.captured_offline_at`.execute(db);
    return r.rows.map((x) => ({ ...x, quality_score: Number(x.quality_score), complexity_weight: Number(x.complexity_weight) }));
  },

  async signalsForLearner(db: Db, learnerId: string) {
    const r = await sql<{ signal: string; avg_intensity: string; n: string }>`
      SELECT signal, AVG(intensity)::numeric(4,2) AS avg_intensity, COUNT(*) AS n
      FROM evidence.mentor_signal_observations WHERE learner_id = ${learnerId}::uuid GROUP BY signal`.execute(db);
    return r.rows.map((x) => ({ signal: x.signal, averageIntensity: Number(x.avg_intensity), observationCount: Number(x.n) }));
  },

  async learnerContext(db: Db, learnerId: string) {
    const r = await sql<{
      declared_interests: string[]; consent_status: string; date_of_birth: string | null; age_group: string;
      education_stage: string; learner_stage: string; learning_goal: string; current_role: string | null; target_role: string | null;
    }>`
      SELECT declared_interests, consent_status::text, date_of_birth::text, age_group, education_stage,
             learner_stage, learning_goal, "current_role", target_role
      FROM core.learner_profiles WHERE learner_id = ${learnerId}::uuid`.execute(db);
    return r.rows[0] ?? null;
  },

  async skillNodeIdsByCode(db: Db, codes: string[]) {
    if (!codes.length) return new Map<string, string>();
    const r = await sql<{ id: string; code: string }>`
      SELECT id, code FROM intelligence.graph_nodes WHERE code = ANY(${sql.val(codes)}::text[])`.execute(db);
    return new Map(r.rows.map((x) => [x.code, x.id]));
  },
};

/** Rubric support: signal rows (idempotent via deterministic ids) and lookup of an artifact's skills. */
export const rubricQueries = {
  async artifactSkillCodes(db: Db, artifactId: string, learnerId: string): Promise<string[]> {
    const r = await sql<{ codes: string[] }>`
      SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(payload->'skill_codes')), '{}') AS codes
      FROM evidence.artifacts WHERE id = ${artifactId}::uuid AND learner_id = ${learnerId}::uuid`.execute(db);
    return r.rows[0]?.codes ?? [];
  },

  async insertSignals(db: Db, rows: Array<{ id: string; mentorId: string; learnerId: string; artifactId: string | null;
    cohortId: string | null; signal: string; intensity: number; note: string | null; capturedOfflineAt: Date }>) {
    for (const s of rows) {
      await sql`INSERT INTO evidence.mentor_signal_observations
        (client_sync_id, mentor_id, learner_id, artifact_id, cohort_id, signal, intensity, note, captured_offline_at)
        VALUES (${s.id}::uuid, ${s.mentorId}::uuid, ${s.learnerId}::uuid, ${s.artifactId}::uuid, ${s.cohortId}::uuid,
          ${s.signal}, ${s.intensity}, ${s.note}, ${s.capturedOfflineAt.toISOString()}::timestamptz)
        ON CONFLICT (client_sync_id) DO NOTHING`.execute(db);
    }
  },
};

export const reportQueries = {
  async save(db: Db, p: { learnerId: string; snapshotAt: Date; report: unknown; guardrailPassed: boolean; model: string }) {
    const r = await sql<{ id: string; version: number }>`
      INSERT INTO intelligence.development_reports (learner_id, version, profile_snapshot_at, report, guardrail_passed, synthesis_model)
      SELECT ${p.learnerId}::uuid, COALESCE(MAX(version), 0) + 1, ${p.snapshotAt.toISOString()}::timestamptz,
             ${JSON.stringify(p.report)}::jsonb, ${p.guardrailPassed}, ${p.model}
      FROM intelligence.development_reports WHERE learner_id = ${p.learnerId}::uuid
      RETURNING id, version`.execute(db);
    return r.rows[0]!;
  },
  async latest(db: Db, learnerId: string) {
    const r = await sql<{ report: unknown }>`
      SELECT report FROM intelligence.development_reports WHERE learner_id = ${learnerId}::uuid
      ORDER BY version DESC LIMIT 1`.execute(db);
    return r.rows[0]?.report ?? null;
  },
};

/** Runs `fn` inside a transaction with the caller identity set (so RLS-aware functions see it). */
export async function withUserContext<T>(db: Db, userId: string, fn: (trx: Db) => Promise<T>): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userId })}, true)`.execute(trx);
    return fn(trx as unknown as Db);
  });
}

export const accessQueries = {
  async canAccessLearner(db: Db, userId: string, learnerId: string): Promise<boolean> {
    return withUserContext(db, userId, async (trx) => {
      const r = await sql<{ ok: boolean }>`SELECT core.fn_can_access_learner(${learnerId}::uuid) AS ok`.execute(trx);
      return r.rows[0]?.ok === true;
    });
  },
  async userById(db: Db, userId: string) {
    const r = await sql<{ id: string; role: string; organisation_id: string | null; is_active: boolean }>`
      SELECT id, role::text, organisation_id, is_active FROM core.users WHERE id = ${userId}::uuid`.execute(db);
    return r.rows[0] ?? null;
  },
};

export const onboardingQueries = {
  async onboard(db: Db, learnerId: string, p: {
    fullName: string;
    ageGroup: 'UNDER_18' | 'ADULT';
    dateOfBirth?: string;
    learnerStage: string;
    educationLevel?: string;
    learningGoal: string;
    currentRole?: string;
    targetRole?: string;
    schoolName?: string;
    declaredInterests: string[];
    guardian?: { fullName: string; email?: string; phoneNumber: string };
    whatsappOptIn: boolean;
    whatsappPhoneNumber?: string;
  }) {
    return db.transaction().execute(async (trx) => {
      const existing = await sql<{ guardian_id: string }>`
        SELECT primary_guardian_id AS guardian_id FROM core.learner_profiles WHERE learner_id = ${learnerId}::uuid
      `.execute(trx);
      if (existing.rows[0]) return { status: 'already_onboarded' as const, guardianId: existing.rows[0].guardian_id };

      const learner = await sql<{ id: string }>`
        INSERT INTO core.users (id, role, full_name)
        VALUES (${learnerId}::uuid, 'LEARNER'::core.user_role, ${p.fullName})
        ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name
        WHERE core.users.role = 'LEARNER' AND core.users.is_active
        RETURNING id
      `.execute(trx);
      if (!learner.rows[0]) return { status: 'learner_account_conflict' as const };

      let guardianId: string | null = null;
      if (p.guardian?.email) {
        const guardian = await sql<{ id: string }>`
          INSERT INTO core.users (role, full_name, email, phone_number)
          VALUES ('PARENT'::core.user_role, ${p.guardian.fullName}, ${p.guardian.email}, ${p.guardian.phoneNumber})
          ON CONFLICT (email) DO UPDATE
            SET full_name = EXCLUDED.full_name, phone_number = EXCLUDED.phone_number
            WHERE core.users.role = 'PARENT' AND core.users.is_active
          RETURNING id
        `.execute(trx);
        if (!guardian.rows[0]) return { status: 'guardian_account_conflict' as const };
        guardianId = guardian.rows[0].id;
      } else if (p.guardian) {
        const guardian = await sql<{ id: string }>`
          INSERT INTO core.users (role, full_name, phone_number)
          VALUES ('PARENT'::core.user_role, ${p.guardian.fullName}, ${p.guardian.phoneNumber})
          RETURNING id
        `.execute(trx);
        guardianId = guardian.rows[0]!.id;
      }

      const adult = p.ageGroup === 'ADULT';
      const consentStatus = adult ? 'VERIFIED_ACTIVE' : 'PENDING_PARENTAL_CONSENT';
      await sql`
        INSERT INTO core.learner_profiles
          (learner_id, date_of_birth, age_group, education_stage, learner_stage, education_level, learning_goal,
           "current_role", target_role, primary_guardian_id, consent_status, consent_verified_at,
           consent_verification_method, declared_interests, whatsapp_opt_in, whatsapp_phone_number)
        VALUES (
          ${learnerId}::uuid, ${p.dateOfBirth ?? null}::date, ${p.ageGroup}, ${p.educationLevel ?? 'Not specified'},
          ${p.learnerStage}, ${p.educationLevel ?? null}, ${p.learningGoal}, ${p.currentRole ?? null},
          ${p.targetRole ?? null}, ${guardianId}::uuid, ${consentStatus}::core.consent_status,
          ${adult ? sql`NOW()` : sql`NULL`}, ${adult ? 'ADULT_SELF_ATTESTATION' : null},
          ${sql.val(p.declaredInterests)}::text[], ${p.whatsappOptIn},
          ${p.whatsappOptIn ? p.whatsappPhoneNumber ?? null : null})
      `.execute(trx);

      if (adult && p.whatsappOptIn) {
        await sql`
          INSERT INTO core.messaging_preference_events (learner_id, actor_id, channel, purpose, opted_in, source)
          VALUES (${learnerId}::uuid, ${learnerId}::uuid, 'WHATSAPP', 'LEARNING_REMINDERS', TRUE, 'LEARNER_ONBOARDING')
        `.execute(trx);
      }

      return { status: 'created' as const, guardianId, consentStatus };
    });
  },

  async registerRole(
    db: Db,
    userId: string,
    p: {
      role: 'PARENT';
      fullName: string;
      email?: string;
      phoneNumber?: string;
    },
  ) {
    return db.transaction().execute(async (trx) => {
      const existing = await sql<{ id: string; role: string; organisation_id: string | null }>`
        SELECT id, role::text, organisation_id FROM core.users WHERE id = ${userId}::uuid FOR UPDATE
      `.execute(trx);

      if (existing.rows[0] && existing.rows[0].role !== p.role) {
        return { status: 'role_conflict' as const, existingRole: existing.rows[0].role };
      }

      const organisationId = existing.rows[0]?.organisation_id ?? null;

      await sql`
        INSERT INTO core.users (id, role, full_name, email, phone_number, organisation_id, is_active)
        VALUES (
          ${userId}::uuid,
          ${p.role}::core.user_role,
          ${p.fullName.trim()},
          ${p.email ?? null},
          ${p.phoneNumber ?? null},
          ${organisationId}::uuid,
          TRUE
        )
        ON CONFLICT (id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          email = COALESCE(EXCLUDED.email, core.users.email),
          phone_number = COALESCE(EXCLUDED.phone_number, core.users.phone_number),
          organisation_id = COALESCE(EXCLUDED.organisation_id, core.users.organisation_id)
      `.execute(trx);

      return {
        status: 'registered' as const,
        userId,
        role: p.role,
        organisationId,
      };
    });
  },

  async registerChild(
    db: Db,
    actor: { id: string; role: string; organisationId: string | null },
    p: {
      fullName: string;
      dateOfBirth: string;
      educationStage: string;
      learnerStage?: string;
      educationLevel?: string;
      learningGoal?: string;
      currentRole?: string;
      targetRole?: string;
      schoolName?: string;
      declaredInterests: string[];
      guardianName?: string;
      guardianPhone?: string;
      guardianEmail?: string;
      activateConsentImmediately?: boolean;
      allowPublicPortfolio?: boolean;
      allowPartnerTalentDiscovery?: boolean;
    },
  ) {
    return db.transaction().execute(async (trx) => {
      let guardianId: string;
      if (actor.role === 'PARENT') {
        guardianId = actor.id;
      } else {
        if (!p.guardianName || !p.guardianPhone) {
          return { status: 'missing_guardian_contact' as const };
        }
        if (p.guardianEmail) {
          const g = await sql<{ id: string }>`
            INSERT INTO core.users (role, full_name, email, phone_number)
            VALUES ('PARENT'::core.user_role, ${p.guardianName.trim()}, ${p.guardianEmail.trim()}, ${p.guardianPhone.trim()})
            ON CONFLICT (email) DO UPDATE
              SET full_name = EXCLUDED.full_name, phone_number = EXCLUDED.phone_number
              WHERE core.users.role = 'PARENT' AND core.users.is_active
            RETURNING id
          `.execute(trx);
          if (!g.rows[0]) return { status: 'guardian_account_conflict' as const };
          guardianId = g.rows[0].id;
        } else {
          const g = await sql<{ id: string }>`
            INSERT INTO core.users (role, full_name, phone_number)
            VALUES ('PARENT'::core.user_role, ${p.guardianName.trim()}, ${p.guardianPhone.trim()})
            RETURNING id
          `.execute(trx);
          guardianId = g.rows[0]!.id;
        }
      }

      let schoolId = actor.organisationId;
      if (!schoolId && p.schoolName?.trim()) {
        const org = await sql<{ id: string }>`
          INSERT INTO core.organisations (name, org_type, country_code, subscription_tier)
          VALUES (${p.schoolName.trim()}, 'SCHOOL', 'NG', 'FREE_PILOT')
          RETURNING id
        `.execute(trx);
        schoolId = org.rows[0]!.id;
      }

      const learnerUser = await sql<{ id: string }>`
        INSERT INTO core.users (role, full_name, organisation_id, is_active)
        VALUES ('LEARNER'::core.user_role, ${p.fullName.trim()}, ${schoolId}::uuid, TRUE)
        RETURNING id
      `.execute(trx);
      const learnerId = learnerUser.rows[0]!.id;

      const parentDirectVerify = actor.role === 'PARENT' && p.activateConsentImmediately === true;
      const consentStatus = parentDirectVerify ? 'VERIFIED_ACTIVE' : 'PENDING_PARENTAL_CONSENT';
      const allowPublic = parentDirectVerify && Boolean(p.allowPublicPortfolio);
      const allowPartner = parentDirectVerify && Boolean(p.allowPartnerTalentDiscovery);

      await sql`
        INSERT INTO core.learner_profiles (
          learner_id,
          date_of_birth,
          age_group,
          education_stage,
          learner_stage,
          education_level,
          learning_goal,
          "current_role",
          target_role,
          current_school_id,
          primary_guardian_id,
          consent_status,
          consent_verified_at,
          consent_verification_method,
          allow_public_portfolio,
          allow_partner_talent_discovery,
          declared_interests
        )
        VALUES (
          ${learnerId}::uuid,
          ${p.dateOfBirth}::date,
          'UNDER_18',
          ${p.educationStage.trim()},
          ${p.learnerStage ?? (p.educationStage.toLowerCase().includes('university') ? 'UNIVERSITY' : p.educationStage.toLowerCase().includes('formal education') ? 'NO_FORMAL_EDUCATION' : 'SECONDARY_SCHOOL')},
          ${p.educationLevel ?? p.educationStage.trim()},
          ${p.learningGoal ?? 'EXPLORE_INTERESTS'},
          ${p.currentRole ?? null},
          ${p.targetRole ?? null},
          ${schoolId}::uuid,
          ${guardianId}::uuid,
          ${consentStatus}::core.consent_status,
          ${parentDirectVerify ? sql`NOW()` : sql`NULL`},
          ${parentDirectVerify ? 'PARENT_DIRECT_REGISTRATION' : null},
          ${allowPublic},
          ${allowPartner},
          ${sql.val(p.declaredInterests)}::text[]
        )
      `.execute(trx);

      if (parentDirectVerify) {
        await sql`
          INSERT INTO evidence.parental_consent_audit (
            learner_id,
            guardian_id,
            consent_status,
            consent_verification_method,
            allow_public_portfolio,
            allow_partner_talent_discovery
          )
          VALUES (
            ${learnerId}::uuid,
            ${guardianId}::uuid,
            'VERIFIED_ACTIVE'::core.consent_status,
            'PARENT_DIRECT_REGISTRATION',
            ${allowPublic},
            ${allowPartner}
          )
        `.execute(trx);
      }

      return {
        status: 'created' as const,
        learnerId,
        fullName: p.fullName.trim(),
        educationStage: p.educationStage.trim(),
        consentStatus,
        accessCode: `SPK-${learnerId.slice(0, 8).toUpperCase()}`,
      };
    });
  },

  async listManagedLearners(db: Db, actor: { id: string; role: string; organisationId: string | null }) {
    const r =
      actor.role === 'PARENT'
        ? await sql<{
            learner_id: string;
            full_name: string;
            education_stage: string;
            date_of_birth: string;
            consent_status: string;
            whatsapp_opt_in: boolean;
            declared_interests: string[];
            school_name: string | null;
          }>`
            SELECT
              lp.learner_id,
              u.full_name,
              lp.education_stage,
              lp.date_of_birth::text,
              lp.consent_status::text,
              lp.whatsapp_opt_in,
              lp.declared_interests,
              o.name AS school_name
            FROM core.learner_profiles lp
            JOIN core.users u ON u.id = lp.learner_id
            LEFT JOIN core.organisations o ON o.id = lp.current_school_id
            WHERE lp.primary_guardian_id = ${actor.id}::uuid
              AND lp.age_group = 'UNDER_18'
              AND lp.date_of_birth > CURRENT_DATE - INTERVAL '18 years'
            ORDER BY lp.created_at DESC
          `.execute(db)
        : actor.organisationId
          ? await sql<{
              learner_id: string;
              full_name: string;
              education_stage: string;
              date_of_birth: string;
              consent_status: string;
              whatsapp_opt_in: boolean;
              declared_interests: string[];
              school_name: string | null;
            }>`
              SELECT
                lp.learner_id,
                u.full_name,
                lp.education_stage,
                lp.date_of_birth::text,
                lp.consent_status::text,
                lp.whatsapp_opt_in,
                lp.declared_interests,
                o.name AS school_name
              FROM core.learner_profiles lp
              JOIN core.users u ON u.id = lp.learner_id
              LEFT JOIN core.organisations o ON o.id = lp.current_school_id
              WHERE lp.current_school_id = ${actor.organisationId}::uuid
              ORDER BY lp.created_at DESC
            `.execute(db)
          : await sql<{
              learner_id: string;
              full_name: string;
              education_stage: string;
              date_of_birth: string;
              consent_status: string;
              whatsapp_opt_in: boolean;
              declared_interests: string[];
              school_name: string | null;
            }>`
              SELECT
                lp.learner_id,
                u.full_name,
                lp.education_stage,
                lp.date_of_birth::text,
                lp.consent_status::text,
                lp.whatsapp_opt_in,
                lp.declared_interests,
                o.name AS school_name
              FROM core.learner_profiles lp
              JOIN core.users u ON u.id = lp.learner_id
              LEFT JOIN core.organisations o ON o.id = lp.current_school_id
              ORDER BY lp.created_at DESC
              LIMIT 25
            `.execute(db);

    return r.rows.map((row) => ({
      learnerId: row.learner_id,
      fullName: row.full_name,
      educationStage: row.education_stage,
      dateOfBirth: row.date_of_birth,
      consentStatus: row.consent_status,
      whatsappOptIn: row.whatsapp_opt_in,
      declaredInterests: row.declared_interests ?? [],
      schoolName: row.school_name,
      accessCode: `SPK-${row.learner_id.slice(0, 8).toUpperCase()}`,
    }));
  },

  async bootstrapSuperAdmin(
    db: Db,
    userId: string,
    p: { fullName: string; email?: string },
  ) {
    await sql`
      INSERT INTO core.users (id, role, full_name, email, is_active)
      VALUES (${userId}::uuid, 'SUPER_ADMIN'::core.user_role, ${p.fullName.trim()}, ${p.email ?? null}, TRUE)
      ON CONFLICT (id) DO UPDATE SET
        role = 'SUPER_ADMIN'::core.user_role,
        full_name = EXCLUDED.full_name,
        email = COALESCE(EXCLUDED.email, core.users.email),
        is_active = TRUE
    `.execute(db);
    return { userId, role: 'SUPER_ADMIN' as const };
  },

  async provisionPrivilegedRole(
    db: Db,
    userId: string,
    p: {
      role: 'SCHOOL_ADMIN' | 'ORG_PARTNER' | 'MENTOR';
      fullName: string;
      email?: string;
      phoneNumber?: string;
      organisationName?: string;
      organisationType?: 'SCHOOL' | 'NGO' | 'TRAINING_PROVIDER' | 'EMPLOYER' | 'GOVERNMENT';
    },
  ) {
    return db.transaction().execute(async (trx) => {
      let organisationId: string | null = null;
      if (p.organisationName?.trim()) {
        const org = await sql<{ id: string }>`
          INSERT INTO core.organisations (name, org_type, country_code, subscription_tier)
          VALUES (
            ${p.organisationName.trim()},
            ${p.organisationType ?? 'SCHOOL'},
            'NG',
            'FREE_PILOT'
          )
          RETURNING id
        `.execute(trx);
        organisationId = org.rows[0]!.id;
      }

      await sql`
        INSERT INTO core.users (id, role, full_name, email, phone_number, organisation_id, is_active)
        VALUES (
          ${userId}::uuid,
          ${p.role}::core.user_role,
          ${p.fullName.trim()},
          ${p.email ?? null},
          ${p.phoneNumber ?? null},
          ${organisationId}::uuid,
          TRUE
        )
        ON CONFLICT (id) DO UPDATE SET
          role = EXCLUDED.role,
          full_name = EXCLUDED.full_name,
          email = COALESCE(EXCLUDED.email, core.users.email),
          phone_number = COALESCE(EXCLUDED.phone_number, core.users.phone_number),
          organisation_id = COALESCE(EXCLUDED.organisation_id, core.users.organisation_id),
          is_active = TRUE
      `.execute(trx);

      return {
        status: 'provisioned' as const,
        userId,
        role: p.role,
        organisationId,
      };
    });
  },

  async listInstitutionalAndMentorAccounts(db: Db) {
    const r = await sql<{
      id: string;
      role: string;
      full_name: string;
      email: string | null;
      phone_number: string | null;
      organisation_id: string | null;
      organisation_name: string | null;
      is_active: boolean;
      created_at: Date;
    }>`
      SELECT
        u.id,
        u.role::text,
        u.full_name,
        u.email,
        u.phone_number,
        u.organisation_id,
        o.name AS organisation_name,
        u.is_active,
        u.created_at
      FROM core.users u
      LEFT JOIN core.organisations o ON o.id = u.organisation_id
      WHERE u.role IN ('SCHOOL_ADMIN', 'ORG_PARTNER', 'MENTOR', 'SUPER_ADMIN')
      ORDER BY u.created_at DESC
      LIMIT 50
    `.execute(db);

    return r.rows.map((row) => ({
      userId: row.id,
      role: row.role,
      fullName: row.full_name,
      email: maskEmail(row.email),
      phoneNumber: maskPhone(row.phone_number),
      organisationId: row.organisation_id,
      organisationName: row.organisation_name,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
    }));
  },
};

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone || phone.trim().length < 4) return phone ?? null;
  const trimmed = phone.trim();
  if (trimmed.length <= 6) {
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-3)}`;
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return email ?? null;
  const [local, domain] = email.trim().split('@');
  if (!local || !domain) return email;
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}•••@${domain}`;
}

export function discoverAndRedactPii(text: string | null | undefined): {
  sanitizedText: string;
  findings: string[];
} {
  if (!text) return { sanitizedText: '', findings: [] };
  const findings: string[] = [];
  let sanitized = text;

  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  if (emailPattern.test(sanitized)) {
    findings.push('EMAIL_ADDRESS');
    sanitized = sanitized.replace(emailPattern, '[Redacted Email]');
  }

  const ninOrBvnPattern = /\b\d{11}\b/g;
  if (ninOrBvnPattern.test(sanitized)) {
    findings.push('NATIONAL_ID_OR_PHONE_11D');
    sanitized = sanitized.replace(ninOrBvnPattern, '[Redacted Contact/ID]');
  }

  const phonePattern = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?\d{3,4}[\s-]?\d{4})\b/g;
  if (phonePattern.test(sanitized)) {
    findings.push('PHONE_NUMBER');
    sanitized = sanitized.replace(phonePattern, '[Redacted Phone]');
  }

  return { sanitizedText: sanitized, findings };
}

export const consentQueries = {
  async recipient(db: Db, learnerId: string) {
    const r = await sql<{ guardian_id: string; phone_number: string | null; consent_status: string }>`
      SELECT u.id AS guardian_id, u.phone_number, lp.consent_status::text
      FROM core.learner_profiles lp
      JOIN core.users u ON u.id = lp.primary_guardian_id
      WHERE lp.learner_id = ${learnerId}::uuid
    `.execute(db);
    return r.rows[0] ?? null;
  },

  async createChallenge(db: Db, p: { id: string; learnerId: string; guardianId: string; otpHmac: string; expiresAt: Date }) {
    return db.transaction().execute(async (trx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${'consent:' + p.learnerId}))`.execute(trx);
      const recent = await sql<{ created_at: Date }>`
        SELECT created_at FROM evidence.parental_consent_challenges
        WHERE learner_id = ${p.learnerId}::uuid ORDER BY created_at DESC LIMIT 1
      `.execute(trx);
      if (recent.rows[0] && Date.now() - recent.rows[0].created_at.getTime() < 60_000) return null;
      await sql`
        UPDATE evidence.parental_consent_challenges SET consumed_at = NOW()
        WHERE learner_id = ${p.learnerId}::uuid AND consumed_at IS NULL
      `.execute(trx);
      await sql`
        UPDATE core.learner_profiles
        SET consent_status = 'PENDING_PARENTAL_CONSENT'::core.consent_status,
            consent_verified_at = NULL, consent_verification_method = NULL,
            allow_public_portfolio = FALSE, allow_partner_talent_discovery = FALSE
        WHERE learner_id = ${p.learnerId}::uuid AND primary_guardian_id = ${p.guardianId}::uuid
      `.execute(trx);
      const r = await sql<{ id: string }>`
        INSERT INTO evidence.parental_consent_challenges (id, learner_id, guardian_id, otp_hmac, expires_at)
        VALUES (${p.id}::uuid, ${p.learnerId}::uuid, ${p.guardianId}::uuid, ${p.otpHmac}, ${p.expiresAt.toISOString()}::timestamptz)
        RETURNING id
      `.execute(trx);
      return r.rows[0]!.id;
    });
  },

  async discardChallenge(db: Db, challengeId: string) {
    await sql`DELETE FROM evidence.parental_consent_challenges WHERE id = ${challengeId}::uuid AND consumed_at IS NULL`.execute(db);
  },

  async verify(db: Db, p: {
    challengeId: string;
    otpHmac: string;
    consentGiven: boolean;
    allowPublicPortfolio: boolean;
    allowPartnerTalentDiscovery: boolean;
  }) {
    return db.transaction().execute(async (trx) => {
      const r = await sql<{ learner_id: string; guardian_id: string; otp_hmac: string; expires_at: Date;
        failed_attempts: number; consumed_at: Date | null; consent_given: boolean | null }>`
        SELECT learner_id, guardian_id, otp_hmac, expires_at, failed_attempts, consumed_at, consent_given
        FROM evidence.parental_consent_challenges
        WHERE id = ${p.challengeId}::uuid FOR UPDATE
      `.execute(trx);
      const challenge = r.rows[0];
      if (!challenge) return { status: 'not_found' as const };
      const stored = Buffer.from(challenge.otp_hmac, 'hex');
      const supplied = Buffer.from(p.otpHmac, 'hex');
      const valid = stored.length === supplied.length && timingSafeEqual(stored, supplied);
      if (!valid) {
        if (challenge.consumed_at) return { status: 'expired' as const };
        const attempts = challenge.failed_attempts + 1;
        await sql`
          UPDATE evidence.parental_consent_challenges
          SET failed_attempts = ${attempts}, consumed_at = CASE WHEN ${attempts} >= 5 THEN NOW() ELSE NULL END
          WHERE id = ${p.challengeId}::uuid
        `.execute(trx);
        return { status: attempts >= 5 ? 'expired' as const : 'invalid' as const };
      }
      if (challenge.consumed_at) {
        if (challenge.consent_given !== null) {
          return { status: challenge.consent_given ? 'already_verified' as const : 'already_declined' as const };
        }
        return { status: 'expired' as const };
      }
      if (challenge.expires_at.getTime() <= Date.now() || challenge.failed_attempts >= 5) {
        await sql`UPDATE evidence.parental_consent_challenges SET consumed_at = NOW() WHERE id = ${p.challengeId}::uuid`.execute(trx);
        return { status: 'expired' as const };
      }

      const consentStatus = p.consentGiven ? 'VERIFIED_ACTIVE' : 'REVOKED';
      const profile = await sql`
        UPDATE core.learner_profiles
        SET consent_status = ${consentStatus}::core.consent_status,
            consent_verified_at = NOW(), consent_verification_method = 'SMS_OTP',
            allow_public_portfolio = ${p.consentGiven && p.allowPublicPortfolio},
            allow_partner_talent_discovery = ${p.consentGiven && p.allowPartnerTalentDiscovery}
        WHERE learner_id = ${challenge.learner_id}::uuid AND primary_guardian_id = ${challenge.guardian_id}::uuid
        RETURNING learner_id
      `.execute(trx);
      if (!profile.rows[0]) return { status: 'not_found' as const };

      await sql`
        UPDATE evidence.parental_consent_challenges
        SET consumed_at = NOW(), consent_given = ${p.consentGiven},
            allow_public_portfolio = ${p.consentGiven && p.allowPublicPortfolio},
            allow_partner_talent_discovery = ${p.consentGiven && p.allowPartnerTalentDiscovery}
        WHERE id = ${p.challengeId}::uuid
      `.execute(trx);
      await sql`
        INSERT INTO evidence.parental_consent_audit
          (learner_id, guardian_id, consent_status, consent_verification_method,
           allow_public_portfolio, allow_partner_talent_discovery, challenge_id)
        VALUES (${challenge.learner_id}::uuid, ${challenge.guardian_id}::uuid,
          ${consentStatus}::core.consent_status, 'SMS_OTP',
          ${p.consentGiven && p.allowPublicPortfolio}, ${p.consentGiven && p.allowPartnerTalentDiscovery},
          ${p.challengeId}::uuid)
      `.execute(trx);
      return { status: p.consentGiven ? 'verified' as const : 'declined' as const };
    });
  },

  async getPreferences(db: Db, learnerId: string) {
    const r = await sql<{
      learner_id: string;
      consent_status: string;
      consent_verified_at: Date | null;
      allow_public_portfolio: boolean;
      allow_partner_talent_discovery: boolean;
    }>`
      SELECT
        learner_id,
        consent_status::text,
        consent_verified_at,
        allow_public_portfolio,
        allow_partner_talent_discovery
      FROM core.learner_profiles
      WHERE learner_id = ${learnerId}::uuid
    `.execute(db);
    const row = r.rows[0];
    if (!row) return null;
    return {
      learnerId: row.learner_id,
      consentStatus: row.consent_status,
      consentVerifiedAt: row.consent_verified_at ? row.consent_verified_at.toISOString() : null,
      allowPublicPortfolio: row.allow_public_portfolio,
      allowPartnerTalentDiscovery: row.allow_partner_talent_discovery,
    };
  },

  async updatePreferences(
    db: Db,
    p: {
      learnerId: string;
      consentStatus: 'VERIFIED_ACTIVE' | 'RESTRICTED_INTERNAL_ONLY' | 'REVOKED';
      allowPublicPortfolio: boolean;
      allowPartnerTalentDiscovery: boolean;
    },
  ) {
    return db.transaction().execute(async (trx) => {
      const current = await sql<{ consent_status: string }>`
        SELECT consent_status::text
        FROM core.learner_profiles
        WHERE learner_id = ${p.learnerId}::uuid
        FOR UPDATE
      `.execute(trx);
      const cur = current.rows[0];
      if (!cur) return { status: 'not_found' as const };

      if (p.consentStatus === 'VERIFIED_ACTIVE' && cur.consent_status !== 'VERIFIED_ACTIVE') {
        return { status: 'requires_sms_verification' as const };
      }

      const isVerified = p.consentStatus === 'VERIFIED_ACTIVE';
      const allowPublic = isVerified && p.allowPublicPortfolio;
      const allowPartner = isVerified && p.allowPartnerTalentDiscovery;

      const r = await sql<{
        learner_id: string;
        consent_status: string;
        allow_public_portfolio: boolean;
        allow_partner_talent_discovery: boolean;
      }>`
        UPDATE core.learner_profiles
        SET consent_status = ${p.consentStatus}::core.consent_status,
            allow_public_portfolio = ${allowPublic},
            allow_partner_talent_discovery = ${allowPartner},
            updated_at = NOW()
        WHERE learner_id = ${p.learnerId}::uuid
        RETURNING learner_id, consent_status::text, allow_public_portfolio, allow_partner_talent_discovery
      `.execute(trx);

      const row = r.rows[0]!;
      return {
        status: 'updated' as const,
        learnerId: row.learner_id,
        consentStatus: row.consent_status,
        allowPublicPortfolio: row.allow_public_portfolio,
        allowPartnerTalentDiscovery: row.allow_partner_talent_discovery,
      };
    });
  },
};


export const learningQueries = {
  async updateWhatsAppPreference(
    db: Db,
    p: { learnerId: string; actorId: string; actorRole: 'LEARNER' | 'PARENT'; optIn: boolean; phoneNumber?: string },
  ) {
    return db.transaction().execute(async (trx) => {
      const r = await sql<{ learner_id: string; whatsapp_opt_in: boolean }>`
        UPDATE core.learner_profiles
        SET whatsapp_opt_in = ${p.optIn},
            whatsapp_phone_number = ${p.optIn ? p.phoneNumber ?? null : null},
            updated_at = NOW()
        WHERE learner_id = ${p.learnerId}::uuid
          AND (
            (${p.actorRole} = 'LEARNER' AND learner_id = ${p.actorId}::uuid
              AND (age_group = 'ADULT' OR date_of_birth <= CURRENT_DATE - INTERVAL '18 years'))
            OR (${p.actorRole} = 'PARENT' AND primary_guardian_id = ${p.actorId}::uuid
              AND age_group = 'UNDER_18' AND date_of_birth > CURRENT_DATE - INTERVAL '18 years'
              AND consent_status = 'VERIFIED_ACTIVE'::core.consent_status)
          )
        RETURNING learner_id, whatsapp_opt_in
      `.execute(trx);
      const row = r.rows[0];
      if (!row) return { status: 'not_found_or_minor' as const };
      await sql`
        INSERT INTO core.messaging_preference_events (learner_id, actor_id, channel, purpose, opted_in, source)
        VALUES (${p.learnerId}::uuid, ${p.actorId}::uuid, 'WHATSAPP', 'LEARNING_REMINDERS', ${p.optIn},
          ${p.actorRole === 'PARENT' ? 'GUARDIAN_SETTINGS' : 'LEARNER_SETTINGS'})
      `.execute(trx);
      return { status: 'updated' as const, learnerId: row.learner_id, whatsappOptIn: row.whatsapp_opt_in };
    });
  },

  async skillCatalogue(db: Db) {
    const r = await sql<{ id: string; code: string; name: string; category: string | null; description: string }>`
      SELECT id, code, name, category::text, description
      FROM intelligence.graph_nodes
      WHERE node_type = 'SKILL'
      ORDER BY category, name
    `.execute(db);
    return r.rows;
  },

  async learnerSummary(db: Db, learnerId: string) {
    const r = await sql<{
      learner_id: string;
      full_name: string;
      date_of_birth: string | null;
      age_group: string;
      education_stage: string;
      learner_stage: string;
      education_level: string | null;
      learning_goal: string;
      current_role: string | null;
      target_role: string | null;
      whatsapp_opt_in: boolean;
      school_name: string | null;
      consent_status: string;
      declared_interests: string[];
      allow_public_portfolio: boolean;
      total_artifacts: string;
      last_evidence_date: Date | null;
    }>`
      SELECT
        lp.learner_id,
        u.full_name,
        lp.date_of_birth::text,
        CASE WHEN lp.age_group = 'ADULT' OR lp.date_of_birth <= CURRENT_DATE - INTERVAL '18 years'
          THEN 'ADULT' ELSE 'UNDER_18' END AS age_group,
        lp.education_stage,
        lp.learner_stage,
        lp.education_level,
        lp.learning_goal,
        lp."current_role",
        lp.target_role,
        lp.whatsapp_opt_in,
        org.name AS school_name,
        lp.consent_status::text,
        lp.declared_interests,
        lp.allow_public_portfolio,
        COUNT(a.id)::text AS total_artifacts,
        MAX(a.synced_at) AS last_evidence_date
      FROM core.learner_profiles lp
      JOIN core.users u ON u.id = lp.learner_id
      LEFT JOIN core.organisations org ON org.id = lp.current_school_id
      LEFT JOIN evidence.artifacts a ON a.learner_id = lp.learner_id
      WHERE lp.learner_id = ${learnerId}::uuid
      GROUP BY lp.learner_id, u.full_name, lp.date_of_birth, lp.age_group, lp.education_stage,
               lp.learner_stage, lp.education_level, lp.learning_goal, lp."current_role", lp.target_role, lp.whatsapp_opt_in, org.name,
               lp.consent_status, lp.declared_interests, lp.allow_public_portfolio
    `.execute(db);
    const row = r.rows[0];
    if (!row) return null;
    return {
      learnerId: row.learner_id,
      fullName: row.full_name,
      dateOfBirth: row.date_of_birth,
      ageGroup: row.age_group,
      educationStage: row.education_stage,
      learnerStage: row.learner_stage,
      educationLevel: row.education_level,
      learningGoal: row.learning_goal,
      currentRole: row.current_role,
      targetRole: row.target_role,
      whatsappOptIn: row.whatsapp_opt_in,
      schoolName: row.school_name,
      consentStatus: row.consent_status,
      declaredInterests: row.declared_interests ?? [],
      allowPublicPortfolio: row.allow_public_portfolio,
      totalArtifacts: Number(row.total_artifacts),
      lastEvidenceDate: row.last_evidence_date ? row.last_evidence_date.toISOString() : null,
    };
  },

  async learnerArtifacts(db: Db, learnerId: string) {
    const r = await sql<{
      id: string;
      client_sync_id: string;
      artifact_type: string;
      title: string;
      description: string | null;
      external_urls: string[];
      skill_codes: string[];
      quality_score: string | null;
      mentor_verified: boolean;
      captured_offline_at: Date;
      ledger_seq: string | null;
      row_signature_hash: string | null;
    }>`
      SELECT
        a.id,
        a.client_sync_id,
        a.artifact_type::text,
        a.title,
        a.description,
        a.external_urls,
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(a.payload->'skill_codes')), '{}') AS skill_codes,
        a.quality_score::text,
        (a.mentor_verifier_id IS NOT NULL) AS mentor_verified,
        a.captured_offline_at,
        cl.ledger_seq::text,
        cl.row_signature_hash
      FROM evidence.artifacts a
      LEFT JOIN evidence.cryptographic_ledger cl ON cl.artifact_id = a.id
      WHERE a.learner_id = ${learnerId}::uuid
      ORDER BY a.captured_offline_at DESC
    `.execute(db);
    return r.rows.map((row) => ({
      id: row.id,
      clientSyncId: row.client_sync_id,
      artifactType: row.artifact_type,
      title: row.title,
      description: row.description,
      externalUrls: row.external_urls ?? [],
      skillCodes: row.skill_codes ?? [],
      qualityScore: row.quality_score !== null ? Number(row.quality_score) : null,
      mentorVerified: row.mentor_verified,
      capturedOfflineAt: row.captured_offline_at.toISOString(),
      ledgerSeq: row.ledger_seq !== null ? Number(row.ledger_seq) : null,
      rowSignatureHash: row.row_signature_hash,
    }));
  },

  async publicPortfolio(db: Db, learnerId: string) {
    return buildPublicPortfolio(db, sql`lp.learner_id = ${learnerId}::uuid`);
  },

  /** Public lookup by opaque share token. Never returns the learner UUID. */
  async publicPortfolioByShareToken(db: Db, token: string) {
    if (!SHARE_TOKEN_PATTERN.test(token)) return { status: 'not_found' as const };
    const res = await buildPublicPortfolio(db, sql`lp.public_share_token = ${token}`);
    if (res.status !== 'public') return res;
    const { learnerId: _omit, ...profile } = res.profile;
    return { ...res, profile };
  },

  /** Returns the current share link state for a learner (owner/guardian view). */
  async getShareLink(db: Db, learnerId: string) {
    const r = await sql<{
      public_share_token: string | null;
      public_share_token_created_at: Date | null;
      allow_public_portfolio: boolean;
      consent_status: string;
    }>`
      SELECT public_share_token, public_share_token_created_at, allow_public_portfolio, consent_status::text
      FROM core.learner_profiles
      WHERE learner_id = ${learnerId}::uuid
    `.execute(db);
    const row = r.rows[0];
    if (!row) return { status: 'not_found' as const };
    const eligible = row.consent_status === 'VERIFIED_ACTIVE' && row.allow_public_portfolio;
    return {
      status: 'ok' as const,
      eligible,
      token: row.public_share_token,
      createdAt: row.public_share_token_created_at ? row.public_share_token_created_at.toISOString() : null,
    };
  },

  /**
   * Creates (or, with rotate=true, replaces) the share token. Only succeeds while
   * consent is verified and public sharing is on; the DB trigger and CHECK
   * constraint enforce the same rule independently.
   */
  async issueShareLink(db: Db, learnerId: string, rotate: boolean) {
    return db.transaction().execute(async (trx) => {
      const cur = await sql<{ public_share_token: string | null; allow_public_portfolio: boolean; consent_status: string }>`
        SELECT public_share_token, allow_public_portfolio, consent_status::text
        FROM core.learner_profiles
        WHERE learner_id = ${learnerId}::uuid
        FOR UPDATE
      `.execute(trx);
      const row = cur.rows[0];
      if (!row) return { status: 'not_found' as const };
      if (row.consent_status !== 'VERIFIED_ACTIVE' || !row.allow_public_portfolio) {
        return { status: 'sharing_disabled' as const };
      }
      if (row.public_share_token && !rotate) {
        return { status: 'ok' as const, token: row.public_share_token };
      }
      const token = randomBytes(18).toString('base64url');
      await sql`
        UPDATE core.learner_profiles
        SET public_share_token = ${token}, public_share_token_created_at = NOW(), updated_at = NOW()
        WHERE learner_id = ${learnerId}::uuid
      `.execute(trx);
      return { status: 'ok' as const, token };
    });
  },

  async revokeShareLink(db: Db, learnerId: string) {
    const r = await sql<{ learner_id: string }>`
      UPDATE core.learner_profiles
      SET public_share_token = NULL, public_share_token_created_at = NULL, updated_at = NOW()
      WHERE learner_id = ${learnerId}::uuid
      RETURNING learner_id
    `.execute(db);
    return r.rows[0] ? { status: 'revoked' as const } : { status: 'not_found' as const };
  },
};

const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;

async function buildPublicPortfolio(db: Db, where: RawBuilder<unknown>) {
  const profileRes = await sql<{
    learner_id: string;
    full_name: string;
    education_stage: string;
    school_name: string | null;
    consent_status: string;
    allow_public_portfolio: boolean;
    declared_interests: string[];
  }>`
    SELECT
      lp.learner_id,
      u.full_name,
      lp.education_stage,
      o.name AS school_name,
      lp.consent_status::text,
      lp.allow_public_portfolio,
      lp.declared_interests
    FROM core.learner_profiles lp
    JOIN core.users u ON u.id = lp.learner_id
    LEFT JOIN core.organisations o ON o.id = lp.current_school_id
    WHERE ${where}
  `.execute(db);

  const row = profileRes.rows[0];
  if (!row) return { status: 'not_found' as const };
  if (row.consent_status !== 'VERIFIED_ACTIVE' || !row.allow_public_portfolio) {
    return { status: 'private' as const };
  }

  const [skills, artifacts] = await Promise.all([
    bitemporalQueries.profileAsOf(db, row.learner_id, new Date()),
    learningQueries.learnerArtifacts(db, row.learner_id),
  ]);

  const firstName = row.full_name.trim().split(/\s+/)[0] ?? 'Explorer';
  return {
    status: 'public' as const,
    profile: {
      learnerId: row.learner_id,
      displayName: `${firstName} (${row.education_stage})`,
      educationStage: row.education_stage,
      schoolName: row.school_name,
      declaredInterests: row.declared_interests ?? [],
    },
    skills,
    artifacts,
  };
}

export const mentorshipQueries = {
  async pendingQueue(
    db: Db,
    actor: {
      userId: string;
      role: 'LEARNER' | 'PARENT' | 'MENTOR' | 'SCHOOL_ADMIN' | 'ORG_PARTNER' | 'SUPER_ADMIN';
      organisationId: string | null;
    },
    limit = 25,
  ) {
    const accessScope =
      actor.role === 'MENTOR'
        ? sql`EXISTS (
            SELECT 1
            FROM core.mentor_assignments ma
            WHERE ma.mentor_id = ${actor.userId}::uuid
              AND ma.is_active = TRUE
              AND (
                ma.learner_id = a.learner_id
                OR (
                  ma.learner_id IS NULL
                  AND (
                    ma.cohort_id = a.programme_cohort_id
                    OR EXISTS (
                      SELECT 1
                      FROM core.cohort_enrolments ce
                      WHERE ce.learner_id = a.learner_id
                        AND ce.cohort_id = ma.cohort_id
                    )
                  )
                )
              )
          )`
        : actor.role === 'SCHOOL_ADMIN'
          ? sql`lp.current_school_id = ${actor.organisationId}::uuid`
          : actor.role === 'SUPER_ADMIN'
            ? sql`TRUE`
            : sql`FALSE`;

    const r = await sql<{
      artifact_id: string;
      learner_id: string;
      learner_name: string;
      education_stage: string;
      artifact_type: string;
      title: string;
      description: string | null;
      skill_codes: string[];
      complexity_weight: string;
      captured_offline_at: Date;
      ledger_seq: string | null;
      row_signature_hash: string | null;
    }>`
      SELECT
        a.id AS artifact_id,
        a.learner_id,
        u.full_name AS learner_name,
        lp.education_stage,
        a.artifact_type::text,
        a.title,
        a.description,
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(a.payload->'skill_codes')), '{}') AS skill_codes,
        a.complexity_weight::text,
        a.captured_offline_at,
        cl.ledger_seq::text,
        cl.row_signature_hash
      FROM evidence.artifacts a
      JOIN core.learner_profiles lp ON lp.learner_id = a.learner_id
      JOIN core.users u ON u.id = a.learner_id
      LEFT JOIN evidence.cryptographic_ledger cl ON cl.artifact_id = a.id
      WHERE a.mentor_verifier_id IS NULL
        AND lp.consent_status = 'VERIFIED_ACTIVE'
        AND (${accessScope})
      ORDER BY a.captured_offline_at DESC
      LIMIT ${limit}
    `.execute(db);

    return r.rows.map((row) => ({
      artifactId: row.artifact_id,
      learnerId: row.learner_id,
      learnerName: row.learner_name,
      educationStage: row.education_stage,
      artifactType: row.artifact_type,
      title: row.title,
      description: row.description,
      skillCodes: row.skill_codes ?? [],
      complexityWeight: Number(row.complexity_weight),
      capturedOfflineAt: row.captured_offline_at.toISOString(),
      ledgerSeq: row.ledger_seq !== null ? Number(row.ledger_seq) : null,
      rowSignatureHash: row.row_signature_hash,
    }));
  },

  async verifyArtifact(
    db: Db,
    p: {
      artifactId: string;
      mentorId: string;
      actorRole: 'LEARNER' | 'PARENT' | 'MENTOR' | 'SCHOOL_ADMIN' | 'ORG_PARTNER' | 'SUPER_ADMIN';
      qualityScore: number;
    },
  ) {
    return db.transaction().execute(async (trx) => {
      const updated = await sql<{ id: string; learner_id: string }>`
        UPDATE evidence.artifacts a
        SET mentor_verifier_id = ${p.mentorId}::uuid,
            quality_score = ${p.qualityScore}
        FROM core.learner_profiles lp
        WHERE a.id = ${p.artifactId}::uuid
          AND lp.learner_id = a.learner_id
          AND lp.consent_status = 'VERIFIED_ACTIVE'
          AND (
            ${p.actorRole === 'SUPER_ADMIN'}
            OR (
              ${p.actorRole === 'MENTOR'}
              AND EXISTS (
              SELECT 1
              FROM core.mentor_assignments ma
              WHERE ma.mentor_id = ${p.mentorId}::uuid
                AND ma.is_active = TRUE
                AND (
                  ma.learner_id = a.learner_id
                  OR (
                    ma.learner_id IS NULL
                    AND (
                      ma.cohort_id = a.programme_cohort_id
                      OR EXISTS (
                        SELECT 1
                        FROM core.cohort_enrolments ce
                        WHERE ce.learner_id = a.learner_id
                          AND ce.cohort_id = ma.cohort_id
                        )
                      )
                    )
                  )
                )
            )
          )
        RETURNING a.id, a.learner_id
      `.execute(trx);

      const row = updated.rows[0];
      if (!row) return null;
      return { artifactId: row.id, learnerId: row.learner_id };
    });
  },

  async assignMentor(
    db: Db,
    p: {
      mentorId: string;
      cohortId: string;
      learnerId?: string | null;
      actor: { id: string; role: string; organisationId: string | null };
    },
  ) {
    return db.transaction().execute(async (trx) => {
      const ins = await sql<{ id: string }>`
        INSERT INTO core.mentor_assignments (mentor_id, cohort_id, learner_id, is_active)
        SELECT mentor.id, cohort.id, ${p.learnerId ?? null}::uuid, TRUE
        FROM core.users mentor
        JOIN core.programme_cohorts cohort ON cohort.id = ${p.cohortId}::uuid
        JOIN core.users actor ON actor.id = ${p.actor.id}::uuid
        WHERE mentor.id = ${p.mentorId}::uuid
          AND mentor.role = 'MENTOR'::core.user_role
          AND mentor.is_active = TRUE
          AND actor.is_active = TRUE
          AND (
            actor.role = 'SUPER_ADMIN'::core.user_role
            OR (
              actor.role = 'SCHOOL_ADMIN'::core.user_role
              AND cohort.organisation_id = actor.organisation_id
              AND (
                ${p.learnerId ?? null}::uuid IS NULL
                OR EXISTS (
                  SELECT 1
                  FROM core.learner_profiles lp
                  JOIN core.cohort_enrolments ce ON ce.learner_id = lp.learner_id
                  WHERE lp.learner_id = ${p.learnerId ?? null}::uuid
                    AND lp.current_school_id = actor.organisation_id
                    AND ce.cohort_id = cohort.id
                )
              )
            )
          )
        ON CONFLICT (mentor_id, cohort_id, COALESCE(learner_id, '00000000-0000-0000-0000-000000000000'::uuid))
        DO UPDATE SET is_active = TRUE
        RETURNING id
      `.execute(trx);

      return ins.rows[0] ? { assignmentId: ins.rows[0].id } : null;
    });
  },
};

export const billingQueries = {
  async listCohorts(db: Db) {
    const r = await sql<{
      id: string;
      organisation_id: string | null;
      organisation_name: string | null;
      title: string;
      description: string | null;
      programme_type: string;
      start_date: string;
      end_date: string;
      max_capacity: number;
      current_enrolment_count: number;
      price_ngn: number | null;
      price_usd: number | null;
      is_active: boolean;
    }>`
      SELECT
        c.id,
        c.organisation_id,
        o.name AS organisation_name,
        c.title,
        c.description,
        c.programme_type::text,
        c.start_date::text,
        c.end_date::text,
        c.max_capacity,
        c.current_enrolment_count,
        c.price_ngn,
        c.price_usd,
        c.is_active
      FROM core.programme_cohorts c
      LEFT JOIN core.organisations o ON o.id = c.organisation_id
      ORDER BY c.start_date DESC, c.created_at DESC
    `.execute(db);

    return r.rows.map((row) => ({
      id: row.id,
      organisationId: row.organisation_id,
      organisationName: row.organisation_name,
      title: row.title,
      description: row.description,
      programmeType: row.programme_type,
      startDate: row.start_date,
      endDate: row.end_date,
      maxCapacity: row.max_capacity,
      currentEnrolmentCount: row.current_enrolment_count,
      priceNgn: row.price_ngn,
      priceUsd: row.price_usd,
      isActive: row.is_active,
    }));
  },

  async createCohort(
    db: Db,
    p: {
      organisationId?: string | null;
      title: string;
      description?: string;
      programmeType: 'HOLIDAY_CAMP' | 'SCHOOL_TERM_COCURRICULAR' | 'WEEKEND_WORKSHOP' | 'ONLINE_COHORT';
      startDate: string;
      endDate: string;
      maxCapacity: number;
      priceNgn?: number | null;
      priceUsd?: number | null;
    },
  ) {
    const r = await sql<{ id: string }>`
      INSERT INTO core.programme_cohorts (
        organisation_id, title, description, programme_type,
        start_date, end_date, max_capacity, price_ngn, price_usd
      )
      VALUES (
        ${p.organisationId ?? null}::uuid,
        ${p.title},
        ${p.description ?? null},
        ${p.programmeType}::core.programme_type,
        ${p.startDate}::date,
        ${p.endDate}::date,
        ${p.maxCapacity},
        ${p.priceNgn ?? null},
        ${p.priceUsd ?? null}
      )
      RETURNING id
    `.execute(db);
    return { cohortId: r.rows[0]!.id };
  },

  async enrolLearner(
    db: Db,
    p: {
      learnerId: string;
      cohortId: string;
      paymentProvider: 'PAYSTACK' | 'STRIPE' | 'INSTITUTIONAL_INVOICE';
      paymentReference?: string | null;
      paymentAmount?: number | null;
      paymentCurrency?: string;
      enrolledBy: string;
    },
  ) {
    return db.transaction().execute(async (trx) => {
      const cohortRes = await sql<{
        id: string;
        price_ngn: number | null;
        price_usd: number | null;
        max_capacity: number;
        current_enrolment_count: number;
        is_active: boolean;
      }>`
        SELECT id, price_ngn, price_usd, max_capacity, current_enrolment_count, is_active
        FROM core.programme_cohorts
        WHERE id = ${p.cohortId}::uuid
        FOR UPDATE
      `.execute(trx);

      const cohort = cohortRes.rows[0];
      if (!cohort || !cohort.is_active) {
        return {
          status: 'cohort_not_active' as const,
          enrolmentId: null,
          enrolmentStatus: null,
          alreadyEnrolled: false,
        };
      }

      const existing = await sql<{
        id: string;
        enrolment_status: string;
        payment_reference: string | null;
        payment_amount: number | null;
        payment_currency: string | null;
      }>`
        SELECT id, enrolment_status::text, payment_reference, payment_amount, payment_currency
        FROM core.cohort_enrolments
        WHERE learner_id = ${p.learnerId}::uuid AND cohort_id = ${p.cohortId}::uuid
        FOR UPDATE
      `.execute(trx);

      if (existing.rows[0]) {
        return {
          status: 'existing' as const,
          enrolmentId: existing.rows[0].id,
          enrolmentStatus: existing.rows[0].enrolment_status,
          paymentReference: existing.rows[0].payment_reference,
          paymentAmount: existing.rows[0].payment_amount,
          paymentCurrency: existing.rows[0].payment_currency ?? 'NGN',
          alreadyEnrolled: true,
        };
      }

      if (cohort.current_enrolment_count >= cohort.max_capacity) {
        return {
          status: 'cohort_full' as const,
          enrolmentId: null,
          enrolmentStatus: null,
          alreadyEnrolled: false,
        };
      }

      const currency = (p.paymentCurrency ?? 'NGN').toUpperCase();
      const catalogPrice = currency === 'USD' ? cohort.price_usd : cohort.price_ngn;
      const authoritativeAmount =
        catalogPrice !== null && catalogPrice > 0
          ? Math.max(catalogPrice, p.paymentAmount ?? catalogPrice)
          : (p.paymentAmount ?? null);
      const reference =
        p.paymentReference?.trim() ||
        `SPK-${p.paymentProvider.slice(0, 3)}-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

      const ins = await sql<{ id: string; enrolment_status: string }>`
        INSERT INTO core.cohort_enrolments (
          learner_id, cohort_id, enrolled_by, enrolment_status, payment_provider,
          payment_reference, payment_amount, payment_currency
        )
        VALUES (
          ${p.learnerId}::uuid,
          ${p.cohortId}::uuid,
          ${p.enrolledBy}::uuid,
          'PENDING_PAYMENT'::core.enrolment_status,
          ${p.paymentProvider}::core.payment_provider,
          ${reference},
          ${authoritativeAmount},
          ${currency}
        )
        RETURNING id, enrolment_status::text
      `.execute(trx);

      return {
        status: 'created' as const,
        enrolmentId: ins.rows[0]!.id,
        enrolmentStatus: ins.rows[0]!.enrolment_status,
        paymentReference: reference,
        paymentAmount: authoritativeAmount,
        paymentCurrency: currency,
        alreadyEnrolled: false,
      };
    });
  },

  async confirmPaymentByReference(
    db: Db,
    p: {
      paymentProvider: 'PAYSTACK' | 'STRIPE' | 'INSTITUTIONAL_INVOICE';
      paymentReference: string;
      paymentAmount?: number;
    },
  ) {
    return db.transaction().execute(async (trx) => {
      const cur = await sql<{
        id: string;
        learner_id: string;
        cohort_id: string;
        enrolment_status: string;
        payment_amount: number | null;
      }>`
        SELECT id, learner_id, cohort_id, enrolment_status::text, payment_amount
        FROM core.cohort_enrolments
        WHERE payment_provider = ${p.paymentProvider}::core.payment_provider
          AND payment_reference = ${p.paymentReference}
        FOR UPDATE
      `.execute(trx);

      const row = cur.rows[0];
      if (!row) return { status: 'not_found' as const };
      if (row.enrolment_status === 'ACTIVE' || row.enrolment_status === 'CONFIRMED') {
        return {
          status: 'already_processed' as const,
          enrolmentId: row.id,
          learnerId: row.learner_id,
          cohortId: row.cohort_id,
        };
      }

      if (
        row.payment_amount !== null &&
        row.payment_amount > 0 &&
        p.paymentAmount !== undefined &&
        p.paymentAmount < row.payment_amount
      ) {
        return {
          status: 'amount_mismatch' as const,
          enrolmentId: row.id,
          expectedAmount: row.payment_amount,
          receivedAmount: p.paymentAmount,
        };
      }

      await sql`
        UPDATE core.cohort_enrolments
        SET enrolment_status = 'ACTIVE'::core.enrolment_status,
            payment_amount = COALESCE(${p.paymentAmount ?? null}, payment_amount)
        WHERE id = ${row.id}::uuid
      `.execute(trx);

      await sql`
        UPDATE core.programme_cohorts
        SET current_enrolment_count = current_enrolment_count + 1,
            updated_at = NOW()
        WHERE id = ${row.cohort_id}::uuid
      `.execute(trx);

      return {
        status: 'activated' as const,
        enrolmentId: row.id,
        learnerId: row.learner_id,
        cohortId: row.cohort_id,
      };
    });
  },

  async findEnrolmentByReference(db: Db, paymentReference: string) {
    const r = await sql<{
      id: string;
      learner_id: string;
      cohort_id: string;
      cohort_title: string;
      enrolment_status: string;
      payment_provider: string;
      payment_reference: string;
      payment_amount: number | null;
      payment_currency: string | null;
      enrolled_at: Date;
    }>`
      SELECT
        e.id,
        e.learner_id,
        e.cohort_id,
        c.title AS cohort_title,
        e.enrolment_status::text,
        e.payment_provider::text,
        e.payment_reference,
        e.payment_amount,
        e.payment_currency,
        e.enrolled_at
      FROM core.cohort_enrolments e
      JOIN core.programme_cohorts c ON c.id = e.cohort_id
      WHERE e.payment_reference = ${paymentReference}
      LIMIT 1
    `.execute(db);
    const row = r.rows[0];
    if (!row) return null;
    return {
      enrolmentId: row.id,
      learnerId: row.learner_id,
      cohortId: row.cohort_id,
      cohortTitle: row.cohort_title,
      enrolmentStatus: row.enrolment_status,
      paymentProvider: row.payment_provider as 'PAYSTACK' | 'STRIPE' | 'INSTITUTIONAL_INVOICE',
      paymentReference: row.payment_reference,
      paymentAmount: row.payment_amount,
      paymentCurrency: row.payment_currency ?? 'NGN',
      enrolledAt: row.enrolled_at.toISOString(),
    };
  },

  async enrolierContact(db: Db, userId: string, learnerId: string) {
    const r = await sql<{
      user_email: string | null;
      guardian_email: string | null;
    }>`
      SELECT
        (SELECT email FROM core.users WHERE id = ${userId}::uuid) AS user_email,
        (
          SELECT g.email
          FROM core.learner_profiles lp
          JOIN core.users g ON g.id = lp.primary_guardian_id
          WHERE lp.learner_id = ${learnerId}::uuid
        ) AS guardian_email
    `.execute(db);
    const row = r.rows[0];
    return row?.user_email ?? row?.guardian_email ?? 'payments@sparktrack.africa';
  },
};

export const institutionQueries = {
  async analyticsSummary(db: Db) {
    const [counts, skills, talentPoolCount, orgs] = await Promise.all([
      sql<{
        total_learners: string;
        verified_learners: string;
        sealed_artifacts: string;
        active_cohorts: string;
      }>`
        SELECT
          (SELECT COUNT(*)::text FROM core.learner_profiles) AS total_learners,
          (SELECT COUNT(*)::text FROM core.learner_profiles WHERE consent_status = 'VERIFIED_ACTIVE') AS verified_learners,
          (SELECT COUNT(*)::text FROM evidence.cryptographic_ledger) AS sealed_artifacts,
          (SELECT COUNT(*)::text FROM core.programme_cohorts WHERE is_active = TRUE) AS active_cohorts
      `.execute(db),
      sql<{
        code: string;
        name: string;
        category: string | null;
        learner_count: string;
        avg_score: string;
      }>`
        SELECT
          n.code,
          n.name,
          n.category::text,
          COUNT(DISTINCT t.learner_id)::text AS learner_count,
          ROUND(AVG(t.computed_score), 4)::text AS avg_score
        FROM intelligence.learner_capability_temporal t
        JOIN intelligence.graph_nodes n ON n.id = t.node_id
        WHERE upper_inf(t.valid_period) AND n.node_type = 'SKILL'
        GROUP BY n.code, n.name, n.category
        ORDER BY AVG(t.computed_score) DESC
      `.execute(db),
      sql<{ learner_count: string }>`
        SELECT COUNT(*)::text AS learner_count
        FROM core.learner_profiles
        WHERE consent_status = 'VERIFIED_ACTIVE'
          AND allow_partner_talent_discovery = TRUE
      `.execute(db),
      sql<{
        id: string;
        name: string;
        org_type: string;
        country_code: string;
        subscription_tier: string;
      }>`
        SELECT id, name, org_type, country_code, subscription_tier
        FROM core.organisations
        ORDER BY created_at DESC
      `.execute(db),
    ]);

    const c = counts.rows[0]!;
    return {
      totals: {
        totalLearners: Number(c.total_learners),
        verifiedConsentLearners: Number(c.verified_learners),
        sealedArtifacts: Number(c.sealed_artifacts),
        activeCohorts: Number(c.active_cohorts),
      },
      skillDistribution: skills.rows.map((s) => ({
        code: s.code,
        name: s.name,
        category: s.category,
        learnerCount: Number(s.learner_count),
        averageScore: Number(s.avg_score),
      })),
      optedInLearnerCount: Number(talentPoolCount.rows[0]?.learner_count ?? 0),
      organisations: orgs.rows.map((o) => ({
        id: o.id,
        name: o.name,
        orgType: o.org_type,
        countryCode: o.country_code,
        subscriptionTier: o.subscription_tier,
      })),
    };
  },

  async createOrganisation(
    db: Db,
    p: {
      name: string;
      orgType: 'SCHOOL' | 'NGO' | 'TRAINING_PROVIDER' | 'EMPLOYER' | 'GOVERNMENT';
      countryCode?: string;
      subscriptionTier?: string;
    },
  ) {
    const r = await sql<{ id: string }>`
      INSERT INTO core.organisations (name, org_type, country_code, subscription_tier)
      VALUES (${p.name}, ${p.orgType}, ${p.countryCode ?? 'NG'}, ${p.subscriptionTier ?? 'FREE_PILOT'})
      RETURNING id
    `.execute(db);
    return { organisationId: r.rows[0]!.id };
  },

  async refreshMaterializedSummary(db: Db) {
    await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_learner_development_summary`.execute(db);
    const r = await sql<{
      learner_id: string;
      full_name: string;
      education_stage: string;
      declared_interests: string[];
      total_verified_artifacts: string;
      active_skills_snapshot: unknown;
      last_evidence_date: Date | null;
    }>`
      SELECT
        learner_id,
        full_name,
        education_stage,
        declared_interests,
        total_verified_artifacts::text,
        active_skills_snapshot,
        last_evidence_date
      FROM analytics.mv_learner_development_summary
      ORDER BY total_verified_artifacts DESC
      LIMIT 50
    `.execute(db);

    return r.rows.map((row) => ({
      learnerId: row.learner_id,
      fullName: row.full_name,
      educationStage: row.education_stage,
      declaredInterests: row.declared_interests ?? [],
      totalVerifiedArtifacts: Number(row.total_verified_artifacts),
      activeSkillsSnapshot: row.active_skills_snapshot,
      lastEvidenceDate: row.last_evidence_date ? row.last_evidence_date.toISOString() : null,
    }));
  },

  async partnerTalentPool(db: Db) {
    const r = await sql<{
      learner_id: string;
      full_name: string;
      education_stage: string;
      declared_interests: string[];
      school_name: string | null;
      allow_public_portfolio: boolean;
      artifact_count: string;
    }>`
      SELECT
        lp.learner_id,
        u.full_name,
        lp.education_stage,
        lp.declared_interests,
        o.name AS school_name,
        lp.allow_public_portfolio,
        COUNT(a.id)::text AS artifact_count
      FROM core.learner_profiles lp
      JOIN core.users u ON u.id = lp.learner_id
      LEFT JOIN core.organisations o ON o.id = lp.current_school_id
      LEFT JOIN evidence.artifacts a ON a.learner_id = lp.learner_id
      WHERE lp.consent_status = 'VERIFIED_ACTIVE'
        AND lp.allow_partner_talent_discovery = TRUE
      GROUP BY lp.learner_id, u.full_name, lp.education_stage, lp.declared_interests, o.name, lp.allow_public_portfolio
      ORDER BY COUNT(a.id) DESC, lp.updated_at DESC
      LIMIT 30
    `.execute(db);

    return r.rows.map((row) => {
      const firstName = row.full_name.trim().split(/\s+/)[0] ?? 'Explorer';
      return {
        learnerId: row.learner_id,
        displayName: `${firstName} (${row.education_stage})`,
        educationStage: row.education_stage,
        declaredInterests: row.declared_interests ?? [],
        schoolName: row.school_name,
        allowPublicPortfolio: row.allow_public_portfolio,
        artifactCount: Number(row.artifact_count),
      };
    });
  },
};

export const telemetryQueries = {
  async recordEvent(
    db: Db,
    p: {
      learnerId: string;
      eventType: string;
      durationSeconds?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    const r = await sql<{ id: string; recorded_at: Date }>`
      INSERT INTO analytics.learning_telemetry (learner_id, event_type, duration_seconds, metadata)
      VALUES (
        ${p.learnerId}::uuid,
        ${p.eventType},
        ${p.durationSeconds ?? 0},
        ${JSON.stringify(p.metadata ?? {})}::jsonb
      )
      RETURNING id, recorded_at
    `.execute(db);
    return {
      telemetryId: r.rows[0]!.id,
      recordedAt: r.rows[0]!.recorded_at.toISOString(),
    };
  },
};

export const supportQueries = {
  async createTicket(
    db: Db,
    p: {
      ticketReference: string;
      category:
        | 'GENERAL_SUPPORT'
        | 'PARENT_CONSENT_HELP'
        | 'SCHOOL_PARTNERSHIP'
        | 'SCHOLARSHIP_SPONSORSHIP'
        | 'PRIVACY_DPO_REQUEST'
        | 'TECHNICAL_ISSUE';
      priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT_COMPLIANCE';
      requesterName: string;
      requesterEmail: string;
      requesterPhone?: string;
      requesterRole?: string;
      organisationName?: string;
      countryCode?: string;
      subject: string;
      message: string;
    },
  ) {
    const defaultPriority = p.category === 'PRIVACY_DPO_REQUEST' ? 'URGENT_COMPLIANCE' : (p.priority ?? 'NORMAL');
    const r = await sql<{
      id: string;
      ticket_reference: string;
      status: string;
      priority: string;
      created_at: Date;
    }>`
      INSERT INTO core.support_tickets (
        ticket_reference,
        category,
        priority,
        status,
        requester_name,
        requester_email,
        requester_phone,
        requester_role,
        organisation_name,
        country_code,
        subject,
        message
      )
      VALUES (
        ${p.ticketReference},
        ${p.category}::core.ticket_category,
        ${defaultPriority}::core.ticket_priority,
        'OPEN'::core.ticket_status,
        ${p.requesterName.trim()},
        ${p.requesterEmail.trim()},
        ${p.requesterPhone?.trim() ?? null},
        ${p.requesterRole ?? 'VISITOR'},
        ${p.organisationName?.trim() ?? null},
        ${p.countryCode ?? 'NG'},
        ${p.subject.trim()},
        ${p.message.trim()}
      )
      RETURNING id, ticket_reference, status::text, priority::text, created_at
    `.execute(db);

    const row = r.rows[0]!;
    return {
      ticketId: row.id,
      ticketReference: row.ticket_reference,
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at.toISOString(),
    };
  },

  async listTickets(db: Db, statusFilter?: string) {
    const r = statusFilter
      ? await sql<{
          id: string;
          ticket_reference: string;
          category: string;
          priority: string;
          status: string;
          requester_name: string;
          requester_email: string;
          requester_phone: string | null;
          requester_role: string;
          organisation_name: string | null;
          country_code: string;
          subject: string;
          message: string;
          staff_resolution_notes: string | null;
          created_at: Date;
          resolved_at: Date | null;
        }>`
          SELECT
            id,
            ticket_reference,
            category::text,
            priority::text,
            status::text,
            requester_name,
            requester_email,
            requester_phone,
            requester_role,
            organisation_name,
            country_code,
            subject,
            message,
            staff_resolution_notes,
            created_at,
            resolved_at
          FROM core.support_tickets
          WHERE status = ${statusFilter}::core.ticket_status
          ORDER BY created_at DESC
          LIMIT 100
        `.execute(db)
      : await sql<{
          id: string;
          ticket_reference: string;
          category: string;
          priority: string;
          status: string;
          requester_name: string;
          requester_email: string;
          requester_phone: string | null;
          requester_role: string;
          organisation_name: string | null;
          country_code: string;
          subject: string;
          message: string;
          staff_resolution_notes: string | null;
          created_at: Date;
          resolved_at: Date | null;
        }>`
          SELECT
            id,
            ticket_reference,
            category::text,
            priority::text,
            status::text,
            requester_name,
            requester_email,
            requester_phone,
            requester_role,
            organisation_name,
            country_code,
            subject,
            message,
            staff_resolution_notes,
            created_at,
            resolved_at
          FROM core.support_tickets
          ORDER BY created_at DESC
          LIMIT 100
        `.execute(db);

    return r.rows.map((row) => ({
      id: row.id,
      ticketReference: row.ticket_reference,
      category: row.category,
      priority: row.priority,
      status: row.status,
      requesterName: row.requester_name,
      requesterEmail: row.requester_email,
      requesterPhone: row.requester_phone,
      requesterRole: row.requester_role,
      organisationName: row.organisation_name,
      countryCode: row.country_code,
      subject: row.subject,
      message: row.message,
      staffResolutionNotes: row.staff_resolution_notes,
      createdAt: row.created_at.toISOString(),
      resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    }));
  },

  async updateTicket(
    db: Db,
    p: {
      ticketId: string;
      status: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED_DPO' | 'RESOLVED';
      priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT_COMPLIANCE';
      staffResolutionNotes?: string;
      assignedToUserId?: string;
    },
  ) {
    const r = await sql<{
      id: string;
      ticket_reference: string;
      status: string;
      priority: string;
      staff_resolution_notes: string | null;
    }>`
      UPDATE core.support_tickets
      SET
        status = ${p.status}::core.ticket_status,
        priority = COALESCE(${p.priority ?? null}::core.ticket_priority, priority),
        staff_resolution_notes = COALESCE(${p.staffResolutionNotes ?? null}, staff_resolution_notes),
        assigned_to_user_id = COALESCE(${p.assignedToUserId ?? null}::uuid, assigned_to_user_id),
        resolved_at = CASE WHEN ${p.status} = 'RESOLVED' THEN NOW() ELSE resolved_at END,
        updated_at = NOW()
      WHERE id = ${p.ticketId}::uuid
      RETURNING id, ticket_reference, status::text, priority::text, staff_resolution_notes
    `.execute(db);

    const row = r.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      ticketReference: row.ticket_reference,
      status: row.status,
      priority: row.priority,
      staffResolutionNotes: row.staff_resolution_notes,
    };
  },
};

export const apiKeyQueries = {
  async issueKey(
    db: Db,
    p: {
      organisationId: string | null;
      createdBy: string;
      label: string;
      scopes: string[];
      rateLimitPerMinute: number;
      expiresInDays?: number;
    },
  ) {
    const rawRandom = randomBytes(24).toString('base64url');
    const rawKey = `spk_live_${rawRandom}`;
    const keyPrefix = rawKey.slice(0, 16);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const expiresAt =
      typeof p.expiresInDays === 'number' && p.expiresInDays > 0
        ? new Date(Date.now() + p.expiresInDays * 86_400_000).toISOString()
        : null;

    const r = await sql<{
      id: string;
      label: string;
      key_prefix: string;
      scopes: string[];
      rate_limit_per_minute: number;
      created_at: Date;
      expires_at: Date | null;
    }>`
      INSERT INTO core.api_keys (
        organisation_id,
        created_by,
        label,
        key_prefix,
        key_hash,
        scopes,
        rate_limit_per_minute,
        expires_at
      )
      VALUES (
        ${p.organisationId}::uuid,
        ${p.createdBy}::uuid,
        ${p.label.trim()},
        ${keyPrefix},
        ${keyHash},
        ${sql.val(p.scopes)}::text[],
        ${p.rateLimitPerMinute},
        ${expiresAt}::timestamptz
      )
      RETURNING id, label, key_prefix, scopes, rate_limit_per_minute, created_at, expires_at
    `.execute(db);

    const row = r.rows[0]!;
    return {
      id: row.id,
      label: row.label,
      keyPrefix: row.key_prefix,
      secretKey: rawKey,
      scopes: row.scopes,
      rateLimitPerMinute: row.rate_limit_per_minute,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    };
  },

  async listKeys(db: Db, actor: { id: string; role: string; organisationId: string | null }) {
    const r =
      actor.role === 'SUPER_ADMIN'
        ? await sql<{
            id: string;
            label: string;
            key_prefix: string;
            scopes: string[];
            rate_limit_per_minute: number;
            organisation_name: string | null;
            last_used_at: Date | null;
            expires_at: Date | null;
            revoked_at: Date | null;
            created_at: Date;
          }>`
            SELECT
              k.id,
              k.label,
              k.key_prefix,
              k.scopes,
              k.rate_limit_per_minute,
              o.name AS organisation_name,
              k.last_used_at,
              k.expires_at,
              k.revoked_at,
              k.created_at
            FROM core.api_keys k
            LEFT JOIN core.organisations o ON o.id = k.organisation_id
            ORDER BY k.created_at DESC
            LIMIT 100
          `.execute(db)
        : await sql<{
            id: string;
            label: string;
            key_prefix: string;
            scopes: string[];
            rate_limit_per_minute: number;
            organisation_name: string | null;
            last_used_at: Date | null;
            expires_at: Date | null;
            revoked_at: Date | null;
            created_at: Date;
          }>`
            SELECT
              k.id,
              k.label,
              k.key_prefix,
              k.scopes,
              k.rate_limit_per_minute,
              o.name AS organisation_name,
              k.last_used_at,
              k.expires_at,
              k.revoked_at,
              k.created_at
            FROM core.api_keys k
            LEFT JOIN core.organisations o ON o.id = k.organisation_id
            WHERE k.created_by = ${actor.id}::uuid
               OR (${actor.organisationId}::uuid IS NOT NULL AND k.organisation_id = ${actor.organisationId}::uuid)
            ORDER BY k.created_at DESC
            LIMIT 100
          `.execute(db);

    return r.rows.map((row) => ({
      id: row.id,
      label: row.label,
      keyPrefix: row.key_prefix,
      scopes: row.scopes,
      rateLimitPerMinute: row.rate_limit_per_minute,
      organisationName: row.organisation_name,
      lastUsedAt: row.last_used_at ? row.last_used_at.toISOString() : null,
      expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
      revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
    }));
  },

  async revokeKey(db: Db, keyId: string, actor: { id: string; role: string; organisationId: string | null }) {
    const r =
      actor.role === 'SUPER_ADMIN'
        ? await sql<{ id: string }>`
            UPDATE core.api_keys
            SET revoked_at = NOW()
            WHERE id = ${keyId}::uuid AND revoked_at IS NULL
            RETURNING id
          `.execute(db)
        : await sql<{ id: string }>`
            UPDATE core.api_keys
            SET revoked_at = NOW()
            WHERE id = ${keyId}::uuid
              AND revoked_at IS NULL
              AND (
                created_by = ${actor.id}::uuid
                OR (${actor.organisationId}::uuid IS NOT NULL AND organisation_id = ${actor.organisationId}::uuid)
              )
            RETURNING id
          `.execute(db);
    return r.rows[0] ? { status: 'revoked' as const, id: r.rows[0].id } : { status: 'not_found' as const };
  },

  async verifyKey(db: Db, rawKey: string) {
    if (!rawKey.startsWith('spk_live_') || rawKey.length < 24) return null;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const r = await sql<{
      id: string;
      organisation_id: string | null;
      created_by: string;
      creator_role: string;
      scopes: string[];
      rate_limit_per_minute: number;
    }>`
      UPDATE core.api_keys k
      SET last_used_at = NOW()
      FROM core.users u
      WHERE k.key_hash = ${keyHash}
        AND k.revoked_at IS NULL
        AND (k.expires_at IS NULL OR k.expires_at > NOW())
        AND u.id = k.created_by
        AND u.is_active = TRUE
      RETURNING
        k.id,
        k.organisation_id,
        k.created_by,
        u.role::text AS creator_role,
        k.scopes,
        k.rate_limit_per_minute
    `.execute(db);

    const row = r.rows[0];
    if (!row) return null;
    return {
      keyId: row.id,
      userId: row.created_by,
      role: row.creator_role,
      organisationId: row.organisation_id,
      scopes: row.scopes,
      rateLimitPerMinute: row.rate_limit_per_minute,
    };
  },
};

export const governanceQueries = {
  async logActivity(
    db: Db,
    p: {
      actorId?: string | null;
      actorRole: string;
      organisationId?: string | null;
      actionType: string;
      resourceDomain: 'CORE_IDENTITY' | 'EVIDENCE_VAULT' | 'INTELLIGENCE_CORE' | 'ANALYTICS_PRODUCTS';
      classificationAccessed:
        | 'TIER_1_PUBLIC'
        | 'TIER_2_INTERNAL'
        | 'TIER_3_CONFIDENTIAL_PII'
        | 'TIER_4_RESTRICTED_MINOR_SECRETS';
      recordsReturned?: number;
      maskingApplied?: boolean;
      velocityFlagged?: boolean;
      outcome?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    await sql`
      INSERT INTO governance.data_activity_audit (
        actor_id,
        actor_role,
        organisation_id,
        action_type,
        resource_domain,
        classification_accessed,
        records_returned,
        masking_applied,
        velocity_flagged,
        outcome,
        metadata
      )
      VALUES (
        ${p.actorId ?? null}::uuid,
        ${p.actorRole},
        ${p.organisationId ?? null}::uuid,
        ${p.actionType},
        ${p.resourceDomain}::governance.data_mesh_domain,
        ${p.classificationAccessed}::governance.data_classification_tier,
        ${p.recordsReturned ?? 0},
        ${p.maskingApplied ?? true},
        ${p.velocityFlagged ?? false},
        ${p.outcome ?? 'ALLOWED'},
        ${JSON.stringify(p.metadata ?? {})}::jsonb
      )
    `.execute(db);
  },

  async overview(db: Db) {
    const [catalogRes, discoveryRes, meshCountRes, damRes] = await Promise.all([
      sql<{
        id: string;
        schema_name: string;
        table_name: string;
        column_name: string;
        mesh_domain: string;
        classification_tier: string;
        protection_technique: string;
        data_steward_role: string;
        retention_policy: string;
        ndpa_lawful_basis: string;
        contains_minor_pii: boolean;
        description: string;
      }>`
        SELECT
          id,
          schema_name,
          table_name,
          column_name,
          mesh_domain::text,
          classification_tier::text,
          protection_technique::text,
          data_steward_role,
          retention_policy,
          ndpa_lawful_basis,
          contains_minor_pii,
          description
        FROM governance.data_catalog
        ORDER BY classification_tier DESC, schema_name, table_name, column_name
      `.execute(db),
      sql<{
        total_columns: string;
        cataloged_columns: string;
        minor_pii_columns: string;
      }>`
        SELECT
          COUNT(*)::text AS total_columns,
          COUNT(*) FILTER (WHERE discovery_status = 'CATALOGED')::text AS cataloged_columns,
          COUNT(*) FILTER (WHERE contains_minor_pii = TRUE)::text AS minor_pii_columns
        FROM governance.vw_schema_discovery
      `.execute(db),
      sql<{ total_products: string }>`
        SELECT COUNT(*)::text AS total_products
        FROM governance.dp_verified_talent_mesh
      `.execute(db),
      sql<{
        audit_seq: string;
        actor_role: string;
        action_type: string;
        resource_domain: string;
        classification_accessed: string;
        records_returned: number;
        masking_applied: boolean;
        velocity_flagged: boolean;
        outcome: string;
        recorded_at: Date;
      }>`
        SELECT
          audit_seq::text,
          actor_role,
          action_type,
          resource_domain::text,
          classification_accessed::text,
          records_returned,
          masking_applied,
          velocity_flagged,
          outcome,
          recorded_at
        FROM governance.data_activity_audit
        ORDER BY audit_seq DESC
        LIMIT 25
      `.execute(db),
    ]);

    const disc = discoveryRes.rows[0];
    const catalog = catalogRes.rows.map((r) => ({
      id: r.id,
      schemaName: r.schema_name,
      tableName: r.table_name,
      columnName: r.column_name,
      meshDomain: r.mesh_domain,
      classificationTier: r.classification_tier,
      protectionTechnique: r.protection_technique,
      dataStewardRole: r.data_steward_role,
      retentionPolicy: r.retention_policy,
      ndpaLawfulBasis: r.ndpa_lawful_basis,
      containsMinorPii: r.contains_minor_pii,
      description: r.description,
    }));

    const tierBreakdown = {
      TIER_1_PUBLIC: catalog.filter((c) => c.classificationTier === 'TIER_1_PUBLIC').length,
      TIER_2_INTERNAL: catalog.filter((c) => c.classificationTier === 'TIER_2_INTERNAL').length,
      TIER_3_CONFIDENTIAL_PII: catalog.filter((c) => c.classificationTier === 'TIER_3_CONFIDENTIAL_PII').length,
      TIER_4_RESTRICTED_MINOR_SECRETS: catalog.filter(
        (c) => c.classificationTier === 'TIER_4_RESTRICTED_MINOR_SECRETS',
      ).length,
    };

    const domainBreakdown = {
      CORE_IDENTITY: catalog.filter((c) => c.meshDomain === 'CORE_IDENTITY').length,
      EVIDENCE_VAULT: catalog.filter((c) => c.meshDomain === 'EVIDENCE_VAULT').length,
      INTELLIGENCE_CORE: catalog.filter((c) => c.meshDomain === 'INTELLIGENCE_CORE').length,
      ANALYTICS_PRODUCTS: catalog.filter((c) => c.meshDomain === 'ANALYTICS_PRODUCTS').length,
    };

    return {
      discovery: {
        totalDatabaseColumns: Number(disc?.total_columns ?? 0),
        catalogedSensitiveAssets: Number(disc?.cataloged_columns ?? catalog.length),
        minorProtectedColumns: Number(disc?.minor_pii_columns ?? 0),
        verifiedMeshTalentProducts: Number(meshCountRes.rows[0]?.total_products ?? 0),
      },
      tierBreakdown,
      domainBreakdown,
      catalog,
      recentActivity: damRes.rows.map((row) => ({
        auditSeq: Number(row.audit_seq),
        actorRole: row.actor_role,
        actionType: row.action_type,
        resourceDomain: row.resource_domain,
        classificationAccessed: row.classification_accessed,
        recordsReturned: row.records_returned,
        maskingApplied: row.masking_applied,
        velocityFlagged: row.velocity_flagged,
        outcome: row.outcome,
        recordedAt: row.recorded_at.toISOString(),
      })),
    };
  },

  async inspectAndMaskSample(
    db: Db,
    actor: { id: string; role: string; organisationId: string | null },
    sampleText: string,
  ) {
    const { sanitizedText, findings } = discoverAndRedactPii(sampleText);
    await this.logActivity(db, {
      actorId: actor.id,
      actorRole: actor.role,
      organisationId: actor.organisationId,
      actionType: 'DLP_UNSTRUCTURED_PII_SCAN',
      resourceDomain: 'EVIDENCE_VAULT',
      classificationAccessed:
        findings.length > 0 ? 'TIER_3_CONFIDENTIAL_PII' : 'TIER_1_PUBLIC',
      recordsReturned: 1,
      maskingApplied: findings.length > 0,
      outcome: findings.length > 0 ? 'PII_DISCOVERY_REDACTED' : 'CLEAN',
      metadata: { findingsCount: findings.length, findings },
    });
    return {
      originalLength: sampleText.length,
      sanitizedText,
      findings,
      piiDetected: findings.length > 0,
    };
  },
};

function deriveAesKey(rawSecret: string): Buffer {
  return createHash('sha256').update(rawSecret, 'utf8').digest();
}

export function encryptWebhookSecret(plaintext: string, encryptionKey: string): string {
  const iv = randomBytes(12);
  const key = deriveAesKey(encryptionKey);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptWebhookSecret(ciphertext: string, encryptionKey: string): string {
  const [ivB64, tagB64, encB64] = ciphertext.split('.');
  if (!ivB64 || !tagB64 || !encB64) {
    throw new Error('Malformed encrypted webhook secret');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveAesKey(encryptionKey),
    Buffer.from(ivB64, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encB64, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function signPartnerWebhookPayload(payloadJson: string, secret: string, epochSeconds: number): string {
  const sig = createHmac('sha256', secret)
    .update(`${epochSeconds}.${payloadJson}`)
    .digest('hex');
  return `t=${epochSeconds},v1=${sig}`;
}

export const partnerQueries = {
  async upsertExternalLearner(
    db: Db,
    p: {
      organisationId: string;
      apiKeyId: string | null;
      externalLearnerId: string;
      fullName: string;
      ageGroup: 'UNDER_18' | 'ADULT';
      dateOfBirth?: string | null;
      learnerStage: string;
      educationStage?: string;
      educationLevel?: string | null;
      learningGoal?: string;
      declaredInterests: string[];
      consentStatus: 'PENDING_PARENTAL_CONSENT' | 'VERIFIED_ACTIVE' | 'RESTRICTED_INTERNAL_ONLY' | 'REVOKED';
      attestationMethod:
        | 'ADULT_SELF_CONSENT'
        | 'GUARDIAN_WRITTEN_CONSENT'
        | 'GUARDIAN_DIGITAL_CONSENT'
        | 'INSTITUTIONAL_ENROLMENT_AGREEMENT'
        | 'CONSENT_WITHDRAWN';
      guardianName?: string | null;
      guardianContact?: string | null;
      evidenceReference?: string | null;
      allowPublicPortfolio?: boolean;
      allowPartnerTalentDiscovery?: boolean;
    },
  ) {
    return db.transaction().execute(async (trx) => {
      const existing = await sql<{ learner_id: string }>`
        SELECT learner_id
        FROM core.external_learner_links
        WHERE organisation_id = ${p.organisationId}::uuid
          AND external_learner_id = ${p.externalLearnerId}
        FOR UPDATE
      `.execute(trx);

      const isVerified = p.consentStatus === 'VERIFIED_ACTIVE';
      const allowPublic = isVerified && Boolean(p.allowPublicPortfolio);
      const allowPartner = isVerified && Boolean(p.allowPartnerTalentDiscovery);
      const educationStage = p.educationStage?.trim() || p.learnerStage;

      let learnerId: string;
      let created = false;
      let publicShareToken: string | null = null;

      if (existing.rows[0]) {
        learnerId = existing.rows[0].learner_id;
        await sql`
          UPDATE core.users
          SET full_name = ${p.fullName.trim()}
          WHERE id = ${learnerId}::uuid
        `.execute(trx);

        const curToken = await sql<{ public_share_token: string | null }>`
          SELECT public_share_token
          FROM core.learner_profiles
          WHERE learner_id = ${learnerId}::uuid
        `.execute(trx);

        publicShareToken = allowPublic
          ? (curToken.rows[0]?.public_share_token ?? randomBytes(18).toString('base64url'))
          : null;

        await sql`
          UPDATE core.learner_profiles
          SET age_group = ${p.ageGroup},
              date_of_birth = COALESCE(${p.dateOfBirth ?? null}::date, date_of_birth),
              education_stage = ${educationStage},
              learner_stage = ${p.learnerStage},
              education_level = COALESCE(${p.educationLevel ?? null}, education_level),
              learning_goal = COALESCE(${p.learningGoal ?? null}, learning_goal),
              declared_interests = ${sql.val(p.declaredInterests)}::text[],
              consent_status = ${p.consentStatus}::core.consent_status,
              consent_verified_at = CASE WHEN ${isVerified} THEN COALESCE(consent_verified_at, NOW()) ELSE NULL END,
              consent_verification_method = CASE WHEN ${isVerified} THEN ${p.attestationMethod} ELSE NULL END,
              allow_public_portfolio = ${allowPublic},
              allow_partner_talent_discovery = ${allowPartner},
              public_share_token = ${publicShareToken},
              public_share_token_created_at = CASE WHEN ${publicShareToken !== null} THEN COALESCE(public_share_token_created_at, NOW()) ELSE NULL END,
              updated_at = NOW()
          WHERE learner_id = ${learnerId}::uuid
        `.execute(trx);

        await sql`
          UPDATE core.external_learner_links
          SET updated_at = NOW()
          WHERE organisation_id = ${p.organisationId}::uuid
            AND external_learner_id = ${p.externalLearnerId}
        `.execute(trx);
      } else {
        created = true;
        const userIns = await sql<{ id: string }>`
          INSERT INTO core.users (role, full_name, organisation_id, is_active)
          VALUES ('LEARNER'::core.user_role, ${p.fullName.trim()}, ${p.organisationId}::uuid, TRUE)
          RETURNING id
        `.execute(trx);
        learnerId = userIns.rows[0]!.id;

        publicShareToken = allowPublic ? randomBytes(18).toString('base64url') : null;

        await sql`
          INSERT INTO core.learner_profiles (
            learner_id,
            date_of_birth,
            age_group,
            education_stage,
            learner_stage,
            education_level,
            learning_goal,
            current_school_id,
            consent_status,
            consent_verified_at,
            consent_verification_method,
            allow_public_portfolio,
            allow_partner_talent_discovery,
            public_share_token,
            public_share_token_created_at,
            declared_interests
          )
          VALUES (
            ${learnerId}::uuid,
            ${p.dateOfBirth ?? null}::date,
            ${p.ageGroup},
            ${educationStage},
            ${p.learnerStage},
            ${p.educationLevel ?? null},
            ${p.learningGoal ?? 'BUILD_PRACTICAL_SKILLS'},
            ${p.organisationId}::uuid,
            ${p.consentStatus}::core.consent_status,
            ${isVerified ? sql`NOW()` : sql`NULL`},
            ${isVerified ? p.attestationMethod : null},
            ${allowPublic},
            ${allowPartner},
            ${publicShareToken},
            ${publicShareToken ? sql`NOW()` : sql`NULL`},
            ${sql.val(p.declaredInterests)}::text[]
          )
        `.execute(trx);

        await sql`
          INSERT INTO core.external_learner_links (
            organisation_id, external_learner_id, learner_id, created_by_key_id
          )
          VALUES (
            ${p.organisationId}::uuid,
            ${p.externalLearnerId},
            ${learnerId}::uuid,
            ${p.apiKeyId}::uuid
          )
        `.execute(trx);
      }

      const contactHash = p.guardianContact?.trim()
        ? sha256Hex(p.guardianContact.trim().toLowerCase())
        : null;

      await sql`
        INSERT INTO core.partner_consent_attestations (
          organisation_id,
          learner_id,
          api_key_id,
          consent_status,
          attestation_method,
          guardian_name,
          guardian_contact_sha256,
          evidence_reference,
          allow_public_portfolio,
          allow_partner_talent_discovery,
          attested_at
        )
        VALUES (
          ${p.organisationId}::uuid,
          ${learnerId}::uuid,
          ${p.apiKeyId}::uuid,
          ${p.consentStatus}::core.consent_status,
          ${p.attestationMethod},
          ${p.guardianName?.trim() ?? null},
          ${contactHash},
          ${p.evidenceReference?.trim() ?? null},
          ${allowPublic},
          ${allowPartner},
          NOW()
        )
      `.execute(trx);

      return {
        created,
        externalLearnerId: p.externalLearnerId,
        learnerRef: `SPK-${learnerId.slice(0, 8).toUpperCase()}`,
        learnerId,
        consentStatus: p.consentStatus,
        allowPublicPortfolio: allowPublic,
        publicShareToken,
      };
    });
  },

  async resolveExternalLearner(db: Db, organisationId: string, externalLearnerId: string) {
    const r = await sql<{
      learner_id: string;
      external_learner_id: string;
      full_name: string;
      education_stage: string;
      learner_stage: string;
      learning_goal: string;
      consent_status: string;
      allow_public_portfolio: boolean;
      public_share_token: string | null;
      declared_interests: string[];
    }>`
      SELECT
        l.learner_id,
        l.external_learner_id,
        u.full_name,
        lp.education_stage,
        lp.learner_stage,
        lp.learning_goal,
        lp.consent_status::text,
        lp.allow_public_portfolio,
        lp.public_share_token,
        lp.declared_interests
      FROM core.external_learner_links l
      JOIN core.learner_profiles lp ON lp.learner_id = l.learner_id
      JOIN core.users u ON u.id = l.learner_id
      WHERE l.organisation_id = ${organisationId}::uuid
        AND l.external_learner_id = ${externalLearnerId}
      LIMIT 1
    `.execute(db);

    const row = r.rows[0];
    if (!row) return null;
    return {
      learnerId: row.learner_id,
      externalLearnerId: row.external_learner_id,
      learnerRef: `SPK-${row.learner_id.slice(0, 8).toUpperCase()}`,
      fullName: row.full_name,
      educationStage: row.education_stage,
      learnerStage: row.learner_stage,
      learningGoal: row.learning_goal,
      consentStatus: row.consent_status,
      allowPublicPortfolio: row.allow_public_portfolio,
      publicShareToken: row.public_share_token,
      declaredInterests: row.declared_interests ?? [],
    };
  },

  async claimIdempotency(
    db: Db,
    p: { apiKeyId: string; idempotencyKey: string; requestFingerprint: string },
  ) {
    const ins = await sql<{ state: string }>`
      INSERT INTO core.partner_idempotency_keys (api_key_id, idempotency_key, request_fingerprint, state)
      VALUES (${p.apiKeyId}::uuid, ${p.idempotencyKey}, ${p.requestFingerprint}, 'IN_PROGRESS')
      ON CONFLICT (api_key_id, idempotency_key) DO NOTHING
      RETURNING state
    `.execute(db);
    if (ins.rows[0]) return { status: 'claimed' as const };

    const existing = await sql<{
      request_fingerprint: string;
      state: string;
      response_status: number | null;
      response_body: unknown;
    }>`
      SELECT request_fingerprint, state, response_status, response_body
      FROM core.partner_idempotency_keys
      WHERE api_key_id = ${p.apiKeyId}::uuid AND idempotency_key = ${p.idempotencyKey}
    `.execute(db);
    const row = existing.rows[0];
    if (!row) return { status: 'claimed' as const };
    if (row.request_fingerprint !== p.requestFingerprint) {
      return { status: 'conflict' as const };
    }
    if (row.state === 'COMPLETED') {
      return {
        status: 'replay' as const,
        responseStatus: row.response_status ?? 200,
        responseBody: row.response_body,
      };
    }
    return { status: 'in_progress' as const };
  },

  async completeIdempotency(
    db: Db,
    p: { apiKeyId: string; idempotencyKey: string; responseStatus: number; responseBody: unknown },
  ) {
    await sql`
      UPDATE core.partner_idempotency_keys
      SET state = 'COMPLETED',
          response_status = ${p.responseStatus},
          response_body = ${JSON.stringify(p.responseBody)}::jsonb
      WHERE api_key_id = ${p.apiKeyId}::uuid AND idempotency_key = ${p.idempotencyKey}
    `.execute(db);
  },

  async releaseIdempotencyOnError(db: Db, apiKeyId: string, idempotencyKey: string) {
    await sql`
      DELETE FROM core.partner_idempotency_keys
      WHERE api_key_id = ${apiKeyId}::uuid
        AND idempotency_key = ${idempotencyKey}
        AND state = 'IN_PROGRESS'
    `.execute(db);
  },

  async registerWebhookEndpoint(
    db: Db,
    p: {
      organisationId: string;
      createdByKeyId: string | null;
      url: string;
      description?: string;
      events: string[];
      encryptionKey: string;
    },
  ) {
    const rawSecret = `whsec_spk_${randomBytes(24).toString('base64url')}`;
    const secretPrefix = rawSecret.slice(0, 14);
    const ciphertext = encryptWebhookSecret(rawSecret, p.encryptionKey);

    const r = await sql<{ id: string; created_at: Date }>`
      INSERT INTO core.partner_webhook_endpoints (
        organisation_id, url, description, events, secret_ciphertext, secret_prefix, created_by_key_id
      )
      VALUES (
        ${p.organisationId}::uuid,
        ${p.url.trim()},
        ${p.description?.trim() ?? null},
        ${sql.val(p.events)}::text[],
        ${ciphertext},
        ${secretPrefix},
        ${p.createdByKeyId}::uuid
      )
      RETURNING id, created_at
    `.execute(db);

    const row = r.rows[0]!;
    return {
      id: row.id,
      url: p.url.trim(),
      description: p.description?.trim() ?? null,
      events: p.events,
      secret: rawSecret,
      secretPrefix,
      isActive: true,
      createdAt: row.created_at.toISOString(),
    };
  },

  async listWebhookEndpoints(db: Db, organisationId: string) {
    const r = await sql<{
      id: string;
      url: string;
      description: string | null;
      events: string[];
      secret_prefix: string;
      is_active: boolean;
      consecutive_failures: number;
      disabled_reason: string | null;
      created_at: Date;
    }>`
      SELECT id, url, description, events, secret_prefix, is_active, consecutive_failures, disabled_reason, created_at
      FROM core.partner_webhook_endpoints
      WHERE organisation_id = ${organisationId}::uuid
      ORDER BY created_at DESC
      LIMIT 50
    `.execute(db);

    return r.rows.map((row) => ({
      id: row.id,
      url: row.url,
      description: row.description,
      events: row.events,
      secretPrefix: row.secret_prefix,
      isActive: row.is_active,
      consecutiveFailures: row.consecutive_failures,
      disabledReason: row.disabled_reason,
      createdAt: row.created_at.toISOString(),
    }));
  },

  async deleteWebhookEndpoint(db: Db, organisationId: string, endpointId: string) {
    const r = await sql<{ id: string }>`
      DELETE FROM core.partner_webhook_endpoints
      WHERE id = ${endpointId}::uuid AND organisation_id = ${organisationId}::uuid
      RETURNING id
    `.execute(db);
    return r.rows[0] ? { status: 'deleted' as const, id: r.rows[0].id } : { status: 'not_found' as const };
  },

  async enqueueWebhookEvent(
    db: Db,
    p: { organisationId: string; eventType: string; payload: Record<string, unknown> },
  ) {
    const eventId = randomUUID();
    const envelope = {
      id: eventId,
      type: p.eventType,
      createdAt: new Date().toISOString(),
      data: p.payload,
    };

    const r = await sql<{ id: string }>`
      INSERT INTO core.partner_webhook_deliveries (
        endpoint_id, organisation_id, event_id, event_type, payload
      )
      SELECT
        e.id,
        e.organisation_id,
        ${eventId}::uuid,
        ${p.eventType},
        ${JSON.stringify(envelope)}::jsonb
      FROM core.partner_webhook_endpoints e
      WHERE e.organisation_id = ${p.organisationId}::uuid
        AND e.is_active = TRUE
        AND (${p.eventType} = ANY(e.events) OR '*' = ANY(e.events))
      RETURNING id
    `.execute(db);

    return { eventId, queuedCount: r.rows.length };
  },

  async claimPendingWebhookDeliveries(db: Db, limit = 20) {
    return db.transaction().execute(async (trx) => {
      const r = await sql<{
        delivery_id: string;
        endpoint_id: string;
        organisation_id: string;
        event_id: string;
        event_type: string;
        payload: unknown;
        attempt_count: number;
        url: string;
        secret_ciphertext: string;
      }>`
        WITH due AS (
          SELECT d.id
          FROM core.partner_webhook_deliveries d
          JOIN core.partner_webhook_endpoints e ON e.id = d.endpoint_id
          WHERE e.is_active = TRUE
            AND (
              (d.status IN ('PENDING', 'FAILED') AND d.next_attempt_at <= NOW())
              OR (d.status = 'IN_FLIGHT' AND d.locked_until < NOW())
            )
          ORDER BY d.next_attempt_at ASC
          LIMIT ${limit}
          FOR UPDATE OF d SKIP LOCKED
        ),
        claimed AS (
          UPDATE core.partner_webhook_deliveries d
          SET status = 'IN_FLIGHT',
              locked_until = NOW() + INTERVAL '30 seconds',
              attempt_count = d.attempt_count + 1
          FROM due
          WHERE d.id = due.id
          RETURNING d.id, d.endpoint_id, d.organisation_id, d.event_id, d.event_type, d.payload, d.attempt_count
        )
        SELECT
          c.id AS delivery_id,
          c.endpoint_id,
          c.organisation_id,
          c.event_id,
          c.event_type,
          c.payload,
          c.attempt_count,
          e.url,
          e.secret_ciphertext
        FROM claimed c
        JOIN core.partner_webhook_endpoints e ON e.id = c.endpoint_id
      `.execute(trx);

      return r.rows.map((row) => ({
        deliveryId: row.delivery_id,
        endpointId: row.endpoint_id,
        organisationId: row.organisation_id,
        eventId: row.event_id,
        eventType: row.event_type,
        payload: row.payload,
        attemptCount: row.attempt_count,
        url: row.url,
        secretCiphertext: row.secret_ciphertext,
      }));
    });
  },

  async markWebhookDeliveryResult(
    db: Db,
    p: {
      deliveryId: string;
      endpointId: string;
      attemptCount: number;
      success: boolean;
      responseStatus?: number | null;
      error?: string | null;
    },
  ) {
    return db.transaction().execute(async (trx) => {
      if (p.success) {
        await sql`
          UPDATE core.partner_webhook_deliveries
          SET status = 'DELIVERED',
              last_response_status = ${p.responseStatus ?? 200},
              last_error = NULL,
              delivered_at = NOW(),
              locked_until = NULL
          WHERE id = ${p.deliveryId}::uuid
        `.execute(trx);

        await sql`
          UPDATE core.partner_webhook_endpoints
          SET consecutive_failures = 0,
              updated_at = NOW()
          WHERE id = ${p.endpointId}::uuid
        `.execute(trx);
        return;
      }

      const maxAttempts = 6;
      const isDead = p.attemptCount >= maxAttempts;
      const backoffSeconds = Math.min(3600, Math.pow(2, p.attemptCount) * 15);

      await sql`
        UPDATE core.partner_webhook_deliveries
        SET status = ${isDead ? 'DEAD' : 'FAILED'},
            last_response_status = ${p.responseStatus ?? null},
            last_error = ${p.error?.slice(0, 500) ?? 'Delivery failed'},
            next_attempt_at = NOW() + (${backoffSeconds} || ' seconds')::interval,
            locked_until = NULL
        WHERE id = ${p.deliveryId}::uuid
      `.execute(trx);

      await sql`
        UPDATE core.partner_webhook_endpoints
        SET consecutive_failures = consecutive_failures + 1,
            is_active = CASE WHEN consecutive_failures + 1 >= 10 THEN FALSE ELSE is_active END,
            disabled_reason = CASE
              WHEN consecutive_failures + 1 >= 10 THEN 'Auto-disabled after 10 consecutive webhook delivery failures'
              ELSE disabled_reason
            END,
            updated_at = NOW()
        WHERE id = ${p.endpointId}::uuid
      `.execute(trx);
    });
  },
};
