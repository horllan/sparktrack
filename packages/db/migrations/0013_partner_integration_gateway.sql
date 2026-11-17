-- ============================================================================
-- 0013 PARTNER INTEGRATION GATEWAY
-- Lets external training platforms, schools, and LMS vendors plug into the
-- SparkTrack Intelligence Core through scoped API keys.
--
-- Design rules:
--   * Tenant isolation: every partner row is keyed by organisation_id and every
--     partner query filters on it. A key can never see another tenant's learners.
--   * Partners never handle SparkTrack learner UUIDs. They use their own IDs,
--     mapped here, and receive an opaque per-tenant reference.
--   * Consent attestations and webhook deliveries are append-only / auditable.
--   * Webhook secrets are stored encrypted (AES-256-GCM, app-level key), never raw.
-- ============================================================================

-- 1. External learner identity mapping (per tenant)
CREATE TABLE IF NOT EXISTS core.external_learner_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES core.organisations(id) ON DELETE CASCADE,
  external_learner_id TEXT NOT NULL CHECK (external_learner_id ~ '^[A-Za-z0-9._:@-]{1,128}$'),
  learner_id UUID NOT NULL REFERENCES core.learner_profiles(learner_id) ON DELETE CASCADE,
  created_by_key_id UUID REFERENCES core.api_keys(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_external_learner_per_org UNIQUE (organisation_id, external_learner_id),
  CONSTRAINT uq_learner_per_org UNIQUE (organisation_id, learner_id)
);

CREATE INDEX IF NOT EXISTS idx_external_links_learner ON core.external_learner_links (learner_id);
CREATE INDEX IF NOT EXISTS idx_external_links_org_cursor ON core.external_learner_links (organisation_id, created_at DESC, id DESC);

-- 2. Partner consent attestations (append-only NDPA audit trail)
CREATE TABLE IF NOT EXISTS core.partner_consent_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES core.organisations(id) ON DELETE RESTRICT,
  learner_id UUID NOT NULL REFERENCES core.learner_profiles(learner_id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES core.api_keys(id) ON DELETE SET NULL,
  consent_status core.consent_status NOT NULL,
  attestation_method TEXT NOT NULL CHECK (attestation_method IN (
    'ADULT_SELF_CONSENT',
    'GUARDIAN_WRITTEN_CONSENT',
    'GUARDIAN_DIGITAL_CONSENT',
    'INSTITUTIONAL_ENROLMENT_AGREEMENT',
    'CONSENT_WITHDRAWN'
  )),
  guardian_name TEXT CHECK (guardian_name IS NULL OR length(trim(guardian_name)) BETWEEN 2 AND 120),
  -- Only a SHA-256 digest of the guardian contact is kept, for later matching without storing raw PII.
  guardian_contact_sha256 TEXT CHECK (guardian_contact_sha256 IS NULL OR length(guardian_contact_sha256) = 64),
  evidence_reference TEXT CHECK (evidence_reference IS NULL OR length(evidence_reference) <= 200),
  allow_public_portfolio BOOLEAN NOT NULL DEFAULT FALSE,
  allow_partner_talent_discovery BOOLEAN NOT NULL DEFAULT FALSE,
  attested_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_consent_learner ON core.partner_consent_attestations (learner_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION core.fn_block_partner_consent_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'core.partner_consent_attestations is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_partner_consent ON core.partner_consent_attestations;
CREATE TRIGGER trg_immutable_partner_consent
  BEFORE UPDATE OR DELETE ON core.partner_consent_attestations
  FOR EACH ROW EXECUTE FUNCTION core.fn_block_partner_consent_mutation();

-- 3. Idempotency keys (safe retries for every partner write)
CREATE TABLE IF NOT EXISTS core.partner_idempotency_keys (
  api_key_id UUID NOT NULL REFERENCES core.api_keys(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
  request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64),
  state TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (state IN ('IN_PROGRESS', 'COMPLETED')),
  response_status INT,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (api_key_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_partner_idempotency_created ON core.partner_idempotency_keys (created_at);

-- 4. Outbound webhook endpoints
CREATE TABLE IF NOT EXISTS core.partner_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES core.organisations(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (url ~ '^https?://' AND length(url) <= 2048),
  description TEXT CHECK (description IS NULL OR length(description) <= 200),
  events TEXT[] NOT NULL CHECK (cardinality(events) BETWEEN 1 AND 20),
  secret_ciphertext TEXT NOT NULL,
  secret_prefix TEXT NOT NULL CHECK (length(secret_prefix) BETWEEN 6 AND 24),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  consecutive_failures INT NOT NULL DEFAULT 0,
  disabled_reason TEXT,
  created_by_key_id UUID REFERENCES core.api_keys(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org_active
  ON core.partner_webhook_endpoints (organisation_id)
  WHERE is_active;

-- 5. Webhook delivery outbox (at-least-once, worker-safe via SKIP LOCKED)
CREATE TABLE IF NOT EXISTS core.partner_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES core.partner_webhook_endpoints(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES core.organisations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type ~ '^[a-z]+\.[a-z_.]+$'),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_FLIGHT', 'DELIVERED', 'FAILED', 'DEAD')),
  attempt_count INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  last_response_status INT,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_delivery_event_endpoint UNIQUE (endpoint_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due
  ON core.partner_webhook_deliveries (next_attempt_at)
  WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_stale
  ON core.partner_webhook_deliveries (locked_until)
  WHERE status = 'IN_FLIGHT';

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org_recent
  ON core.partner_webhook_deliveries (organisation_id, created_at DESC);

-- 6. Lock down direct access: these tables are only reachable through the API service role.
ALTER TABLE core.external_learner_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.partner_consent_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.partner_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.partner_webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.partner_webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- 7. Register new assets in the governance data catalog (Imperva-aligned classification).
INSERT INTO governance.data_catalog (
  domain_mesh, schema_name, table_name, column_name,
  classification_tier, masking_strategy, retention_policy, compliance_framework, description
)
VALUES
  ('CORE_IDENTITY', 'core', 'external_learner_links', 'external_learner_id',
   'TIER_3_CONFIDENTIAL_PII', 'NONE', 'Deleted when the partner unlinks the learner',
   'NDPA_2023_SEC_29_PROCESSOR_CONTRACT', 'Partner-side learner identifier, isolated per tenant.'),
  ('CORE_IDENTITY', 'core', 'partner_consent_attestations', 'guardian_contact_sha256',
   'TIER_4_RESTRICTED_MINOR_SECRETS', 'SHA256_TOKENIZED', 'Kept while the learner profile exists',
   'NDPA_2023_SEC_31_CHILD_DATA', 'One-way digest of the guardian contact recorded with a partner consent attestation.'),
  ('CORE_IDENTITY', 'core', 'partner_webhook_endpoints', 'secret_ciphertext',
   'TIER_4_RESTRICTED_MINOR_SECRETS', 'SHA256_TOKENIZED', 'Replaced on rotation, deleted with the endpoint',
   'ISO_27001_CRYPTO_CONTROL', 'AES-256-GCM encrypted webhook signing secret.')
ON CONFLICT (schema_name, table_name, column_name) DO NOTHING;
