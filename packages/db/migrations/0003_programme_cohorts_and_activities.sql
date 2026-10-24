-- ============================================================================
-- SPARKTRACK: Programme Cohorts, Activities, Enrolments, Mentor Assignments
-- Migration: 0003_programme_cohorts_and_activities.sql
-- ============================================================================

CREATE TYPE core.programme_type AS ENUM (
  'HOLIDAY_CAMP', 'SCHOOL_TERM_COCURRICULAR', 'WEEKEND_WORKSHOP', 'ONLINE_COHORT'
);
CREATE TYPE core.enrolment_status AS ENUM (
  'PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REFUNDED'
);
CREATE TYPE core.payment_provider AS ENUM (
  'PAYSTACK', 'STRIPE', 'INSTITUTIONAL_INVOICE', 'SCHOLARSHIP', 'FREE_PILOT'
);

CREATE TABLE core.programme_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES core.organisations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  programme_type core.programme_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  max_capacity INT NOT NULL DEFAULT 30,
  current_enrolment_count INT NOT NULL DEFAULT 0,
  price_ngn INT,  -- kobo
  price_usd INT,  -- cents
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cohort_dates CHECK (end_date > start_date),
  CONSTRAINT chk_capacity CHECK (current_enrolment_count <= max_capacity)
);
CREATE INDEX idx_cohorts_active ON core.programme_cohorts (is_active, start_date DESC);

CREATE TABLE core.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES core.programme_cohorts(id) ON DELETE CASCADE,
  graph_node_id UUID REFERENCES intelligence.graph_nodes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  activity_order INT NOT NULL DEFAULT 0,
  duration_minutes INT NOT NULL DEFAULT 60,
  is_assessable BOOLEAN NOT NULL DEFAULT TRUE,
  resources_payload JSONB NOT NULL DEFAULT '{"schema_version": "1.0"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_activities_cohort ON core.activities (cohort_id, activity_order);

CREATE TABLE core.cohort_enrolments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES core.learner_profiles(learner_id) ON DELETE RESTRICT,
  cohort_id UUID NOT NULL REFERENCES core.programme_cohorts(id) ON DELETE RESTRICT,
  enrolled_by UUID REFERENCES core.users(id),
  enrolment_status core.enrolment_status NOT NULL DEFAULT 'PENDING_PAYMENT',
  payment_provider core.payment_provider,
  payment_reference TEXT,
  payment_amount INT,
  payment_currency CHAR(3) DEFAULT 'NGN',
  scholarship_tag TEXT,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (learner_id, cohort_id)
);
CREATE INDEX idx_enrolments_learner ON core.cohort_enrolments (learner_id, enrolment_status);
CREATE INDEX idx_enrolments_cohort ON core.cohort_enrolments (cohort_id, enrolment_status);
CREATE UNIQUE INDEX uq_payment_reference ON core.cohort_enrolments (payment_provider, payment_reference)
  WHERE payment_reference IS NOT NULL;  -- webhook idempotency

-- evidence.artifacts.programme_cohort_id gets its FK now that the table exists.
-- activity_node_id refers to an ACTIVITY node in the capability graph.
ALTER TABLE evidence.artifacts
  ADD CONSTRAINT fk_artifacts_cohort
  FOREIGN KEY (programme_cohort_id) REFERENCES core.programme_cohorts(id) ON DELETE SET NULL;
ALTER TABLE evidence.artifacts
  ADD CONSTRAINT fk_artifacts_activity_node
  FOREIGN KEY (activity_node_id) REFERENCES intelligence.graph_nodes(id) ON DELETE SET NULL;

CREATE TABLE core.mentor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES core.programme_cohorts(id) ON DELETE CASCADE,
  learner_id UUID REFERENCES core.learner_profiles(learner_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX uq_mentor_assignment
  ON core.mentor_assignments (mentor_id, cohort_id, COALESCE(learner_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_mentor_assignments_active ON core.mentor_assignments (mentor_id, is_active);

-- Mentor micro-rubric behavioural observations (evolving signals, never labels)
CREATE TABLE evidence.mentor_signal_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_sync_id UUID UNIQUE NOT NULL,
  mentor_id UUID NOT NULL REFERENCES core.users(id),
  learner_id UUID NOT NULL REFERENCES core.learner_profiles(learner_id) ON DELETE RESTRICT,
  artifact_id UUID REFERENCES evidence.artifacts(id) ON DELETE SET NULL,
  cohort_id UUID REFERENCES core.programme_cohorts(id) ON DELETE SET NULL,
  signal TEXT NOT NULL CHECK (signal IN
    ('persistence','collaboration','communication','creativity','analytical_thinking','problem_solving','initiative')),
  intensity SMALLINT NOT NULL CHECK (intensity BETWEEN 1 AND 4),
  note TEXT,
  captured_offline_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_signal_obs_learner ON evidence.mentor_signal_observations (learner_id, signal);

-- Persisted development reports (versioned; guardrail result stored for audit)
CREATE TABLE intelligence.development_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES core.learner_profiles(learner_id) ON DELETE CASCADE,
  version INT NOT NULL,
  profile_snapshot_at TIMESTAMPTZ NOT NULL,
  report JSONB NOT NULL,
  guardrail_passed BOOLEAN NOT NULL,
  synthesis_model TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (learner_id, version)
);

