import type { ProgressionLevel } from '@sparktrack/contracts';

export interface EvidenceItem {
  id: string;
  artifactType: string;
  quality: number;          // Q_i in [0,1]
  complexity: number;       // C_i in [0.5,3]
  mentorVerified: boolean;  // M_verifier
  capturedAt: Date;         // t_i
}

export interface SkillMathConfig {
  /** λ per day. 0.004 ≈ 173-day half-life: holiday-to-holiday evidence still counts. */
  lambda: number;
  typeWeights: Record<string, number>;
  mentorVerifiedMultiplier: number;
  unverifiedMultiplier: number;
  /** Saturation constant: score = 1 - exp(-S / k). Keeps scores in [0,1) and rewards breadth of evidence. */
  saturationK: number;
}

export const DEFAULT_SKILL_CONFIG: SkillMathConfig = {
  lambda: 0.004,
  typeWeights: {
    PROJECT_SUBMISSION: 1.0, GIT_REPOSITORY: 1.2, DESIGN_PORTFOLIO: 1.0, ASSESSMENT_RESULT: 0.8,
    MENTOR_OBSERVATION: 1.1, COMPETITION_RESULT: 1.3, LEARNER_REFLECTION: 0.6, BUSINESS_PROTOTYPE: 1.1,
  },
  mentorVerifiedMultiplier: 1.5,
  unverifiedMultiplier: 1.0,
  saturationK: 2,
};

const DAY_MS = 86_400_000;

/** Raw S(u,k,t) = Σ Q·W·M·C·e^(-λ(t-t_i)), t-t_i in days (never negative). */
export function rawSkillScore(items: EvidenceItem[], now: Date, cfg: SkillMathConfig = DEFAULT_SKILL_CONFIG): number {
  return items.reduce((sum, e) => {
    const days = Math.max(0, (now.getTime() - e.capturedAt.getTime()) / DAY_MS);
    const w = cfg.typeWeights[e.artifactType] ?? 1;
    const m = e.mentorVerified ? cfg.mentorVerifiedMultiplier : cfg.unverifiedMultiplier;
    return sum + e.quality * w * m * e.complexity * Math.exp(-cfg.lambda * days);
  }, 0);
}

/** Normalise raw sum to [0,1). */
export function normaliseScore(raw: number, cfg: SkillMathConfig = DEFAULT_SKILL_CONFIG): number {
  return 1 - Math.exp(-Math.max(0, raw) / cfg.saturationK);
}

export function mapToProgression(score: number): ProgressionLevel {
  if (score >= 0.8) return 'ADVANCED';
  if (score >= 0.55) return 'COMPETENT';
  if (score >= 0.3) return 'DEVELOPING';
  return 'BEGINNER';
}

/** Behavioural signal -> graph node code. Signals without a node are ignored for scoring. */
export const SIGNAL_NODE_CODES: Record<string, string> = {
  persistence: 'SIG_PERSISTENCE',
  collaboration: 'SIG_COLLABORATION',
  communication: 'SIG_COMMUNICATION',
  analytical_thinking: 'SIG_ANALYTICAL_THINKING',
};

/** Signals are developmental, so repeated observation raises confidence but never a permanent label. */
export function signalScore(averageIntensity: number, observations: number, cfg: SkillMathConfig = DEFAULT_SKILL_CONFIG): number {
  return normaliseScore((averageIntensity / 4) * observations, cfg);
}

