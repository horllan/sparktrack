import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { SPARKTRACK_EVENTS, SPARKTRACK_QUEUES, type EvidenceSealedEvent } from '../../common/events/event-names';
import { SkillEngineService } from '../skill-engine/skill-engine.service';
import { ProgressEngineService } from '../progress-engine/progress-engine.service';

/** Consumes evidence events: recompute skills, then persist bitemporal state changes. */
@Injectable()
@Processor(SPARKTRACK_QUEUES.INTELLIGENCE_PIPELINE)
export class IntelligencePipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(IntelligencePipelineProcessor.name);
  constructor(private readonly skills: SkillEngineService, private readonly progress: ProgressEngineService) { super(); }

  async process(job: Job<EvidenceSealedEvent>): Promise<void> {
    if (job.name !== SPARKTRACK_EVENTS.EVIDENCE_SEALED) return;
    const { learnerId } = job.data;
    const computed = await this.skills.computeAll(learnerId);
    const changed = await this.progress.applySkills(learnerId, computed);
    this.logger.log(`learner=${learnerId} skills=${computed.length} changed=${changed}`);
  }
}

