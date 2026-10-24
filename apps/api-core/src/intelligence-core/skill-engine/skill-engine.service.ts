import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { evidenceReadQueries } from '@sparktrack/db';
import type { SparkTrackDatabase } from '@sparktrack/db';
import { KYSELY } from '../../common/database/database.module';
import {
  DEFAULT_SKILL_CONFIG, SIGNAL_NODE_CODES, mapToProgression, normaliseScore, rawSkillScore, signalScore,
  type EvidenceItem, type SkillMathConfig,
} from './skill-math';

export interface ComputedSkill {
  code: string;
  score: number;
  progression: ReturnType<typeof mapToProgression>;
  evidenceCount: number;
  mentorAgreementRatio: number | null;
  artifactIds: string[];
}

/**
 * Skill Engine — S(u,k,t) = Σ Q·W·M·C·e^(-λ(t-t_i)), saturated to [0,1) and banded to a progression level.
 * Evidence is tied to skills via artifact.payload.skill_codes; behavioural signals come from mentor rubrics.
 */
@Injectable()
export class SkillEngineService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>) {}

  async computeAll(learnerId: string, now = new Date(), cfg: SkillMathConfig = DEFAULT_SKILL_CONFIG): Promise<ComputedSkill[]> {
    const [rows, signals] = await Promise.all([
      evidenceReadQueries.forLearner(this.db, learnerId),
      evidenceReadQueries.signalsForLearner(this.db, learnerId),
    ]);
    const bySkill = new Map<string, EvidenceItem[]>();
    for (const r of rows) {
      for (const code of r.skill_codes) {
        const list = bySkill.get(code) ?? [];
        list.push({ id: r.id, artifactType: r.artifact_type, quality: r.quality_score, complexity: r.complexity_weight,
          mentorVerified: r.mentor_verified, capturedAt: new Date(r.captured_offline_at) });
        bySkill.set(code, list);
      }
    }
    const out: ComputedSkill[] = [];
    for (const [code, items] of bySkill) {
      const score = normaliseScore(rawSkillScore(items, now, cfg), cfg);
      out.push({
        code, score, progression: mapToProgression(score), evidenceCount: items.length,
        mentorAgreementRatio: items.filter((i) => i.mentorVerified).length / items.length,
        artifactIds: items.map((i) => i.id),
      });
    }
    for (const s of signals) {
      const code = SIGNAL_NODE_CODES[s.signal];
      if (!code) continue;
      const score = signalScore(s.averageIntensity, s.observationCount, cfg);
      out.push({ code, score, progression: mapToProgression(score), evidenceCount: s.observationCount, mentorAgreementRatio: 1, artifactIds: [] });
    }
    return out.sort((a, b) => b.score - a.score);
  }
}

