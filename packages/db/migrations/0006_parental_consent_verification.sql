-- ============================================================================
-- SPARKTRACK: Verifiable Parental Consent
-- Migration: 0006_parental_consent_verification.sql
-- ============================================================================

CREATE TABLE evidence.parental_consent_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES core.learner_profiles(learner_id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
  otp_hmac TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  failed_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  consumed_at TIMESTAMPTZ,
  consent_given BOOLEAN,
  allow_public_portfolio BOOLEAN,
  allow_partner_talent_discovery BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consent_challenges_active
  ON evidence.parental_consent_challenges (learner_id, created_at DESC)
  WHERE consumed_at IS NULL;

CREATE TABLE evidence.parental_consent_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES core.learner_profiles(learner_id) ON DELETE RESTRICT,
  guardian_id UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
  consent_status core.consent_status NOT NULL,
  consent_verification_method TEXT NOT NULL CHECK (consent_verification_method = 'SMS_OTP'),
  allow_public_portfolio BOOLEAN NOT NULL DEFAULT FALSE,
  allow_partner_talent_discovery BOOLEAN NOT NULL DEFAULT FALSE,
  challenge_id UUID NOT NULL UNIQUE REFERENCES evidence.parental_consent_challenges(id) ON DELETE RESTRICT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parental_consent_audit_learner
  ON evidence.parental_consent_audit (learner_id, recorded_at DESC);
