import { z } from 'zod';
import { UuidSchema, TimestampSchema } from '../common/schemas.js';

/** Evidence artifact types matching the PostgreSQL enum */
export const ArtifactTypeSchema = z.enum([
  'PROJECT_SUBMISSION',
  'GIT_REPOSITORY',
  'DESIGN_PORTFOLIO',
  'ASSESSMENT_RESULT',
  'MENTOR_OBSERVATION',
  'COMPETITION_RESULT',
  'LEARNER_REFLECTION',
  'BUSINESS_PROTOTYPE',
]);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

/**
 * Offline-first evidence sync payload.
 * Submitted from IndexedDB queue via POST /v1/evidence/sync
 */
export const EvidenceSyncPayloadSchema = z.object({
  /** Client-generated UUID for idempotent deduplication */
  clientSyncId: UuidSchema,
  learnerId: UuidSchema,
  programmeCohortId: UuidSchema.optional(),
  activityNodeId: UuidSchema.optional(),
  artifactType: ArtifactTypeSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  /** Cloudflare R2 object keys for uploaded files */
  storageR2Keys: z.array(z.string()).default([]),
  /** External URLs (e.g., GitHub repo, Figma link) */
  externalUrls: z.array(z.string().url()).default([]),
  /**
   * Schema-validated polymorphic payload.
   * Must include schema_version for forward compatibility.
   */
  payload: z.object({
    schema_version: z.string().default('1.0'),
  }).passthrough(),
  mentorVerifierId: UuidSchema.optional(),
  qualityScore: z.number().min(0).max(1).optional(),
  complexityWeight: z.number().min(0.5).max(3.0).default(1.0),
  /** When the evidence was captured offline (client timestamp) */
  capturedOfflineAt: TimestampSchema,
});
export type EvidenceSyncPayload = z.infer<typeof EvidenceSyncPayloadSchema>;

/** Behavioural signal types observed by mentors */
export const BehaviouralSignalSchema = z.enum([
  'persistence',
  'collaboration',
  'communication',
  'creativity',
  'analytical_thinking',
  'problem_solving',
  'initiative',
]);
export type BehaviouralSignal = z.infer<typeof BehaviouralSignalSchema>;

/**
 * Mentor 3-Minute Mobile-Offline Micro-Rubric.
 * Submitted alongside or after evidence artifacts.
 */
export const MentorMicroRubricSchema = z.object({
  /** Client-generated UUID for idempotent sync */
  clientSyncId: UuidSchema,
  mentorId: UuidSchema,
  learnerId: UuidSchema,
  artifactId: UuidSchema.optional(),
  activityNodeId: UuidSchema.optional(),
  cohortId: UuidSchema,

  /** Quality score (0.0000 - 1.0000) */
  qualityScore: z.number().min(0).max(1),

  /** Behavioural signals observed during this activity */
  observedSignals: z.array(
    z.object({
      signal: BehaviouralSignalSchema,
      /** Intensity: 1 = slight, 2 = moderate, 3 = strong, 4 = exceptional */
      intensity: z.number().int().min(1).max(4),
      /** Optional mentor note (max 280 chars — mobile-friendly) */
      note: z.string().max(280).optional(),
    }),
  ).min(1).max(7),

  /** Overall mentor comment (max 500 chars — 3-minute constraint) */
  overallComment: z.string().max(500).optional(),

  /** When rubric was completed offline */
  capturedOfflineAt: TimestampSchema,
});
export type MentorMicroRubric = z.infer<typeof MentorMicroRubricSchema>;

/** Ledger entry response after sealing */
export const LedgerEntryResponseSchema = z.object({
  alreadySynced: z.boolean(),
  artifactId: UuidSchema.nullable(),
  ledgerSeq: z.number().int().optional(),
  rowSignatureHash: z.string().optional(),
});
export type LedgerEntryResponse = z.infer<typeof LedgerEntryResponseSchema>;
