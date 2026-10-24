import { createHash } from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { SparkTrackDatabase } from './kysely-types.js';

type Db = Kysely<SparkTrackDatabase>;
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
};
