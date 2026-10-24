import { z } from 'zod';
import { UuidSchema } from '../common/schemas.js';

export const SkillCategorySchema = z.enum([
  'TECHNICAL', 'DIGITAL', 'CREATIVE', 'BUSINESS', 'PROFESSIONAL', 'BEHAVIOURAL_SIGNAL',
]);
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const ProgressionLevelSchema = z.enum([
  'BEGINNER', 'DEVELOPING', 'COMPETENT', 'ADVANCED',
]);
export type ProgressionLevel = z.infer<typeof ProgressionLevelSchema>;

export const GraphNodeTypeSchema = z.enum([
  'ACTIVITY', 'SKILL', 'CAPABILITY', 'CAREER_PATHWAY', 'ENTREPRENEURSHIP_PATHWAY', 'OPPORTUNITY',
]);
export type GraphNodeType = z.infer<typeof GraphNodeTypeSchema>;

/** A single computed skill score for a learner */
export const SkillScoreSchema = z.object({
  nodeId: UuidSchema,
  nodeCode: z.string(),
  nodeName: z.string(),
  category: SkillCategorySchema,
  /** Computed score: 0.0000 - 1.0000 */
  score: z.number().min(0).max(1),
  progression: ProgressionLevelSchema,
  evidenceCount: z.number().int().min(0),
  mentorAgreementRatio: z.number().min(0).max(1).nullable(),
});
export type SkillScore = z.infer<typeof SkillScoreSchema>;

/** Full capability profile snapshot for a learner at a point in time */
export const CapabilityProfileSchema = z.object({
  learnerId: UuidSchema,
  asOfTimestamp: z.string().datetime({ offset: true }),
  skills: z.array(SkillScoreSchema),
  /** Top observed behavioural signals */
  behaviouralSignals: z.array(
    z.object({
      signal: z.string(),
      averageIntensity: z.number(),
      observationCount: z.number().int(),
    }),
  ),
});
export type CapabilityProfile = z.infer<typeof CapabilityProfileSchema>;

/** Pathway affinity calculation result */
export const PathwayAffinitySchema = z.object({
  pathwayNodeId: UuidSchema,
  pathwayCode: z.string(),
  pathwayName: z.string(),
  pathwayType: z.enum(['CAREER_PATHWAY', 'ENTREPRENEURSHIP_PATHWAY']),
  /** Affinity score: 0.0 - 1.0 */
  affinityScore: z.number().min(0).max(1),
  /** Skills the learner has that contribute to this pathway */
  contributingSkills: z.array(
    z.object({
      nodeCode: z.string(),
      nodeName: z.string(),
      score: z.number(),
      contributionWeight: z.number(),
    }),
  ),
  /** Skills the learner is missing for this pathway */
  missingSkills: z.array(
    z.object({
      nodeCode: z.string(),
      nodeName: z.string(),
      isRequired: z.boolean(),
    }),
  ),
  /**
   * Divergence flag: true when this pathway's affinity is HIGH
   * but the learner did NOT declare interest in related areas.
   */
  isDivergentFromDeclared: z.boolean(),
});
export type PathwayAffinity = z.infer<typeof PathwayAffinitySchema>;

/**
 * Time-decay configuration for the SkillEngine formula:
 * S(u,k,t) = Σ ( Q_i · W_type(i) · M_verifier(i) · C_complexity(i) · e^(-λ(t - t_i)) )
 */
export const TimeDecayConfigSchema = z.object({
  /** Lambda decay rate (higher = faster decay, older evidence matters less) */
  lambda: z.number().positive().default(0.01),
  /** Weight multipliers by artifact type */
  typeWeights: z.record(z.string(), z.number().positive()).default({
    PROJECT_SUBMISSION: 1.0,
    GIT_REPOSITORY: 1.2,
    DESIGN_PORTFOLIO: 1.0,
    ASSESSMENT_RESULT: 0.8,
    MENTOR_OBSERVATION: 1.1,
    COMPETITION_RESULT: 1.3,
    LEARNER_REFLECTION: 0.6,
    BUSINESS_PROTOTYPE: 1.1,
  }),
  /** Mentor verification multiplier (verified evidence weighs more) */
  mentorVerifiedMultiplier: z.number().positive().default(1.5),
  /** Unverified evidence multiplier */
  unverifiedMultiplier: z.number().positive().default(1.0),
});
export type TimeDecayConfig = z.infer<typeof TimeDecayConfigSchema>;
