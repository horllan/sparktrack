import { createHash } from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
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
    const r = await sql<{ declared_interests: string[]; consent_status: string; date_of_birth: string; education_stage: string }>`
      SELECT declared_interests, consent_status::text, date_of_birth::text, education_stage
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
    dateOfBirth: string;
    educationStage: string;
    schoolName?: string;
    declaredInterests: string[];
    guardian: { fullName: string; email?: string; phoneNumber: string };
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

      let guardianId: string;
      if (p.guardian.email) {
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
      } else {
        const guardian = await sql<{ id: string }>`
          INSERT INTO core.users (role, full_name, phone_number)
          VALUES ('PARENT'::core.user_role, ${p.guardian.fullName}, ${p.guardian.phoneNumber})
          RETURNING id
        `.execute(trx);
        guardianId = guardian.rows[0]!.id;
      }

      await sql`
        INSERT INTO core.learner_profiles
          (learner_id, date_of_birth, education_stage, primary_guardian_id, declared_interests)
        VALUES (${learnerId}::uuid, ${p.dateOfBirth}::date, ${p.educationStage}, ${guardianId}::uuid,
          ${sql.val(p.declaredInterests)}::text[])
      `.execute(trx);

      return { status: 'created' as const, guardianId };
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
          education_stage,
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
          ${p.educationStage.trim()},
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
            declared_interests: string[];
            school_name: string | null;
          }>`
            SELECT
              lp.learner_id,
              u.full_name,
              lp.education_stage,
              lp.date_of_birth::text,
              lp.consent_status::text,
              lp.declared_interests,
              o.name AS school_name
            FROM core.learner_profiles lp
            JOIN core.users u ON u.id = lp.learner_id
            LEFT JOIN core.organisations o ON o.id = lp.current_school_id
            WHERE lp.primary_guardian_id = ${actor.id}::uuid
            ORDER BY lp.created_at DESC
          `.execute(db)
        : actor.organisationId
          ? await sql<{
              learner_id: string;
              full_name: string;
              education_stage: string;
              date_of_birth: string;
              consent_status: string;
              declared_interests: string[];
              school_name: string | null;
            }>`
              SELECT
                lp.learner_id,
                u.full_name,
                lp.education_stage,
                lp.date_of_birth::text,
                lp.consent_status::text,
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
              declared_interests: string[];
              school_name: string | null;
            }>`
              SELECT
                lp.learner_id,
                u.full_name,
                lp.education_stage,
                lp.date_of_birth::text,
                lp.consent_status::text,
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
      email: row.email,
      phoneNumber: row.phone_number,
      organisationId: row.organisation_id,
      organisationName: row.organisation_name,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
    }));
  },
};

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
      date_of_birth: string;
      education_stage: string;
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
        lp.education_stage,
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
      GROUP BY lp.learner_id, u.full_name, lp.date_of_birth, lp.education_stage, org.name,
               lp.consent_status, lp.declared_interests, lp.allow_public_portfolio
    `.execute(db);
    const row = r.rows[0];
    if (!row) return null;
    return {
      learnerId: row.learner_id,
      fullName: row.full_name,
      dateOfBirth: row.date_of_birth,
      educationStage: row.education_stage,
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
      WHERE lp.learner_id = ${learnerId}::uuid
    `.execute(db);

    const row = profileRes.rows[0];
    if (!row) return { status: 'not_found' as const };
    if (row.consent_status !== 'VERIFIED_ACTIVE' || !row.allow_public_portfolio) {
      return { status: 'private' as const };
    }

    const [skills, artifacts] = await Promise.all([
      bitemporalQueries.profileAsOf(db, learnerId, new Date()),
      this.learnerArtifacts(db, learnerId),
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
  },
};

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
      const existing = await sql<{ id: string; enrolment_status: string }>`
        SELECT id, enrolment_status::text
        FROM core.cohort_enrolments
        WHERE learner_id = ${p.learnerId}::uuid AND cohort_id = ${p.cohortId}::uuid
        FOR UPDATE
      `.execute(trx);

      if (existing.rows[0]) {
        return {
          enrolmentId: existing.rows[0].id,
          enrolmentStatus: existing.rows[0].enrolment_status,
          alreadyEnrolled: true,
        };
      }

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
          ${p.paymentReference ?? null},
          ${p.paymentAmount ?? null},
          ${p.paymentCurrency ?? 'NGN'}
        )
        RETURNING id, enrolment_status::text
      `.execute(trx);

      return {
        enrolmentId: ins.rows[0]!.id,
        enrolmentStatus: ins.rows[0]!.enrolment_status,
        alreadyEnrolled: false,
      };
    });
  },

  async confirmPaymentByReference(
    db: Db,
    p: {
      paymentProvider: 'PAYSTACK' | 'STRIPE';
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
      }>`
        SELECT id, learner_id, cohort_id, enrolment_status::text
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
