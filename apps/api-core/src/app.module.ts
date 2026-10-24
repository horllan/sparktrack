import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { APP_FILTER } from '@nestjs/core';

import { EvidenceEngineModule } from './intelligence-core/evidence-engine/evidence-engine.module';
import { SkillEngineModule } from './intelligence-core/skill-engine/skill-engine.module';
import { CapabilityGraphModule } from './intelligence-core/capability-graph/capability-graph.module';
import { ProgressEngineModule } from './intelligence-core/progress-engine/progress-engine.module';
import { PathwayEngineModule } from './intelligence-core/pathway-engine/pathway-engine.module';
import { RecommendationEngineModule } from './intelligence-core/recommendation-engine/recommendation-engine.module';
import { PipelineModule } from './intelligence-core/pipeline/pipeline.module';

import { AuthModule } from './platform-modules/auth/auth.module';
import { LearningModule } from './platform-modules/learning/learning.module';
import { MentorshipModule } from './platform-modules/mentorship/mentorship.module';
import { BillingModule } from './platform-modules/billing/billing.module';

import { DatabaseModule } from './common/database/database.module';
import { AuthCoreModule } from './common/auth/auth-core.module';
import { ZodExceptionFilter } from './common/filters/zod-exception.filter';

function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return {
    host: url.hostname, port: Number(url.port || 6379), username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null as null,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: (times: number) => (times > 2 ? null : 500),
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    BullModule.forRoot({ connection: redisConnection() }),
    DatabaseModule,
    AuthCoreModule,
    // Intelligence Core (headless IP) — must never import platform-modules
    EvidenceEngineModule, SkillEngineModule, CapabilityGraphModule, ProgressEngineModule,
    PathwayEngineModule, RecommendationEngineModule, PipelineModule,
    // Platform modules
    AuthModule, LearningModule, MentorshipModule, BillingModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ZodExceptionFilter }],
})
export class AppModule {}
