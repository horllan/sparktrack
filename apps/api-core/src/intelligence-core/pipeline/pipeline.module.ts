import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IntelligencePipelineProcessor } from './pipeline.processor';
import { SkillEngineModule } from '../skill-engine/skill-engine.module';
import { ProgressEngineModule } from '../progress-engine/progress-engine.module';
import { SPARKTRACK_QUEUES } from '../../common/events/event-names';

@Module({
  imports: [BullModule.registerQueue({ name: SPARKTRACK_QUEUES.INTELLIGENCE_PIPELINE }), SkillEngineModule, ProgressEngineModule],
  providers: [IntelligencePipelineProcessor],
})
export class PipelineModule {}

