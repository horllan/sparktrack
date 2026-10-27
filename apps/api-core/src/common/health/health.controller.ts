import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { KYSELY } from '../database/database.module';
import type { Db } from '@sparktrack/db';
import { ledgerQueries } from '@sparktrack/db';
import { UpstashRedisService } from '../cache/upstash-redis.service';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  stage: string;
  timestamp: string;
  uptimeSeconds: number;
  database: 'connected' | 'unreachable';
  redis: 'connected' | 'unconfigured' | 'unreachable';
  ledgerIntegrityValid: boolean;
  ledgerBlockCount: number;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startTime = Date.now();

  constructor(
    @Inject(KYSELY) private readonly db: Db,
    @Inject(UpstashRedisService) private readonly redisService: UpstashRedisService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Staging and Production mirror health check with cryptographic ledger audit' })
  @ApiResponse({ status: 200, description: 'Health and ledger integrity status' })
  async checkHealth(): Promise<HealthResponse> {
    const stage =
      this.config.get<string>('SPARKTRACK_STAGE') ||
      this.config.get<string>('NODE_ENV') ||
      'development';

    let dbStatus: 'connected' | 'unreachable' = 'unreachable';
    let ledgerIntegrityValid = false;
    let ledgerBlockCount = 0;

    try {
      // Recompute whole cryptographic ledger chain and report broken links
      const chain = await ledgerQueries.verifyChain(this.db);
      dbStatus = 'connected';
      ledgerBlockCount = chain.length;
      ledgerIntegrityValid = chain.length === 0 || chain.every((c) => c.isValid);
    } catch (err) {
      this.logger.warn(`Health check DB/Ledger verification failed: ${err instanceof Error ? err.message : 'unknown'}`);
      dbStatus = 'unreachable';
      ledgerIntegrityValid = false;
    }

    // Verify Redis / Cache connectivity
    const redisCheck = await this.redisService.ping();

    const isHealthy = dbStatus === 'connected' && ledgerIntegrityValid;

    return {
      status: isHealthy ? 'ok' : 'degraded',
      stage,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      database: dbStatus,
      redis: redisCheck.status,
      ledgerIntegrityValid,
      ledgerBlockCount,
    };
  }

  @Get('ledger')
  @ApiOperation({ summary: 'Detailed SHA-256 cryptographic audit chain status' })
  async auditLedger() {
    const stage =
      this.config.get<string>('SPARKTRACK_STAGE') ||
      this.config.get<string>('NODE_ENV') ||
      'development';

    try {
      const chain = await ledgerQueries.verifyChain(this.db);
      return {
        stage,
        timestamp: new Date().toISOString(),
        totalBlocks: chain.length,
        ledgerIntegrityValid: chain.length === 0 || chain.every((c) => c.isValid),
        blocks: chain,
      };
    } catch (err) {
      return {
        stage,
        timestamp: new Date().toISOString(),
        ledgerIntegrityValid: false,
        error: err instanceof Error ? err.message : 'Database unreachable',
      };
    }
  }
}

