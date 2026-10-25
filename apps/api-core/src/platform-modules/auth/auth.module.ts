import { Body, Controller, Get, Inject, Module, Param, ParseUUIDPipe, Patch, Post, ServiceUnavailableException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LearnerOnboardingSchema, ConsentVerificationSchema } from '@sparktrack/contracts';
import { ledgerQueries, type SparkTrackDatabase } from '@sparktrack/db';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import {
  AllowUnprovisionedLearner,
  CurrentUser,
  Public,
  Roles,
  type AuthUser,
} from '../../common/auth/auth.guard';
import { KYSELY } from '../../common/database/database.module';
import { AuthPlatformService } from './auth-platform.service';
import { TermiiSmsService } from './termii-sms.service';

const UpdateConsentPreferencesSchema = z.object({
  consentStatus: z.enum(['VERIFIED_ACTIVE', 'RESTRICTED_INTERNAL_ONLY', 'REVOKED']),
  allowPublicPortfolio: z.boolean(),
  allowPartnerTalentDiscovery: z.boolean(),
});

export const RegisterRoleSchema = z.object({
  role: z.literal('PARENT'),
  fullName: z.string().min(2).max(120),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(7).max(24).optional(),
});

const RegisterChildSchema = z.object({
  fullName: z.string().min(2).max(120),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  educationStage: z.string().min(2).max(40),
  schoolName: z.string().max(160).optional(),
  declaredInterests: z.array(z.string().min(2).max(80)).min(1).max(8),
  guardianName: z.string().min(2).max(120).optional(),
  guardianPhone: z.string().min(7).max(24).optional(),
  guardianEmail: z.string().email().optional(),
  activateConsentImmediately: z.boolean().optional(),
  allowPublicPortfolio: z.boolean().optional(),
  allowPartnerTalentDiscovery: z.boolean().optional(),
});

const BootstrapAdminSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().optional(),
  adminSecret: z.string().min(16).max(256),
});

@ApiTags('auth')
@ApiBearerAuth()
@Controller('v1/auth')
class AuthController {
  constructor(private readonly auth: AuthPlatformService) {}

  @Get('me')
  @AllowUnprovisionedLearner()
  @ApiOperation({ summary: 'Return the authenticated user identity and role' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.currentProfile(user);
  }

  @Post('register-role')
  @AllowUnprovisionedLearner()
  @ApiOperation({ summary: 'Provision a Parent/Guardian, School Admin, Partner Organisation, or Mentor account' })
  registerRole(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.auth.registerRole(user, RegisterRoleSchema.parse(body));
  }

  @Get('children')
  @Roles('PARENT', 'SCHOOL_ADMIN', 'ORG_PARTNER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List children or students managed by the authenticated Parent or School/Organisation' })
  listChildren(@CurrentUser() user: AuthUser) {
    return this.auth.listManagedLearners(user);
  }

  @Post('children')
  @Roles('PARENT', 'SCHOOL_ADMIN', 'ORG_PARTNER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Register a Junior/Senior Secondary learner under a Parent or School/Organisation' })
  registerChild(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.auth.registerChild(user, RegisterChildSchema.parse(body));
  }

  @Post('admin/bootstrap')
  @AllowUnprovisionedLearner()
  @ApiOperation({ summary: 'Internal operator endpoint: provision a SUPER_ADMIN account using ADMIN_REGISTRATION_SECRET' })
  bootstrapAdmin(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.auth.bootstrapSuperAdmin(user, BootstrapAdminSchema.parse(body));
  }

  @Post('onboarding')
  @AllowUnprovisionedLearner()
  @Roles('LEARNER')
  @ApiOperation({ summary: 'Create the authenticated learner profile and register a guardian contact' })
  onboard(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.auth.onboard(user, LearnerOnboardingSchema.parse(body));
  }

  @Post('consent/request')
  @Roles('LEARNER')
  @ApiOperation({ summary: 'Send a time-limited parental consent code by SMS' })
  requestConsent(@CurrentUser() user: AuthUser) {
    return this.auth.requestConsent(user);
  }

  @Public()
  @Post('consent/verify')
  @ApiOperation({ summary: 'Verify the guardian SMS code and record consent or refusal' })
  verifyConsent(@Body() body: unknown) {
    return this.auth.verifyConsent(ConsentVerificationSchema.parse(body));
  }

  @Get('consent/preferences/:learnerId')
  @ApiOperation({ summary: 'Get current NDPA parental consent status and privacy flags for an authorized learner' })
  getConsentPreferences(@CurrentUser() user: AuthUser, @Param('learnerId', ParseUUIDPipe) learnerId: string) {
    return this.auth.getConsentPreferences(user, learnerId);
  }

  @Patch('consent/preferences/:learnerId')
  @Roles('PARENT', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update guardian privacy toggles or revoke consent (NDPA 2023 compliance)' })
  updateConsentPreferences(
    @CurrentUser() user: AuthUser,
    @Param('learnerId', ParseUUIDPipe) learnerId: string,
    @Body() body: unknown,
  ) {
    return this.auth.updateConsentPreferences(user, learnerId, UpdateConsentPreferencesSchema.parse(body));
  }
}

@ApiTags('health')
@Controller('health')
class HealthController {
  constructor(@Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Readiness & cryptographic ledger health check' })
  async ok() {
    const chain = await ledgerQueries.verifyChain(this.db);
    const ledgerIntegrityValid = chain.every((entry) => entry.isValid);
    if (!ledgerIntegrityValid) {
      throw new ServiceUnavailableException({
        status: 'degraded',
        database: 'connected',
        ledgerBlocks: chain.length,
        ledgerIntegrityValid: false,
        timestamp: new Date().toISOString(),
      });
    }
    return {
      status: 'ok',
      database: 'connected',
      ledgerBlocks: chain.length,
      ledgerIntegrityValid: true,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({ controllers: [AuthController, HealthController], providers: [AuthPlatformService, TermiiSmsService] })
export class AuthModule {}
