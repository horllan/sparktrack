-- ============================================================================
-- SPARKTRACK SQL AI DEVELOPER ARCHITECTURE (POSTGRESQL 16/17)
-- Migration: 0001_sparktrack_core_architecture.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- For SHA-256 cryptographic ledger hashing
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector for HNSW semantic embeddings
CREATE EXTENSION IF NOT EXISTS "btree_gist";    -- Required for bitemporal range exclusion constraints
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- For fuzzy text/BM25 hybrid search

CREATE SCHEMA IF NOT EXISTS core;         -- Multi-tenant identity, schools, cohorts, consent
CREATE SCHEMA IF NOT EXISTS evidence;     -- Cryptographic ledger & polymorphic JSONB artifacts
CREATE SCHEMA IF NOT EXISTS intelligence; -- Skill taxonomy, bitemporal history, graph & vectors
CREATE SCHEMA IF NOT EXISTS analytics;    -- Materialized views & unlogged in-memory cache tables

-- Custom Enums & Domains
CREATE TYPE core.user_role AS ENUM (
  'LEARNER', 'PARENT', 'MENTOR', 'SCHOOL_ADMIN', 'ORG_PARTNER', 'SUPER_ADMIN'
);

CREATE TYPE core.consent_status AS ENUM (
  'PENDING_PARENTAL_CONSENT', 'VERIFIED_ACTIVE', 'RESTRICTED_INTERNAL_ONLY', 'REVOKED'
);

CREATE TYPE intelligence.skill_category AS ENUM (
  'TECHNICAL', 'DIGITAL', 'CREATIVE', 'BUSINESS', 'PROFESSIONAL', 'BEHAVIOURAL_SIGNAL'
);

CREATE TYPE intelligence.progression_level AS ENUM (
  'BEGINNER', 'DEVELOPING', 'COMPETENT', 'ADVANCED'
);

CREATE TYPE evidence.artifact_type AS ENUM (
  'PROJECT_SUBMISSION', 'GIT_REPOSITORY', 'DESIGN_PORTFOLIO', 'ASSESSMENT_RESULT',
  'MENTOR_OBSERVATION', 'COMPETITION_RESULT', 'LEARNER_REFLECTION', 'BUSINESS_PROTOTYPE'
);

CREATE TYPE intelligence.graph_node_type AS ENUM (
  'ACTIVITY', 'SKILL', 'CAPABILITY', 'CAREER_PATHWAY', 'ENTREPRENEURSHIP_PATHWAY', 'OPPORTUNITY'
);

CREATE DOMAIN intelligence.unit_score AS NUMERIC(5,4)
  CHECK (VALUE >= 0.0000 AND VALUE <= 1.0000);

-- Multi-Tenant Identity & Child Safety Tables
CREATE TABLE core.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_type TEXT NOT NULL CHECK (org_type IN ('SCHOOL', 'NGO', 'TRAINING_PROVIDER', 'EMPLOYER', 'GOVERNMENT')),
  country_code CHAR(2) NOT NULL DEFAULT 'NG',
  subscription_tier TEXT NOT NULL DEFAULT 'FREE_PILOT',
  api_key_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE core.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role core.user_role NOT NULL,
  organisation_id UUID REFERENCES core.organisations(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone_number TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE core.learner_profiles (
  learner_id UUID PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
  date_of_birth DATE NOT NULL,
  current_school_id UUID REFERENCES core.organisations(id),
  education_stage TEXT NOT NULL,
  primary_guardian_id UUID REFERENCES core.users(id),
  consent_status core.consent_status NOT NULL DEFAULT 'PENDING_PARENTAL_CONSENT',
  consent_verified_at TIMESTAMPTZ,
  consent_verification_method TEXT,
  allow_public_portfolio BOOLEAN NOT NULL DEFAULT FALSE,
  allow_partner_talent_discovery BOOLEAN NOT NULL DEFAULT FALSE,
  declared_interests TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Polymorphic Evidence Artifacts (Offline-First Sync Compatible)
CREATE TABLE evidence.artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_sync_id UUID UNIQUE NOT NULL,
  learner_id UUID NOT NULL REFERENCES core.learner_profiles(learner_id) ON DELETE RESTRICT,
  programme_cohort_id UUID,
  activity_node_id UUID,
  artifact_type evidence.artifact_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  storage_r2_keys TEXT[] DEFAULT '{}',
  external_urls TEXT[] DEFAULT '{}',
  payload JSONB NOT NULL DEFAULT '{"schema_version": "1.0"}'::jsonb,
  mentor_verifier_id UUID REFERENCES core.users(id),
  quality_score intelligence.unit_score,
  complexity_weight NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (complexity_weight BETWEEN 0.50 AND 3.00),
  captured_offline_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_artifact_payload_valid CHECK (
    jsonb_typeof(payload) = 'object' AND (payload ? 'schema_version')
  )
);

CREATE INDEX idx_artifacts_payload_gin ON evidence.artifacts USING GIN (payload jsonb_path_ops);
CREATE INDEX idx_artifacts_learner_time ON evidence.artifacts (learner_id, captured_offline_at DESC);

-- Cryptographic Append-Only Evidence Ledger
CREATE TABLE evidence.cryptographic_ledger (
  ledger_seq BIGSERIAL PRIMARY KEY,
  artifact_id UUID NOT NULL UNIQUE REFERENCES evidence.artifacts(id) ON DELETE RESTRICT,
  learner_id UUID NOT NULL,
  verifier_id UUID,
  payload_canonical_hash TEXT NOT NULL,
  previous_ledger_hash TEXT NOT NULL,
  row_signature_hash TEXT NOT NULL UNIQUE,
  sealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION evidence.fn_seal_ledger_entry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prev_hash TEXT;
BEGIN
  SELECT row_signature_hash INTO v_prev_hash
  FROM evidence.cryptographic_ledger
  ORDER BY ledger_seq DESC LIMIT 1;

  IF v_prev_hash IS NULL THEN
    v_prev_hash := 'SPARKTRACK_GENESIS_BLOCK_2026';
  END IF;

  NEW.previous_ledger_hash := v_prev_hash;
  NEW.row_signature_hash := encode(
    sha256(convert_to(v_prev_hash || '|' || NEW.artifact_id::text || '|' || NEW.learner_id::text || '|' || NEW.payload_canonical_hash, 'UTF8')),
    'hex'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seal_ledger_before_insert
BEFORE INSERT ON evidence.cryptographic_ledger
FOR EACH ROW EXECUTE FUNCTION evidence.fn_seal_ledger_entry();

CREATE OR REPLACE FUNCTION evidence.fn_prevent_ledger_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'SparkTrack Security Violation: evidence.cryptographic_ledger is an immutable append-only ledger. UPDATE and DELETE operations are strictly prohibited.';
END;
$$;

CREATE TRIGGER trg_immutable_ledger
BEFORE UPDATE OR DELETE ON evidence.cryptographic_ledger
FOR EACH ROW EXECUTE FUNCTION evidence.fn_prevent_ledger_mutation();

-- Capability Graph Nodes & Vector Embeddings
CREATE TABLE intelligence.graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type intelligence.graph_node_type NOT NULL,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category intelligence.skill_category,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding halfvec(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_graph_nodes_embedding_hnsw 
ON intelligence.graph_nodes USING hnsw (embedding halfvec_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE TABLE intelligence.graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id UUID NOT NULL REFERENCES intelligence.graph_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES intelligence.graph_nodes(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  contribution_weight intelligence.unit_score NOT NULL DEFAULT 0.5000,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(source_node_id, target_node_id, relationship_type)
);

CREATE INDEX idx_graph_edges_traversal ON intelligence.graph_edges (source_node_id, target_node_id, contribution_weight DESC);

-- Bitemporal Learner Progression Table
CREATE TABLE intelligence.learner_capability_temporal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES core.learner_profiles(learner_id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES intelligence.graph_nodes(id) ON DELETE RESTRICT,
  computed_score intelligence.unit_score NOT NULL,
  progression_state intelligence.progression_level NOT NULL,
  evidence_count INT NOT NULL DEFAULT 1,
  mentor_agreement_ratio intelligence.unit_score,
  supporting_artifact_ids UUID[] NOT NULL DEFAULT '{}',
  valid_period TSTZRANGE NOT NULL DEFAULT tstzrange(NOW(), NULL, '[)'),
  EXCLUDE USING gist (
    learner_id WITH =,
    node_id WITH =,
    valid_period WITH &&
  )
);

CREATE INDEX idx_temporal_current_state 
ON intelligence.learner_capability_temporal (learner_id, node_id) 
WHERE upper_inf(valid_period);

CREATE OR REPLACE FUNCTION intelligence.fn_get_learner_profile_as_of(
  p_learner_id UUID,
  p_as_of_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  node_code TEXT,
  node_name TEXT,
  node_type intelligence.graph_node_type,
  category intelligence.skill_category,
  score NUMERIC,
  progression intelligence.progression_level,
  evidence_count INT
) LANGUAGE sql STABLE AS $$
  SELECT 
    n.code,
    n.name,
    n.node_type,
    n.category,
    t.computed_score,
    t.progression_state,
    t.evidence_count
  FROM intelligence.learner_capability_temporal t
  JOIN intelligence.graph_nodes n ON n.id = t.node_id
  WHERE t.learner_id = p_learner_id
    AND t.valid_period @> p_as_of_timestamp
  ORDER BY t.computed_score DESC;
$$;

-- In-Memory Unlogged Scratchpad, Partitioned Telemetry & Materialized View
CREATE UNLOGGED TABLE analytics.unlogged_pathway_affinity_scratchpad (
  learner_id UUID NOT NULL,
  pathway_node_id UUID NOT NULL,
  affinity_score NUMERIC(5,4) NOT NULL,
  missing_skill_node_ids UUID[] DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (learner_id, pathway_node_id)
);

CREATE TABLE analytics.learning_telemetry (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  duration_seconds INT DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

CREATE TABLE analytics.learning_telemetry_y2026 PARTITION OF analytics.learning_telemetry
  FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE analytics.learning_telemetry_y2027 PARTITION OF analytics.learning_telemetry
  FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');

CREATE MATERIALIZED VIEW analytics.mv_learner_development_summary AS
SELECT 
  lp.learner_id,
  u.full_name,
  lp.education_stage,
  lp.current_school_id,
  lp.declared_interests,
  COUNT(DISTINCT a.id) AS total_verified_artifacts,
  JSONB_AGG(
    DISTINCT JSONB_BUILD_OBJECT(
      'skill_name', gn.name,
      'category', gn.category,
      'level', lct.progression_state,
      'score', lct.computed_score
    )
  ) FILTER (WHERE gn.node_type = 'SKILL' AND upper_inf(lct.valid_period)) AS active_skills_snapshot,
  MAX(a.synced_at) AS last_evidence_date
FROM core.learner_profiles lp
JOIN core.users u ON u.id = lp.learner_id
LEFT JOIN evidence.artifacts a ON a.learner_id = lp.learner_id
LEFT JOIN intelligence.learner_capability_temporal lct ON lct.learner_id = lp.learner_id AND upper_inf(lct.valid_period)
LEFT JOIN intelligence.graph_nodes gn ON gn.id = lct.node_id
GROUP BY lp.learner_id, u.full_name, lp.education_stage, lp.current_school_id, lp.declared_interests;

CREATE UNIQUE INDEX idx_mv_learner_summary_pk ON analytics.mv_learner_development_summary (learner_id);
