import { Module } from '@nestjs/common';
import { RecommendationEngineService } from './recommendation-engine.service';
import { RecommendationEngineController } from './recommendation-engine.controller';
import { SkillEngineModule } from '../skill-engine/skill-engine.module';
import { PathwayEngineModule } from '../pathway-engine/pathway-engine.module';

@Module({
  imports: [SkillEngineModule, PathwayEngineModule],
  controllers: [RecommendationEngineController],
  providers: [RecommendationEngineService],
  exports: [RecommendationEngineService],
})
export class RecommendationEngineModule {}

