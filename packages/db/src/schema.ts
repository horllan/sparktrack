/**
 * Drizzle ORM schema for SparkTrack (core, evidence, intelligence).
 * halfvec and tstzrange columns are intentionally omitted — they are accessed via Kysely raw SQL.
 */
import {
  pgSchema, uuid, text, boolean, timestamp, integer, date, char, jsonb, numeric, bigserial, smallint, index,
} from 'drizzle-orm/pg-core';

export const coreSchema = pgSchema('core');
export const evidenceSchema = pgSchema('evidence');
export const intelligenceSchema = pgSchema('intelligence');

export const userRoleEnum = coreSchema.enum('user_role', [
  'LEARNER', 'PARENT', 'MENTOR', 'SCHOOL_ADMIN', 'ORG_PARTNER', 'SUPER_ADMIN',
]);
export const consentStatusEnum = coreSchema.enum('consent_status', [
  'PENDING_PARENTAL_CONSENT', 'VERIFIED_ACTIVE', 'RESTRICTED_INTERNAL_ONLY', 'REVOKED',
]);
export const programmeTypeEnum = coreSchema.enum('programme_type', [
  'HOLIDAY_CAMP', 'SCHOOL_TERM_COCURRICULAR', 'WEEKEND_WORKSHOP', 'ONLINE_COHORT',
]);
export const enrolmentStatusEnum = coreSchema.enum('enrolment_status', [
  'PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REFUNDED',
]);
export const paymentProviderEnum = coreSchema.enum('payment_provider', [
  'PAYSTACK', 'STRIPE', 'INSTITUTIONAL_INVOICE', 'SCHOLARSHIP', 'FREE_PILOT',
]);
export const artifactTypeEnum = evidenceSchema.enum('artifact_type', [
  'PROJECT_SUBMISSION', 'GIT_REPOSITORY', 'DESIGN_PORTFOLIO', 'ASSESSMENT_RESULT',
  'MENTOR_OBSERVATION', 'COMPETITION_RESULT', 'LEARNER_REFLECTION', 'BUSINESS_PROTOTYPE',
]);
export const skillCategoryEnum = intelligenceSchema.enum('skill_category', [
  'TECHNICAL', 'DIGITAL', 'CREATIVE', 'BUSINESS', 'PROFESSIONAL', 'BEHAVIOURAL_SIGNAL',
]);
export const progressionLevelEnum = intelligenceSchema.enum('progression_level', [
  'BEGINNER', 'DEVELOPING', 'COMPETENT', 'ADVANCED',
]);
export const graphNodeTypeEnum = intelligenceSchema.enum('graph_node_type', [
  'ACTIVITY', 'SKILL', 'CAPABILITY', 'CAREER_PATHWAY', 'ENTREPRENEURSHIP_PATHWAY', 'OPPORTUNITY',
]);

// ---- core ----
export const organisations = coreSchema.table('organisations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  orgType: text('org_type').notNull(),
  countryCode: char('country_code', { length: 2 }).notNull().default('NG'),
  subscriptionTier: text('subscription_tier').notNull().default('FREE_PILOT'),
  apiKeyHash: text('api_key_hash').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = coreSchema.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: userRoleEnum('role').notNull(),
  organisationId: uuid('organisation_id').references(() => organisations.id),
  fullName: text('full_name').notNull(),
  email: text('email').unique(),
  phoneNumber: text('phone_number'),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const learnerProfiles = coreSchema.table('learner_profiles', {
  learnerId: uuid('learner_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  dateOfBirth: date('date_of_birth'),
  ageGroup: text('age_group').notNull().default('UNDER_18'),
  currentSchoolId: uuid('current_school_id').references(() => organisations.id),
  educationStage: text('education_stage').notNull(),
  learnerStage: text('learner_stage').notNull().default('SECONDARY_SCHOOL'),
  educationLevel: text('education_level'),
  learningGoal: text('learning_goal').notNull().default('EXPLORE_INTERESTS'),
  currentRole: text('current_role'),
  targetRole: text('target_role'),
  whatsappOptIn: boolean('whatsapp_opt_in').notNull().default(false),
  whatsappPhoneNumber: text('whatsapp_phone_number'),
  primaryGuardianId: uuid('primary_guardian_id').references(() => users.id),
  consentStatus: consentStatusEnum('consent_status').notNull().default('PENDING_PARENTAL_CONSENT'),
  consentVerifiedAt: timestamp('consent_verified_at', { withTimezone: true }),
  consentVerificationMethod: text('consent_verification_method'),
  allowPublicPortfolio: boolean('allow_public_portfolio').notNull().default(false),
  allowPartnerTalentDiscovery: boolean('allow_partner_talent_discovery').notNull().default(false),
  publicShareToken: text('public_share_token'),
  publicShareTokenCreatedAt: timestamp('public_share_token_created_at', { withTimezone: true }),
  declaredInterests: text('declared_interests').array().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messagingPreferenceEvents = coreSchema.table('messaging_preference_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  learnerId: uuid('learner_id').notNull().references(() => learnerProfiles.learnerId, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  channel: text('channel').notNull(),
  purpose: text('purpose').notNull(),
  optedIn: boolean('opted_in').notNull(),
  source: text('source').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('idx_messaging_preference_events_learner').on(t.learnerId, t.recordedAt)]);

export const programmeCohorts = coreSchema.table('programme_cohorts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').references(() => organisations.id),
  title: text('title').notNull(),
  description: text('description'),
  programmeType: programmeTypeEnum('programme_type').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  maxCapacity: integer('max_capacity').notNull().default(30),
  currentEnrolmentCount: integer('current_enrolment_count').notNull().default(0),
  priceNgn: integer('price_ngn'),
  priceUsd: integer('price_usd'),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const activities = coreSchema.table('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  cohortId: uuid('cohort_id').notNull().references(() => programmeCohorts.id, { onDelete: 'cascade' }),
  graphNodeId: uuid('graph_node_id'),
  title: text('title').notNull(),
  description: text('description'),
  activityOrder: integer('activity_order').notNull().default(0),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  isAssessable: boolean('is_assessable').notNull().default(true),
  resourcesPayload: jsonb('resources_payload').notNull().default({ schema_version: '1.0' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cohortEnrolments = coreSchema.table('cohort_enrolments', {
  id: uuid('id').primaryKey().defaultRandom(),
  learnerId: uuid('learner_id').notNull().references(() => learnerProfiles.learnerId),
  cohortId: uuid('cohort_id').notNull().references(() => programmeCohorts.id),
  enrolledBy: uuid('enrolled_by').references(() => users.id),
  enrolmentStatus: enrolmentStatusEnum('enrolment_status').notNull().default('PENDING_PAYMENT'),
  paymentProvider: paymentProviderEnum('payment_provider'),
  paymentReference: text('payment_reference'),
  paymentAmount: integer('payment_amount'),
  paymentCurrency: char('payment_currency', { length: 3 }).default('NGN'),
  scholarshipTag: text('scholarship_tag'),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const mentorAssignments = coreSchema.table('mentor_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  mentorId: uuid('mentor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cohortId: uuid('cohort_id').notNull().references(() => programmeCohorts.id, { onDelete: 'cascade' }),
  learnerId: uuid('learner_id').references(() => learnerProfiles.learnerId, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
});

// ---- evidence ----
export const artifacts = evidenceSchema.table('artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientSyncId: uuid('client_sync_id').notNull().unique(),
  learnerId: uuid('learner_id').notNull().references(() => learnerProfiles.learnerId),
  programmeCohortId: uuid('programme_cohort_id').references(() => programmeCohorts.id),
  activityNodeId: uuid('activity_node_id'),
  artifactType: artifactTypeEnum('artifact_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  storageR2Keys: text('storage_r2_keys').array().default([]),
  externalUrls: text('external_urls').array().default([]),
  payload: jsonb('payload').notNull().default({ schema_version: '1.0' }),
  mentorVerifierId: uuid('mentor_verifier_id').references(() => users.id),
  qualityScore: numeric('quality_score', { precision: 5, scale: 4 }),
  complexityWeight: numeric('complexity_weight', { precision: 3, scale: 2 }).notNull().default('1.00'),
  capturedOfflineAt: timestamp('captured_offline_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('idx_artifacts_learner_time').on(t.learnerId, t.capturedOfflineAt)]);

export const cryptographicLedger = evidenceSchema.table('cryptographic_ledger', {
  ledgerSeq: bigserial('ledger_seq', { mode: 'number' }).primaryKey(),
  artifactId: uuid('artifact_id').notNull().unique().references(() => artifacts.id),
  learnerId: uuid('learner_id').notNull(),
  verifierId: uuid('verifier_id'),
  payloadCanonicalHash: text('payload_canonical_hash').notNull(),
  previousLedgerHash: text('previous_ledger_hash').notNull(),
  rowSignatureHash: text('row_signature_hash').notNull().unique(),
  sealedAt: timestamp('sealed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mentorSignalObservations = evidenceSchema.table('mentor_signal_observations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientSyncId: uuid('client_sync_id').notNull().unique(),
  mentorId: uuid('mentor_id').notNull().references(() => users.id),
  learnerId: uuid('learner_id').notNull().references(() => learnerProfiles.learnerId),
  artifactId: uuid('artifact_id').references(() => artifacts.id),
  cohortId: uuid('cohort_id').references(() => programmeCohorts.id),
  signal: text('signal').notNull(),
  intensity: smallint('intensity').notNull(),
  note: text('note'),
  capturedOfflineAt: timestamp('captured_offline_at', { withTimezone: true }).notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- intelligence ----
export const graphNodes = intelligenceSchema.table('graph_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  nodeType: graphNodeTypeEnum('node_type').notNull(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  category: skillCategoryEnum('category'),
  description: text('description').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const graphEdges = intelligenceSchema.table('graph_edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceNodeId: uuid('source_node_id').notNull().references(() => graphNodes.id, { onDelete: 'cascade' }),
  targetNodeId: uuid('target_node_id').notNull().references(() => graphNodes.id, { onDelete: 'cascade' }),
  relationshipType: text('relationship_type').notNull(),
  contributionWeight: numeric('contribution_weight', { precision: 5, scale: 4 }).notNull().default('0.5000'),
  isRequired: boolean('is_required').notNull().default(false),
});

export const developmentReports = intelligenceSchema.table('development_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  learnerId: uuid('learner_id').notNull().references(() => learnerProfiles.learnerId, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  profileSnapshotAt: timestamp('profile_snapshot_at', { withTimezone: true }).notNull(),
  report: jsonb('report').notNull(),
  guardrailPassed: boolean('guardrail_passed').notNull(),
  synthesisModel: text('synthesis_model').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});

