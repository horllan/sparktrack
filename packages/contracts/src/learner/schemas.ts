import { z } from 'zod';
import { UuidSchema, TimestampSchema } from '../common/schemas.js';
import { CapabilityProfileSchema, PathwayAffinitySchema } from '../intelligence/schemas.js';

export const UserRoleSchema = z.enum([
  'LEARNER', 'PARENT', 'MENTOR', 'SCHOOL_ADMIN', 'ORG_PARTNER', 'SUPER_ADMIN',
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const ConsentStatusSchema = z.enum([
  'PENDING_PARENTAL_CONSENT', 'VERIFIED_ACTIVE', 'RESTRICTED_INTERNAL_ONLY', 'REVOKED',
]);
export type ConsentStatus = z.infer<typeof ConsentStatusSchema>;

/** Student onboarding form (first-time signup) */
export const LearnerOnboardingSchema = z.object({
  fullName: z.string().min(2).max(200),
  dateOfBirth: z.string().date(), // ISO date string
  educationStage: z.string().min(1).max(50), // e.g., 'JSS3', 'SS1', 'Year 9'
  schoolName: z.string().max(200).optional(),
  /** Learner's self-declared interests for exploration */
  declaredInterests: z.array(z.string().min(1).max(100)).min(1).max(10),
  /** Parent/Guardian information for consent */
  guardian: z.object({
    fullName: z.string().min(2).max(200),
    email: z.string().email().optional(),
    phoneNumber: z.string().regex(/^\+?[1-9]\d{7,14}$/), // E.164-compatible phone number
    relationship: z.enum(['PARENT', 'GUARDIAN', 'SCHOOL_REPRESENTATIVE']).default('PARENT'),
  }),
});
export type LearnerOnboarding = z.infer<typeof LearnerOnboardingSchema>;

/** Full learner profile response (for portals) */
export const LearnerProfileResponseSchema = z.object({
  learnerId: UuidSchema,
  fullName: z.string(),
  dateOfBirth: z.string().date(),
  educationStage: z.string(),
  schoolName: z.string().nullable(),
  consentStatus: ConsentStatusSchema,
  declaredInterests: z.array(z.string()),
  allowPublicPortfolio: z.boolean(),
  /** Current capability snapshot (if consent is verified) */
  capabilities: CapabilityProfileSchema.optional(),
  /** Pathway affinities (if enough evidence exists) */
  pathwayAffinities: z.array(PathwayAffinitySchema).optional(),
  /** Artifact count */
  totalArtifacts: z.number().int().min(0),
  lastEvidenceDate: TimestampSchema.nullable(),
});
export type LearnerProfileResponse = z.infer<typeof LearnerProfileResponseSchema>;

/** Parental consent verification request */
export const ParentalConsentRequestSchema = z.object({
  learnerId: UuidSchema,
  guardianId: UuidSchema,
  /** Verification method: SMS OTP or in-person ID check */
  method: z.enum(['SMS_OTP', 'IN_PERSON_ID', 'EMAIL_LINK']),
  /** OTP code (for SMS_OTP method) */
  otpCode: z.string().length(6).optional(),
  /** Consent grants */
  grants: z.object({
    allowPublicPortfolio: z.boolean().default(false),
    allowPartnerTalentDiscovery: z.boolean().default(false),
  }),
});
export type ParentalConsentRequest = z.infer<typeof ParentalConsentRequestSchema>;

export const ConsentVerificationSchema = z.object({
  challengeId: UuidSchema,
  otpCode: z.string().regex(/^\d{6}$/),
  consentGiven: z.boolean(),
  grants: z.object({
    allowPublicPortfolio: z.boolean(),
    allowPartnerTalentDiscovery: z.boolean(),
  }),
});
export type ConsentVerification = z.infer<typeof ConsentVerificationSchema>;
