import { Module } from '@nestjs/common';
import { CapabilityGraphService } from './capability-graph.service';
import { CapabilityGraphController } from './capability-graph.controller';

@Module({ controllers: [CapabilityGraphController], providers: [CapabilityGraphService], exports: [CapabilityGraphService] })
export class CapabilityGraphModule {}

