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

@ApiTags('auth')
@ApiBearerAuth()
@Controller('v1/auth')
class AuthController {
  constructor(private readonly auth: AuthPlatformService) {}

  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated user identity and role' })
  me(@CurrentUser() user: AuthUser) {
    return user;
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
