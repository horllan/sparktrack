import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LearnerOnboardingSchema, ConsentVerificationSchema } from '@sparktrack/contracts';
import {
  AllowUnprovisionedLearner, CurrentUser, Public, Roles, type AuthUser,
} from '../../common/auth/auth.guard';
import { AuthPlatformService } from './auth-platform.service';
import { TermiiSmsService } from './termii-sms.service';

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
}

@ApiTags('health')
@Controller('health')
class HealthController {
  @Public()
  @Get()
  ok() {
    return { status: 'ok' };
  }
}

@Module({ controllers: [AuthController, HealthController], providers: [AuthPlatformService, TermiiSmsService] })
export class AuthModule {}
