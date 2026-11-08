-- Shareable, revocable public portfolio links (/p/<token>).
-- The token is an opaque random value, so public URLs never expose the learner UUID
-- and cannot be enumerated. Rotating the token instantly invalidates old links.
ALTER TABLE core.learner_profiles
  ADD COLUMN public_share_token TEXT,
  ADD COLUMN public_share_token_created_at TIMESTAMPTZ;

CREATE UNIQUE INDEX idx_learner_profiles_public_share_token
  ON core.learner_profiles (public_share_token)
  WHERE public_share_token IS NOT NULL;

-- Revoke the link automatically whenever public sharing or consent is withdrawn,
-- regardless of which code path performs the update.
CREATE OR REPLACE FUNCTION core.fn_revoke_share_token_on_privacy_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT NEW.allow_public_portfolio OR NEW.consent_status <> 'VERIFIED_ACTIVE' THEN
    NEW.public_share_token := NULL;
    NEW.public_share_token_created_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_revoke_share_token_on_privacy_change
  BEFORE INSERT OR UPDATE ON core.learner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION core.fn_revoke_share_token_on_privacy_change();

-- Backstop: a share token can only exist while consent is verified and sharing is on.
ALTER TABLE core.learner_profiles
  ADD CONSTRAINT chk_share_token_requires_public_consent CHECK (
    public_share_token IS NULL
    OR (allow_public_portfolio AND consent_status = 'VERIFIED_ACTIVE')
  ),
  ADD CONSTRAINT chk_share_token_format CHECK (
    public_share_token IS NULL OR public_share_token ~ '^[A-Za-z0-9_-]{22,64}$'
  );
