-- Blueprint Module 4 (Stream 4): Enterprise Headless Intelligence API Keys
-- Stores only a short public prefix and the SHA-256 digest of the secret key.
CREATE TABLE IF NOT EXISTS core.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES core.organisations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 2 AND 120),
  key_prefix TEXT NOT NULL CHECK (length(key_prefix) BETWEEN 8 AND 24),
  key_hash TEXT NOT NULL UNIQUE CHECK (length(key_hash) = 64),
  scopes TEXT[] NOT NULL DEFAULT ARRAY['intelligence:read', 'evidence:write']::TEXT[],
  rate_limit_per_minute INT NOT NULL DEFAULT 120 CHECK (rate_limit_per_minute BETWEEN 10 AND 10000),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org_active
  ON core.api_keys (organisation_id, created_at DESC)
  WHERE revoked_at IS NULL;

