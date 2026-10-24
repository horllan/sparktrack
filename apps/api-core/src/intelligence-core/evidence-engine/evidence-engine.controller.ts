import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EvidenceSyncPayloadSchema, MentorMicroRubricSchema } from '@sparktrack/contracts';
import { ledgerQueries } from '@sparktrack/db';
import type { Kysely } from 'kysely';
import type { SparkTrackDatabase } from '@sparktrack/db';
import { Inject } from '@nestjs/common';
import { EvidenceEngineService } from './evidence-engine.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth/auth.guard';
import { KYSELY } from '../../common/database/database.module';

@ApiTags('evidence')
@ApiBearerAuth()
@Controller('v1/evidence')
export class EvidenceEngineController {
  constructor(
    private readonly engine: EvidenceEngineService,
    @Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>,
  ) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Idempotent offline evidence sync + ledger sealing (dedupes on clientSyncId)' })
  @ApiResponse({ status: 200, description: 'Sealed, or alreadySynced=true' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 403, description: 'No access, or parental consent not verified' })
  sync(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.engine.syncEvidence(user, EvidenceSyncPayloadSchema.parse(body));
  }

  @Post('mentor-rubric')
  @Roles('MENTOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mentor 3-minute micro-rubric (offline-sync compatible, idempotent)' })
  rubric(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.engine.syncRubric(user, MentorMicroRubricSchema.parse(body));
  }

  @Get('ledger/verify')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Recompute the hash chain and list invalid links' })
  async verify() {
    const rows = await ledgerQueries.verifyChain(this.db);
    return { total: rows.length, invalid: rows.filter((r) => !r.isValid) };
  }
}

