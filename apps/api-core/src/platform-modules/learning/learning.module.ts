import { Body, Controller, ForbiddenException, Get, Inject, Module, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { institutionQueries, learningQueries, ledgerQueries, telemetryQueries, type SparkTrackDatabase } from '@sparktrack/db';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { CurrentUser, LearnerAccessService, Public, Roles, type AuthUser } from '../../common/auth/auth.guard';
import { UpstashRedisService } from '../../common/cache/upstash-redis.service';
import { KYSELY } from '../../common/database/database.module';
import { CloudflareR2Service } from './cloudflare-r2.service';

const CreateOrganisationSchema = z.object({
  name: z.string().min(2).max(160),
  orgType: z.enum(['SCHOOL', 'NGO', 'TRAINING_PROVIDER', 'EMPLOYER', 'GOVERNMENT']),
  countryCode: z.string().length(2).default('NG'),
  subscriptionTier: z.enum(['FREE_PILOT', 'SCHOOL_STANDARD', 'ENTERPRISE_SPONSOR']).default('FREE_PILOT'),
});

const PresignUploadSchema = z.object({
  learnerId: z.string().uuid(),
  fileName: z.string().min(1).max(180),
  contentType: z.string().min(3).max(120),
});

const RecordTelemetrySchema = z.object({
  learnerId: z.string().uuid(),
  eventType: z.string().min(2).max(80),
  durationSeconds: z.number().int().nonnegative().max(86_400).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

@ApiTags('learning')
@Controller('v1/learning')
class LearningController {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>,
    private readonly access: LearnerAccessService,
    private readonly r2: CloudflareR2Service,
    private readonly cache: UpstashRedisService,
  ) {}

  @Public()
  @Get('skills')
  @ApiOperation({ summary: 'List all skill nodes in the capability graph (cached via Upstash Redis)' })
  async skills() {
    const cacheKey = 'sparktrack:catalogue:skills:v1';
    const cached = await this.cache.getJson<Awaited<ReturnType<typeof learningQueries.skillCatalogue>>>(cacheKey);
    if (cached) return cached;
    const rows = await learningQueries.skillCatalogue(this.db);
    await this.cache.setJson(cacheKey, rows, 300);
    return rows;
  }

  @Public()
  @Get('portfolio/:learnerId')
  @ApiOperation({ summary: 'NDPA-gated public verifiable portfolio and SHA-256 ledger receipts' })
  async publicPortfolio(@Param('learnerId', ParseUUIDPipe) learnerId: string) {
    const res = await learningQueries.publicPortfolio(this.db, learnerId);
    if (res.status === 'not_found') throw new NotFoundException('Learner portfolio not found');
    if (res.status === 'private') {
      throw new ForbiddenException(
        'This learner portfolio is private. Guardian verified consent and explicit public portfolio opt-in are required.',
      );
    }
    return res;
  }

  @ApiBearerAuth()
  @Get('learners/:learnerId/summary')
  @ApiOperation({ summary: 'Get learner profile summary, consent status, and artifact counts' })
  async learnerSummary(@CurrentUser() user: AuthUser, @Param('learnerId', ParseUUIDPipe) learnerId: string) {
    await this.access.assertCanAccess(user, learnerId);
    const summary = await learningQueries.learnerSummary(this.db, learnerId);
    if (!summary) throw new NotFoundException('Learner profile not found');
    return summary;
  }

  @ApiBearerAuth()
  @Get('learners/:learnerId/artifacts')
  @ApiOperation({ summary: 'List sealed evidence artifacts and cryptographic ledger hashes for a learner' })
  async learnerArtifacts(@CurrentUser() user: AuthUser, @Param('learnerId', ParseUUIDPipe) learnerId: string) {
    await this.access.assertCanAccess(user, learnerId);
    return learningQueries.learnerArtifacts(this.db, learnerId);
  }

  @Public()
  @Get('institutions/analytics')
  @ApiOperation({ summary: 'Aggregate cohort capability progression and ledger audit status (cached via Upstash Redis)' })
  async institutionAnalytics() {
    const cacheKey = 'sparktrack:institutions:analytics:v1';
    const cached = await this.cache.getJson<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const [summary, chain] = await Promise.all([
      institutionQueries.analyticsSummary(this.db),
      ledgerQueries.verifyChain(this.db),
    ]);
    const payload = {
      ...summary,
      ledgerAudit: {
        totalEntries: chain.length,
        allValid: chain.every((entry) => entry.isValid),
        latestLedgerSeq: chain.length > 0 ? chain[chain.length - 1]!.ledgerSeq : null,
      },
    };
    await this.cache.setJson(cacheKey, payload, 30);
    return payload;
  }

  @ApiBearerAuth()
  @Get('institutions/talent-pool')
  @Roles('SCHOOL_ADMIN', 'ORG_PARTNER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List pseudonymized, guardian-consented learners opted into partner talent discovery' })
  partnerTalentPool() {
    return institutionQueries.partnerTalentPool(this.db);
  }

  @ApiBearerAuth()
  @Post('institutions/organisations')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Register a partner school, NGO, training provider, or sponsor organisation' })
  createOrganisation(@Body() body: unknown) {
    const parsed = CreateOrganisationSchema.parse(body);
    return institutionQueries.createOrganisation(this.db, parsed);
  }

  @ApiBearerAuth()
  @Post('institutions/refresh-summary')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Refresh analytics.mv_learner_development_summary materialized view' })
  refreshMaterializedSummary() {
    return institutionQueries.refreshMaterializedSummary(this.db);
  }

  @ApiBearerAuth()
  @Post('telemetry')
  @ApiOperation({ summary: 'Record a learning telemetry event into range-partitioned analytics.learning_telemetry' })
  async recordTelemetry(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = RecordTelemetrySchema.parse(body);
    await this.access.assertCanAccess(user, parsed.learnerId);
    return telemetryQueries.recordEvent(this.db, parsed);
  }

  @ApiBearerAuth()
  @Post('storage/presign')
  @ApiOperation({ summary: 'Issue a Cloudflare R2 S3-V4 presigned PUT/GET ticket for evidence attachments' })
  async presignUpload(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = PresignUploadSchema.parse(body);
    await this.access.assertCanAccess(user, parsed.learnerId);
    return this.r2.presignUpload(parsed);
  }
}

@Module({ controllers: [LearningController], providers: [CloudflareR2Service], exports: [CloudflareR2Service] })
export class LearningModule {}
