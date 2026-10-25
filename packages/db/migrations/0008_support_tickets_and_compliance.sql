-- ============================================================================
-- Migration 0008: Enterprise Support Desk, Partnership Inquiries & DPO Queue
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE core.ticket_category AS ENUM (
    'GENERAL_SUPPORT',
    'PARENT_CONSENT_HELP',
    'SCHOOL_PARTNERSHIP',
    'SCHOLARSHIP_SPONSORSHIP',
    'PRIVACY_DPO_REQUEST',
    'TECHNICAL_ISSUE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE core.ticket_status AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'ESCALATED_DPO',
    'RESOLVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE core.ticket_priority AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT_COMPLIANCE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS core.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_reference VARCHAR(32) NOT NULL UNIQUE,
  category core.ticket_category NOT NULL DEFAULT 'GENERAL_SUPPORT',
  priority core.ticket_priority NOT NULL DEFAULT 'NORMAL',
  status core.ticket_status NOT NULL DEFAULT 'OPEN',
  requester_name VARCHAR(140) NOT NULL,
  requester_email VARCHAR(255) NOT NULL,
  requester_phone VARCHAR(40),
  requester_role VARCHAR(40) NOT NULL DEFAULT 'VISITOR',
  organisation_name VARCHAR(180),
  country_code VARCHAR(8) NOT NULL DEFAULT 'NG',
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  staff_resolution_notes TEXT,
  assigned_to_user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created
  ON core.support_tickets (status, created_at DESC);

