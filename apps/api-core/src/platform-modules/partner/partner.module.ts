import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArtifactTypeSchema, BehaviouralSignalSchema } from '@sparktrack/contracts';
import { z } from 'zod';
import { CurrentUser, Roles, Scopes, type AuthUser } from '../../common/auth/auth.guard';
import { EvidenceEngineModule } from '../../intelligence-core/evidence-engine/evidence-engine.module';
import { PathwayEngineModule } from '../../intelligence-core/pathway-engine/pathway-engine.module';
import { RecommendationEngineModule } from '../../intelligence-core/recommendation-engine/recommendation-engine.module';
import { SkillEngineModule } from '../../intelligence-core/skill-engine/skill-engine.module';
import { PartnerService } from './partner.service';

const UpsertPartnerLearnerSchema = z.object({
  externalLearnerId: z.string().regex(/^[A-Za-z0-9._:@-]{1,128}$/),
  fullName: z.string().min(2).max(120),
  ageGroup: z.enum(['UNDER_18', 'ADULT']).default('UNDER_18'),
  dateOfBirth: z.string().date().optional(),
  learnerStage: z.string().min(2).max(40).default('SECONDARY_SCHOOL'),
  educationStage: z.string().min(2).max(40).optional(),
  educationLevel: z.string().max(80).optional(),
  learningGoal: z.string().min(2).max(60).optional(),
  declaredInterests: z.array(z.string().min(2).max(80)).min(1).max(10).default(['STEM']),
  consentStatus: z
    .enum(['PENDING_PARENTAL_CONSENT', 'VERIFIED_ACTIVE', 'RESTRICTED_INTERNAL_ONLY', 'REVOKED'])
    .default('VERIFIED_ACTIVE'),
  attestationMethod: z
    .enum([
      'ADULT_SELF_CONSENT',
      'GUARDIAN_WRITTEN_CONSENT',
      'GUARDIAN_DIGITAL_CONSENT',
      'INSTITUTIONAL_ENROLMENT_AGREEMENT',
      'CONSENT_WITHDRAWN',
    ])
    .default('INSTITUTIONAL_ENROLMENT_AGREEMENT'),
  guardianName: z.string().min(2).max(120).optional(),
  guardianContact: z.string().min(4).max(160).optional(),
  evidenceReference: z.string().max(200).optional(),
  allowPublicPortfolio: z.boolean().optional().default(true),
  allowPartnerTalentDiscovery: z.boolean().optional().default(false),
});

const SubmitPartnerEvidenceSchema = z.object({
  externalLearnerId: z.string().regex(/^[A-Za-z0-9._:@-]{1,128}$/),
  externalSubmissionId: z.string().min(1).max(128),
  artifactType: ArtifactTypeSchema.default('PROJECT_SUBMISSION'),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  skillCodes: z.array(z.string().min(2).max(80)).min(1).max(12),
  externalUrls: z.array(z.string().url()).default([]),
  qualityScore: z.number().min(0).max(1).optional(),
  complexityWeight: z.number().min(0.5).max(3.0).default(1.0),
  capturedAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const SubmitPartnerRubricSchema = z.object({
  externalLearnerId: z.string().regex(/^[A-Za-z0-9._:@-]{1,128}$/),
  externalEvaluationId: z.string().min(1).max(128),
  artifactId: z.string().uuid().optional(),
  qualityScore: z.number().min(0).max(1),
  overallComment: z.string().max(2000).optional(),
  observedSignals: z
    .array(
      z.object({
        signal: BehaviouralSignalSchema,
        intensity: z.number().min(0).max(1),
        note: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(8),
  capturedAt: z.string().datetime().optional(),
});

const RegisterWebhookSchema = z.object({
  url: z.string().url().max(2048),
  description: z.string().max(200).optional(),
  events: z
    .array(
      z.enum([
        '*',
        'learner.upserted',
        'evidence.sealed',
        'rubric.recorded',
        'report.generated',
      ]),
    )
    .min(1)
    .max(10)
    .default(['*']),
});

@ApiTags('partner-gateway')
@ApiBearerAuth()
@ApiHeader({ name: 'x-api-key', required: false, description: 'Enterprise API key (spk_live_...)' })
@Controller('v1/partner')
@Roles('SCHOOL_ADMIN', 'ORG_PARTNER', 'SUPER_ADMIN')
class PartnerController {
  constructor(private readonly partner: PartnerService) {}

  @Post('learners/upsert')
  @Scopes('evidence:write')
  @ApiOperation({
    summary:
      'Register or update an external training platform learner using partner ID + NDPA consent attestation',
  })
  upsertLearner(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    return this.partner.upsertLearner(user, idempotencyKey, UpsertPartnerLearnerSchema.parse(body));
  }

  @Post('evidence')
  @Scopes('evidence:write')
  @ApiOperation({
    summary:
      'Ingest a project or assessment from an external LMS/bootcamp into SparkTrack SHA-256 ledger & skill engine',
  })
  submitEvidence(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    return this.partner.submitEvidence(user, idempotencyKey, SubmitPartnerEvidenceSchema.parse(body));
  }

  @Post('rubrics')
  @Scopes('evidence:write')
  @ApiOperation({
    summary: 'Record trainer/instructor rubric scores and behavioural signals for an external learner',
  })
  submitRubric(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    return this.partner.submitRubric(user, idempotencyKey, SubmitPartnerRubricSchema.parse(body));
  }

  @Get('learners/:externalLearnerId/intelligence')
  @Scopes('intelligence:read')
  @ApiOperation({
    summary:
      'Retrieve live skill scores, career/entrepreneurship pathway affinities, and embeddable portfolio URLs',
  })
  getIntelligence(
    @CurrentUser() user: AuthUser,
    @Param('externalLearnerId') externalLearnerId: string,
  ) {
    return this.partner.getLearnerIntelligence(user, externalLearnerId);
  }

  @Post('learners/:externalLearnerId/report')
  @Scopes('intelligence:read')
  @ApiOperation({
    summary: 'Generate a 13-part developmental report for an external learner (guarded & persisted)',
  })
  generateReport(
    @CurrentUser() user: AuthUser,
    @Param('externalLearnerId') externalLearnerId: string,
  ) {
    return this.partner.generateLearnerReport(user, externalLearnerId);
  }

  @Post('webhooks')
  @Scopes('intelligence:read')
  @ApiOperation({
    summary: 'Register an outbound HMAC-SHA256 webhook endpoint for real-time partner sync',
  })
  registerWebhook(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.partner.registerWebhook(user, RegisterWebhookSchema.parse(body));
  }

  @Get('webhooks')
  @Scopes('intelligence:read')
  @ApiOperation({ summary: 'List registered outbound webhook endpoints for this organisation' })
  listWebhooks(@CurrentUser() user: AuthUser) {
    return this.partner.listWebhooks(user);
  }

  @Delete('webhooks/:endpointId')
  @Scopes('intelligence:read')
  @ApiOperation({ summary: 'Delete an outbound webhook endpoint' })
  deleteWebhook(
    @CurrentUser() user: AuthUser,
    @Param('endpointId', ParseUUIDPipe) endpointId: string,
  ) {
    return this.partner.deleteWebhook(user, endpointId);
  }
}

@Module({
  imports: [
    EvidenceEngineModule,
    SkillEngineModule,
    PathwayEngineModule,
    RecommendationEngineModule,
  ],
  controllers: [PartnerController],
  providers: [PartnerService],
  exports: [PartnerService],
})
export class PartnerModule {}

