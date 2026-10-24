import { Module } from '@nestjs/common';
import { ProgressEngineService } from './progress-engine.service';
import { ProgressEngineController } from './progress-engine.controller';

@Module({ controllers: [ProgressEngineController], providers: [ProgressEngineService], exports: [ProgressEngineService] })
export class ProgressEngineModule {}

