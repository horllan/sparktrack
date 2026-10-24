import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { evidenceReadQueries } from '@sparktrack/db';
import type { SparkTrackDatabase } from '@sparktrack/db';
import { KYSELY } from '../../common/database/database.module';
import { CapabilityGraphService } from '../capability-graph/capability-graph.service';
import { SkillEngineService } from '../skill-engine/skill-engine.service';
import { computeAffinities } from './pathway-math';

/** Pathway Engine — affinity per pathway + Observed-vs-Declared divergence detection. */
@Injectable()
export class PathwayEngineService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>,
    private readonly graph: CapabilityGraphService,
    private readonly skills: SkillEngineService,
  ) {}

  async affinities(learnerId: string) {
    const [skills, edges, ctx] = await Promise.all([
      this.skills.computeAll(learnerId), this.graph.edges(), evidenceReadQueries.learnerContext(this.db, learnerId),
    ]);
    return computeAffinities({
      edges, skillScores: new Map(skills.map((s) => [s.code, s.score])), declaredInterests: ctx?.declared_interests ?? [],
    });
  }
}

