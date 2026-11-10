-- ============================================================================
-- Migration 0012: Imperva-Aligned Data Security, Classification, Catalog,
-- Dynamic Masking, Data Mesh Domain Products & Data Activity Monitoring (DAM)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS governance;

-- 1. Centralized Data Catalog & 4-Tier Classification Registry
CREATE TABLE IF NOT EXISTS governance.data_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_mesh TEXT NOT NULL CHECK (domain_mesh IN (
    'CORE_IDENTITY', 'EVIDENCE_VAULT', 'INTELLIGENCE_CORE', 'ANALYTICS_PRODUCTS'
  )),
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  classification_tier TEXT NOT NULL CHECK (classification_tier IN (
    'TIER_1_PUBLIC', 'TIER_2_INTERNAL', 'TIER_3_CONFIDENTIAL_PII', 'TIER_4_RESTRICTED_MINOR_SECRETS'
  )),
  masking_strategy TEXT NOT NULL CHECK (masking_strategy IN (
    'NONE', 'PARTIAL_PHONE', 'PARTIAL_EMAIL', 'FIRST_NAME_STAGE_ONLY', 'SHA256_TOKENIZED', 'REDACTED_DATE'
  )),
  retention_policy TEXT NOT NULL,
  compliance_framework TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (schema_name, table_name, column_name)
);

-- Seed authoritative Data Catalog entries across all 4 Data Mesh domains
INSERT INTO governance.data_catalog (
  domain_mesh, schema_name, table_name, column_name,
  classification_tier, masking_strategy, retention_policy, compliance_framework, description
)
VALUES
  ('CORE_IDENTITY', 'core', 'users', 'full_name', 'TIER_3_CONFIDENTIAL_PII', 'FIRST_NAME_STAGE_ONLY', 'Active account + 3 years', 'NDPA_2023_SEC_31 / GDPR_ART_30', 'Learner, parent, mentor, or administrator full legal name.'),
  ('CORE_IDENTITY', 'core', 'users', 'email', 'TIER_3_CONFIDENTIAL_PII', 'PARTIAL_EMAIL', 'Active account + 3 years', 'NDPA_2023_SEC_24 / GDPR_ART_30', 'Primary electronic mail address for authentication and notifications.'),
  ('CORE_IDENTITY', 'core', 'users', 'phone_number', 'TIER_3_CONFIDENTIAL_PII', 'PARTIAL_PHONE', 'Active account + 3 years', 'NDPA_2023_SEC_31', 'Guardian or adult learner mobile phone number for SMS OTP consent.'),
  ('CORE_IDENTITY', 'core', 'learner_profiles', 'date_of_birth', 'TIER_4_RESTRICTED_MINOR_SECRETS', 'REDACTED_DATE', 'Until learner reaches 18 + 1 year', 'NDPA_2023_SEC_31_CHILD_DATA', 'Minor birth date used strictly for under-18 child-safety gating.'),
  ('CORE_IDENTITY', 'core', 'learner_profiles', 'whatsapp_phone_number', 'TIER_4_RESTRICTED_MINOR_SECRETS', 'PARTIAL_PHONE', 'Revocable immediately on opt-out', 'NDPA_2023_SEC_31_CHILD_DATA', 'Opt-in WhatsApp contact number managed by guardian or adult learner.'),
  ('CORE_IDENTITY', 'core', 'learner_profiles', 'public_share_token', 'TIER_1_PUBLIC', 'SHA256_TOKENIZED', 'Revocable immediately on privacy toggle', 'NDPA_2023_PRIVACY_BY_DESIGN', 'Opaque revocable capability portfolio token (/p/:token) replacing raw UUIDs.'),
  ('CORE_IDENTITY', 'core', 'api_keys', 'key_hash', 'TIER_4_RESTRICTED_MINOR_SECRETS', 'SHA256_TOKENIZED', 'Until key revocation or expiry', 'ISO_27001_CRYPTO_CONTROL', 'SHA-256 digest of enterprise headless API key (plaintext never stored).'),
  ('EVIDENCE_VAULT', 'evidence', 'parental_consent_challenges', 'otp_hmac', 'TIER_4_RESTRICTED_MINOR_SECRETS', 'SHA256_TOKENIZED', '10-minute active TTL + audit retention', 'NDPA_2023_SEC_31_VPC', 'HMAC-SHA256 digest of 6-digit parental consent SMS verification code.'),
  ('EVIDENCE_VAULT', 'evidence', 'artifacts', 'description', 'TIER_2_INTERNAL', 'NONE', 'Longitudinal portfolio lifetime', 'NDPA_2023_DATA_MINIMIZATION', 'Project submission summary scanned by automated PII discovery guardrail.'),
  ('EVIDENCE_VAULT', 'evidence', 'cryptographic_ledger', 'row_signature_hash', 'TIER_1_PUBLIC', 'NONE', 'Immutable 7-year verifiable ledger', 'ISO_27001_INTEGRITY', 'Tamper-evident SHA-256 hash chain sealing learner project evidence.'),
  ('INTELLIGENCE_CORE', 'intelligence', 'learner_capability_temporal', 'computed_score', 'TIER_2_INTERNAL', 'NONE', 'Bitemporal longitudinal history', 'SPARKTRACK_CORE_IP', 'Time-decayed evidence-weighted skill mastery score S(u,k,t).'),
  ('INTELLIGENCE_CORE', 'intelligence', 'development_reports', 'sections_json', 'TIER_3_CONFIDENTIAL_PII', 'FIRST_NAME_STAGE_ONLY', 'Longitudinal learner history', 'NDPA_2023_CHILD_SAFETY_GUARDRAIL', '13-section developmental report validated by deterministic language guardrails.'),
  ('ANALYTICS_PRODUCTS', 'analytics', 'mv_learner_development_summary', 'verified_artifact_count', 'TIER_2_INTERNAL', 'NONE', 'Refreshed materialized summary', 'DATA_MESH_ANALYTICS_PRODUCT', 'Aggregated cohort capability readiness metric for institutional dashboards.')
ON CONFLICT (schema_name, table_name, column_name) DO UPDATE SET
  classification_tier = EXCLUDED.classification_tier,
  masking_strategy = EXCLUDED.masking_strategy,
  retention_policy = EXCLUDED.retention_policy,
  compliance_framework = EXCLUDED.compliance_framework,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 2. Database-Level Dynamic Data Masking (DDM) Functions
CREATE OR REPLACE FUNCTION governance.fn_mask_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_phone IS NULL OR length(trim(p_phone)) < 7 THEN 'Redacted'
    ELSE left(trim(p_phone), 6) || '***' || right(trim(p_phone), 2)
  END;
$$;

CREATE OR REPLACE FUNCTION governance.fn_mask_email(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_email IS NULL OR position('@' in p_email) <= 1 THEN 'Redacted'
    ELSE left(p_email, 1) || '***@' || split_part(p_email, '@', 2)
  END;
$$;

CREATE OR REPLACE FUNCTION governance.fn_mask_display_name(p_full_name TEXT, p_stage TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(NULLIF(split_part(trim(COALESCE(p_full_name, 'Explorer')), ' ', 1), ''), 'Explorer')
         || ' (' || COALESCE(p_stage, 'Learner') || ')';
$$;

-- 3. Data Mesh Sanctioned Data Product View (Zero Raw PII)
CREATE OR REPLACE VIEW governance.dp_verified_talent_mesh AS
SELECT
  'SPK-' || upper(left(lp.learner_id::text, 8)) AS tokenized_learner_ref,
  governance.fn_mask_display_name(u.full_name, lp.education_stage) AS masked_display_name,
  lp.education_stage,
  lp.learner_stage,
  lp.learning_goal,
  o.name AS organisation_name,
  lp.declared_interests,
  lp.allow_public_portfolio,
  lp.allow_partner_talent_discovery,
  lp.public_share_token
FROM core.learner_profiles lp
JOIN core.users u ON u.id = lp.learner_id
LEFT JOIN core.organisations o ON o.id = lp.current_school_id
WHERE lp.consent_status = 'VERIFIED_ACTIVE';

-- 4. Automated Schema Discovery View (Finds all columns across the 4 Data Mesh schemas)
CREATE OR REPLACE VIEW governance.vw_schema_discovery AS
SELECT
  c.table_schema AS schema_name,
  c.table_name,
  c.column_name,
  c.data_type,
  dc.domain_mesh,
  COALESCE(dc.classification_tier, 'TIER_2_INTERNAL') AS effective_classification,
  COALESCE(dc.masking_strategy, 'NONE') AS masking_strategy,
  (dc.id IS NOT NULL) AS is_explicitly_cataloged
FROM information_schema.columns c
LEFT JOIN governance.data_catalog dc
  ON dc.schema_name = c.table_schema
 AND dc.table_name = c.table_name
 AND dc.column_name = c.column_name
WHERE c.table_schema IN ('core', 'evidence', 'intelligence', 'analytics');

-- 5. Append-Only Data Activity Monitoring (DAM) & Anomaly Audit Log
CREATE TABLE IF NOT EXISTS governance.data_activity_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_role TEXT NOT NULL,
  action_type TEXT NOT NULL,
  resource_domain TEXT NOT NULL CHECK (resource_domain IN (
    'CORE_IDENTITY', 'EVIDENCE_VAULT', 'INTELLIGENCE_CORE', 'ANALYTICS_PRODUCTS'
  )),
  classification_tier TEXT NOT NULL CHECK (classification_tier IN (
    'TIER_1_PUBLIC', 'TIER_2_INTERNAL', 'TIER_3_CONFIDENTIAL_PII', 'TIER_4_RESTRICTED_MINOR_SECRETS'
  )),
  target_ref TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN (
    'ALLOWED', 'DYNAMICALLY_MASKED', 'PII_DISCOVERY_REDACTED', 'VELOCITY_ALERT'
  )),
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dam_audit_created_at
  ON governance.data_activity_audit (created_at DESC);

CREATE OR REPLACE FUNCTION governance.fn_immutable_dam_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'governance.data_activity_audit is append-only and cannot be modified or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_dam_audit ON governance.data_activity_audit;
CREATE TRIGGER trg_immutable_dam_audit
  BEFORE UPDATE OR DELETE ON governance.data_activity_audit
  FOR EACH ROW
  EXECUTE FUNCTION governance.fn_immutable_dam_audit();

