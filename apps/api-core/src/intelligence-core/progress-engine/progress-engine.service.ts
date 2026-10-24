import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { bitemporalQueries, evidenceReadQueries } from '@sparktrack/db';
import type { SparkTrackDatabase } from '@sparktrack/db';
import { KYSELY } from '../../common/database/database.module';
import { mapToProgression } from '../skill-engine/skill-math';
import type { ComputedSkill } from '../skill-engine/skill-engine.service';

/** Progress Engine — bitemporal state transitions (tstzrange) and time-travel reads. */
@Injectable()
export class ProgressEngineService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>) {}

  profileAsOf(learnerId: string, asOf: Date = new Date()) {
    return bitemporalQueries.profileAsOf(this.db, learnerId, asOf);
  }

  /** Persist computed skills as new bitemporal states. Returns how many actually changed. */
  async applySkills(learnerId: string, skills: ComputedSkill[]): Promise<number> {
    const ids = await evidenceReadQueries.skillNodeIdsByCode(this.db, skills.map((s) => s.code));
    let changed = 0;
    for (const s of skills) {
      const nodeId = ids.get(s.code);
      if (!nodeId) continue;
      const r = await bitemporalQueries.transition(this.db, {
        learnerId, nodeId, score: s.score, progression: mapToProgression(s.score), evidenceCount: s.evidenceCount,
        mentorAgreementRatio: s.mentorAgreementRatio, artifactIds: s.artifactIds,
      });
      if (r.changed) changed++;
    }
    return changed;
  }
}

