import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EvidenceEngineService } from './evidence-engine.service';
import { EvidenceEngineController } from './evidence-engine.controller';
import { SPARKTRACK_QUEUES } from '../../common/events/event-names';

@Module({
  imports: [BullModule.registerQueue({ name: SPARKTRACK_QUEUES.INTELLIGENCE_PIPELINE })],
  controllers: [EvidenceEngineController],
  providers: [EvidenceEngineService],
  exports: [EvidenceEngineService],
})
export class EvidenceEngineModule {}

