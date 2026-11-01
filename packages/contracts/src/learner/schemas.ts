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

export const LearnerStageSchema = z.enum([
  'SECONDARY_SCHOOL', 'UNIVERSITY', 'NYSC', 'EMPLOYED', 'CAREER_TRANSITION',
  'CAREER_GROWTH', 'SELF_TAUGHT', 'NO_FORMAL_EDUCATION', 'OTHER',
]);
export type LearnerStage = z.infer<typeof LearnerStageSchema>;

export const LearningGoalSchema = z.enum([
  'EXPLORE_INTERESTS', 'BUILD_PRACTICAL_SKILLS', 'GET_FIRST_JOB', 'CHANGE_CAREER',
  'GROW_IN_CAREER', 'START_BUSINESS', 'RETURN_TO_EDUCATION', 'PERSONAL_GROWTH', 'OTHER',
]);
export type LearningGoal = z.infer<typeof LearningGoalSchema>;

export const LearnerAgeGroupSchema = z.enum(['UNDER_18', 'ADULT']);
export type LearnerAgeGroup = z.infer<typeof LearnerAgeGroupSchema>;

function hasReachedAdultAge(dateOfBirth: string): boolean {
  const birthDate = new Date(`${dateOfBirth}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < birthDate.getUTCMonth()
    || (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 18;
}

/** Lifelong learner onboarding. Education and school are optional context, not eligibility requirements. */
export const LearnerOnboardingSchema = z.object({
  fullName: z.string().min(2).max(200),
  ageGroup: LearnerAgeGroupSchema,
  dateOfBirth: z.string().date().optional(),
  learnerStage: LearnerStageSchema,
  educationLevel: z.string().max(80).optional(),
  learningGoal: LearningGoalSchema,
  currentRole: z.string().max(120).optional(),
  targetRole: z.string().max(120).optional(),
  schoolName: z.string().max(200).optional(),
  /** Learner's self-declared interests for exploration */
  declaredInterests: z.array(z.string().min(1).max(100)).max(10).default([]),
  /** Required only for learners under 18; adult learners control their own profile. */
  guardian: z.object({
    fullName: z.string().min(2).max(200),
    email: z.string().email().optional(),
    phoneNumber: z.string().regex(/^\+?[1-9]\d{7,14}$/), // E.164-compatible phone number
    relationship: z.enum(['PARENT', 'GUARDIAN', 'SCHOOL_REPRESENTATIVE']).default('PARENT'),
  }).optional(),
  /** Explicit opt-in for future WhatsApp continuity messages. */
  whatsappOptIn: z.boolean().default(false),
  whatsappPhoneNumber: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
}).superRefine((learner, ctx) => {
  if (learner.learnerStage === 'SECONDARY_SCHOOL' && !learner.educationLevel?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['educationLevel'], message: 'Choose your current secondary class, starting from JSS1.' });
  }
  if (learner.ageGroup === 'UNDER_18') {
    if (!learner.dateOfBirth) ctx.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'Date of birth is required for learners under 18.' });
    if (!learner.guardian) ctx.addIssue({ code: 'custom', path: ['guardian'], message: 'A parent or guardian is required for learners under 18.' });
    if (learner.dateOfBirth && hasReachedAdultAge(learner.dateOfBirth)) {
      ctx.addIssue({ code: 'custom', path: ['ageGroup'], message: 'Choose the adult option for learners who are 18 or older.' });
    }
  }
  if (learner.ageGroup === 'ADULT' && learner.dateOfBirth && !hasReachedAdultAge(learner.dateOfBirth)) {
    ctx.addIssue({ code: 'custom', path: ['ageGroup'], message: 'Learners under 18 need a parent or guardian.' });
  }
  if (learner.whatsappOptIn && !learner.whatsappPhoneNumber) {
    ctx.addIssue({ code: 'custom', path: ['whatsappPhoneNumber'], message: 'Enter the WhatsApp number for the person who opted in.' });
  }
  if (!learner.whatsappOptIn && learner.whatsappPhoneNumber) {
    ctx.addIssue({ code: 'custom', path: ['whatsappOptIn'], message: 'Opt in before adding a WhatsApp number.' });
  }
});
export type LearnerOnboarding = z.infer<typeof LearnerOnboardingSchema>;

/** Full learner profile response (for portals) */
export const LearnerProfileResponseSchema = z.object({
  learnerId: UuidSchema,
  fullName: z.string(),
  dateOfBirth: z.string().date().nullable(),
  educationStage: z.string(),
  learnerStage: LearnerStageSchema,
  educationLevel: z.string().nullable(),
  learningGoal: LearningGoalSchema,
  currentRole: z.string().nullable(),
  targetRole: z.string().nullable(),
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
