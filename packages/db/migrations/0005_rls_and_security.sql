-- ============================================================================
-- SPARKTRACK: Row-Level Security & Child-Safety Enforcement (NDPA)
-- Migration: 0005_rls_and_security.sql
--
-- Identity model: core.users.id == Supabase auth.users.id (JWT `sub`).
-- The API sets claims per transaction:
--   SELECT set_config('request.jwt.claims', '{"sub":"<uuid>"}', true);
-- Works on Supabase and on plain Docker Postgres (no `auth` schema needed).
-- Trusted server jobs use a BYPASSRLS role; end-user paths must not.
-- ============================================================================

CREATE OR REPLACE FUNCTION core.fn_current_user_id() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT NULLIF((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid
$$;

CREATE OR REPLACE FUNCTION core.fn_current_user_role() RETURNS core.user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = core, pg_temp AS $$
  SELECT role FROM core.users WHERE id = core.fn_current_user_id()
$$;

-- Can the current user access this learner? (self, guardian, assigned mentor, school admin, super admin)
CREATE OR REPLACE FUNCTION core.fn_can_access_learner(p_learner UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = core, pg_temp AS $$
  SELECT
    core.fn_current_user_id() IS NOT NULL AND (
      p_learner = core.fn_current_user_id()
      OR EXISTS (SELECT 1 FROM core.learner_profiles lp
                 WHERE lp.learner_id = p_learner AND lp.primary_guardian_id = core.fn_current_user_id())
      OR EXISTS (SELECT 1 FROM core.mentor_assignments ma
                 WHERE ma.mentor_id = core.fn_current_user_id() AND ma.is_active
                   AND (ma.learner_id = p_learner OR ma.learner_id IS NULL AND ma.cohort_id IN
                        (SELECT ce.cohort_id FROM core.cohort_enrolments ce WHERE ce.learner_id = p_learner)))
      OR EXISTS (SELECT 1 FROM core.learner_profiles lp
                 JOIN core.users u ON u.id = core.fn_current_user_id()
                 WHERE lp.learner_id = p_learner AND u.role = 'SCHOOL_ADMIN'
                   AND lp.current_school_id = u.organisation_id)
      OR core.fn_current_user_role() = 'SUPER_ADMIN'
    )
$$;

-- Minors default to private: enforce at the DB level, not only in the app.
ALTER TABLE core.learner_profiles
  ADD CONSTRAINT chk_minor_privacy_requires_consent CHECK (
    (NOT allow_public_portfolio AND NOT allow_partner_talent_discovery)
    OR consent_status = 'VERIFIED_ACTIVE'
  );

-- Enable + FORCE RLS
ALTER TABLE core.users                              ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.learner_profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.cohort_enrolments                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.artifacts                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.cryptographic_ledger           ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.mentor_signal_observations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence.learner_capability_temporal ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence.development_reports        ENABLE ROW LEVEL SECURITY;

ALTER TABLE core.learner_profiles                   FORCE ROW LEVEL SECURITY;
ALTER TABLE evidence.artifacts                      FORCE ROW LEVEL SECURITY;

CREATE POLICY users_self_or_related ON core.users FOR SELECT
  USING (id = core.fn_current_user_id() OR core.fn_can_access_learner(id)
         OR core.fn_current_user_role() = 'SUPER_ADMIN');

CREATE POLICY learner_profiles_select ON core.learner_profiles FOR SELECT
  USING (core.fn_can_access_learner(learner_id));
CREATE POLICY learner_profiles_update ON core.learner_profiles FOR UPDATE
  USING (core.fn_can_access_learner(learner_id) AND core.fn_current_user_role() IN ('PARENT','SUPER_ADMIN'));

CREATE POLICY enrolments_select ON core.cohort_enrolments FOR SELECT
  USING (core.fn_can_access_learner(learner_id));

-- Evidence is readable by authorised parties; consent must be VERIFIED_ACTIVE for non-admin reads.
CREATE POLICY artifacts_select ON evidence.artifacts FOR SELECT
  USING (core.fn_can_access_learner(learner_id)
         AND (core.fn_current_user_role() = 'SUPER_ADMIN' OR EXISTS (
              SELECT 1 FROM core.learner_profiles lp
              WHERE lp.learner_id = artifacts.learner_id AND lp.consent_status = 'VERIFIED_ACTIVE')));
CREATE POLICY artifacts_insert ON evidence.artifacts FOR INSERT
  WITH CHECK (core.fn_can_access_learner(learner_id));

CREATE POLICY ledger_select ON evidence.cryptographic_ledger FOR SELECT
  USING (core.fn_can_access_learner(learner_id));
CREATE POLICY signals_select ON evidence.mentor_signal_observations FOR SELECT
  USING (core.fn_can_access_learner(learner_id));
CREATE POLICY signals_insert ON evidence.mentor_signal_observations FOR INSERT
  WITH CHECK (mentor_id = core.fn_current_user_id() AND core.fn_can_access_learner(learner_id));
CREATE POLICY capability_select ON intelligence.learner_capability_temporal FOR SELECT
  USING (core.fn_can_access_learner(learner_id));
CREATE POLICY reports_select ON intelligence.development_reports FOR SELECT
  USING (core.fn_can_access_learner(learner_id));

-- Defence in depth: the ledger is append-only even for privileged roles.
REVOKE UPDATE, DELETE, TRUNCATE ON evidence.cryptographic_ledger FROM PUBLIC;
CREATE OR REPLACE FUNCTION evidence.fn_prevent_ledger_truncate() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'SparkTrack Security Violation: evidence.cryptographic_ledger cannot be truncated.';
END; $$;
CREATE TRIGGER trg_immutable_ledger_truncate
BEFORE TRUNCATE ON evidence.cryptographic_ledger
FOR EACH STATEMENT EXECUTE FUNCTION evidence.fn_prevent_ledger_truncate();

-- Concurrency: serialise ledger sealing so the hash chain cannot fork under parallel inserts.
CREATE OR REPLACE FUNCTION evidence.fn_seal_ledger_entry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = evidence, public, extensions, pg_temp AS $$
DECLARE v_prev_hash TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('sparktrack_ledger_seal'));
  SELECT row_signature_hash INTO v_prev_hash
  FROM evidence.cryptographic_ledger ORDER BY ledger_seq DESC LIMIT 1;
  IF v_prev_hash IS NULL THEN v_prev_hash := 'SPARKTRACK_GENESIS_BLOCK_2026'; END IF;
  NEW.previous_ledger_hash := v_prev_hash;
  NEW.row_signature_hash := encode(
    sha256(convert_to(v_prev_hash || '|' || NEW.artifact_id::text || '|' || NEW.learner_id::text || '|' || NEW.payload_canonical_hash, 'UTF8')),
    'hex');
  RETURN NEW;
END; $$;

