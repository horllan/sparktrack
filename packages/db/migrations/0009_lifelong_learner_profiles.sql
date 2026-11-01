-- Expand SparkTrack from a school-stage learner profile to lifelong learning.
ALTER TABLE core.learner_profiles
  ALTER COLUMN date_of_birth DROP NOT NULL,
  ADD COLUMN age_group TEXT NOT NULL DEFAULT 'UNDER_18',
  ADD COLUMN learner_stage TEXT NOT NULL DEFAULT 'SECONDARY_SCHOOL',
  ADD COLUMN education_level TEXT,
  ADD COLUMN learning_goal TEXT NOT NULL DEFAULT 'EXPLORE_INTERESTS',
  ADD COLUMN "current_role" TEXT,
  ADD COLUMN target_role TEXT,
  ADD COLUMN whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN whatsapp_phone_number TEXT;

ALTER TABLE core.learner_profiles
  ADD CONSTRAINT learner_profiles_age_group_check CHECK (age_group IN ('UNDER_18', 'ADULT')),
  ADD CONSTRAINT learner_profiles_stage_check CHECK (learner_stage IN (
    'SECONDARY_SCHOOL', 'UNIVERSITY', 'NYSC', 'EMPLOYED', 'CAREER_TRANSITION',
    'CAREER_GROWTH', 'SELF_TAUGHT', 'NO_FORMAL_EDUCATION', 'OTHER'
  )),
  ADD CONSTRAINT learner_profiles_goal_check CHECK (learning_goal IN (
    'EXPLORE_INTERESTS', 'BUILD_PRACTICAL_SKILLS', 'GET_FIRST_JOB', 'CHANGE_CAREER',
    'GROW_IN_CAREER', 'START_BUSINESS', 'RETURN_TO_EDUCATION', 'PERSONAL_GROWTH', 'OTHER'
  )),
  ADD CONSTRAINT learner_profiles_whatsapp_contact_check CHECK (
    NOT whatsapp_opt_in OR (whatsapp_phone_number IS NOT NULL AND length(whatsapp_phone_number) BETWEEN 8 AND 24)
  );

-- Existing DOBs establish age group for existing accounts; adult accounts no longer require a guardian gate.
UPDATE core.learner_profiles
SET age_group = CASE
  WHEN date_of_birth <= CURRENT_DATE - INTERVAL '18 years' THEN 'ADULT'
  ELSE 'UNDER_18'
END;

UPDATE core.learner_profiles
SET consent_status = 'VERIFIED_ACTIVE'::core.consent_status,
    consent_verified_at = COALESCE(consent_verified_at, NOW()),
    consent_verification_method = 'ADULT_SELF_ATTESTATION'
WHERE age_group = 'ADULT' AND consent_status = 'PENDING_PARENTAL_CONSENT'::core.consent_status;

-- A parent link does not grant profile access once the learner is an adult.
CREATE OR REPLACE FUNCTION core.fn_can_access_learner(p_learner UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = core, pg_temp AS $$
  SELECT
    core.fn_current_user_id() IS NOT NULL AND (
      p_learner = core.fn_current_user_id()
      OR EXISTS (SELECT 1 FROM core.learner_profiles lp
                 WHERE lp.learner_id = p_learner AND lp.age_group = 'UNDER_18'
                   AND lp.date_of_birth > CURRENT_DATE - INTERVAL '18 years'
                   AND lp.primary_guardian_id = core.fn_current_user_id())
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

CREATE INDEX idx_learner_profiles_stage_goal ON core.learner_profiles (learner_stage, learning_goal);

CREATE TABLE core.messaging_preference_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES core.learner_profiles(learner_id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
  channel TEXT NOT NULL CHECK (channel = 'WHATSAPP'),
  purpose TEXT NOT NULL CHECK (purpose = 'LEARNING_REMINDERS'),
  opted_in BOOLEAN NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('LEARNER_ONBOARDING', 'LEARNER_SETTINGS', 'GUARDIAN_SETTINGS')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messaging_preference_events_learner
  ON core.messaging_preference_events (learner_id, recorded_at DESC);
