import { createHmac, randomUUID } from 'node:crypto';
import { Body, Controller, ForbiddenException, Get, Inject, Module, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { institutionQueries, learningQueries, ledgerQueries, type SparkTrackDatabase } from '@sparktrack/db';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { CurrentUser, LearnerAccessService, Public, type AuthUser } from '../../common/auth/auth.guard';
import { KYSELY } from '../../common/database/database.module';

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

@ApiTags('learning')
@Controller('v1/learning')
class LearningController {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>,
    private readonly access: LearnerAccessService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('skills')
  @ApiOperation({ summary: 'List all skill nodes in the capability graph' })
  skills() {
    return learningQueries.skillCatalogue(this.db);
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
  @ApiOperation({ summary: 'Aggregate cohort capability progression, NDPA-gated talent pool, and ledger audit status' })
  async institutionAnalytics() {
    const [summary, chain] = await Promise.all([
      institutionQueries.analyticsSummary(this.db),
      ledgerQueries.verifyChain(this.db),
    ]);
    return {
      ...summary,
      ledgerAudit: {
        totalEntries: chain.length,
        allValid: chain.every((entry) => entry.isValid),
        latestLedgerSeq: chain.length > 0 ? chain[chain.length - 1]!.ledgerSeq : null,
      },
    };
  }

  @ApiBearerAuth()
  @Post('institutions/organisations')
  @ApiOperation({ summary: 'Register a partner school, NGO, training provider, or sponsor organisation' })
  createOrganisation(@Body() body: unknown) {
    const parsed = CreateOrganisationSchema.parse(body);
    return institutionQueries.createOrganisation(this.db, parsed);
  }

  @ApiBearerAuth()
  @Post('storage/presign')
  @ApiOperation({ summary: 'Issue a Cloudflare R2 object key and signed upload ticket for evidence attachments' })
  async presignUpload(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = PresignUploadSchema.parse(body);
    await this.access.assertCanAccess(user, parsed.learnerId);

    const safeFile = parsed.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const r2Key = `learners/${parsed.learnerId}/artifacts/${randomUUID()}-${safeFile}`;
    const endpoint = this.config.get<string>('R2_PUBLIC_ENDPOINT') ?? 'https://r2.sparktrack.africa';
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    const signingSecret = this.config.get<string>('R2_SECRET_ACCESS_KEY') ?? 'dev-r2-signing-key';
    const signature = createHmac('sha256', signingSecret)
      .update(`${r2Key}:${parsed.contentType}:${expiresAt}`)
      .digest('hex');

    return {
      r2Key,
      uploadUrl: `${endpoint.replace(/\/$/, '')}/${r2Key}?expires=${encodeURIComponent(expiresAt)}&sig=${signature}`,
      expiresAt,
      contentType: parsed.contentType,
    };
  }
}

@Module({ controllers: [LearningController] })
export class LearningModule {}
