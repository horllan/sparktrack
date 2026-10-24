import { Module } from '@nestjs/common';
import { PathwayEngineService } from './pathway-engine.service';
import { PathwayEngineController } from './pathway-engine.controller';
import { CapabilityGraphModule } from '../capability-graph/capability-graph.module';
import { SkillEngineModule } from '../skill-engine/skill-engine.module';

@Module({
  imports: [CapabilityGraphModule, SkillEngineModule],
  controllers: [PathwayEngineController],
  providers: [PathwayEngineService],
  exports: [PathwayEngineService],
})
export class PathwayEngineModule {}

