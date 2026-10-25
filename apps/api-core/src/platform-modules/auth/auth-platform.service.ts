import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { accessQueries, consentQueries, onboardingQueries } from '@sparktrack/db';
import type { Kysely } from 'kysely';
import type { ConsentVerification, LearnerOnboarding } from '@sparktrack/contracts';
import type { SparkTrackDatabase } from '@sparktrack/db';
import { KYSELY } from '../../common/database/database.module';
import { LearnerAccessService, type AuthUser } from '../../common/auth/auth.guard';
import { TermiiSmsService } from './termii-sms.service';

const CONSENT_TTL_MS = 10 * 60_000;

@Injectable()
export class AuthPlatformService {
  private readonly logger = new Logger(AuthPlatformService.name);

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(TermiiSmsService) private readonly sms: TermiiSmsService,
    private readonly access: LearnerAccessService,
  ) {}

  async onboard(user: AuthUser, payload: LearnerOnboarding) {
    if (user.role !== 'LEARNER') throw new ForbiddenException();
    const result = await onboardingQueries.onboard(this.db, user.id, payload);
    if (result.status === 'learner_account_conflict') {
      throw new ConflictException('This account cannot be used for learner onboarding.');
    }
    if (result.status === 'guardian_account_conflict') {
      throw new ConflictException('The guardian email is already associated with a non-parent account.');
    }
    return { learnerId: user.id, status: result.status };
  }

  async requestConsent(user: AuthUser) {
    if (user.role !== 'LEARNER') throw new ForbiddenException();
    const recipient = await consentQueries.recipient(this.db, user.id);
    if (!recipient) throw new ConflictException('Complete learner onboarding before requesting consent.');
    if (recipient.consent_status === 'VERIFIED_ACTIVE') return { status: 'VERIFIED_ACTIVE' as const };
    if (!recipient.phone_number) throw new ConflictException('The guardian phone number is missing.');

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + CONSENT_TTL_MS);
    const challengeId = randomUUID();
    const createdChallengeId = await consentQueries.createChallenge(this.db, {
      id: challengeId,
      learnerId: user.id,
      guardianId: recipient.guardian_id,
      otpHmac: this.hashCode(challengeId, code),
      expiresAt,
    });
    if (!createdChallengeId) {
      throw new HttpException('Please wait one minute before requesting another consent code.', HttpStatus.TOO_MANY_REQUESTS);
    }
    try {
      await this.sms.sendConsentCode(recipient.phone_number, code, createdChallengeId);
    } catch (error) {
      await consentQueries.discardChallenge(this.db, createdChallengeId);
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(`Consent SMS delivery failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw new ServiceUnavailableException('The consent SMS could not be sent. Please try again.');
    }
    return { status: 'PENDING_PARENTAL_CONSENT' as const, expiresAt: expiresAt.toISOString() };
  }

  async verifyConsent(payload: ConsentVerification) {
    const result = await consentQueries.verify(this.db, {
      challengeId: payload.challengeId,
      otpHmac: this.hashCode(payload.challengeId, payload.otpCode),
      consentGiven: payload.consentGiven,
      allowPublicPortfolio: payload.grants.allowPublicPortfolio,
      allowPartnerTalentDiscovery: payload.grants.allowPartnerTalentDiscovery,
    });
    switch (result.status) {
      case 'verified':
      case 'already_verified':
        return { status: 'VERIFIED_ACTIVE' as const };
      case 'declined':
      case 'already_declined':
        return { status: 'REVOKED' as const };
      case 'invalid':
        throw new ForbiddenException('The code is incorrect. Check the SMS and try again.');
      case 'expired':
      case 'not_found':
        throw new ForbiddenException('This consent request has expired. Ask the learner to send a new request.');
    }
  }

  async getConsentPreferences(user: AuthUser, learnerId: string) {
    await this.access.assertCanAccess(user, learnerId);
    const prefs = await consentQueries.getPreferences(this.db, learnerId);
    if (!prefs) throw new NotFoundException('Learner profile not found');
    return prefs;
  }

  async updateConsentPreferences(
    user: AuthUser,
    learnerId: string,
    payload: {
      consentStatus: 'VERIFIED_ACTIVE' | 'RESTRICTED_INTERNAL_ONLY' | 'REVOKED';
      allowPublicPortfolio: boolean;
      allowPartnerTalentDiscovery: boolean;
    },
  ) {
    if (user.role !== 'PARENT' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a verified guardian can change consent and privacy preferences.');
    }
    await this.access.assertCanAccess(user, learnerId);
    const updated = await consentQueries.updatePreferences(this.db, {
      learnerId,
      ...payload,
    });
    if (updated.status === 'not_found') throw new NotFoundException('Learner profile not found');
    if (updated.status === 'requires_sms_verification') {
      throw new ForbiddenException(
        'Consent can only be activated through the 6-digit guardian SMS OTP verification flow.',
      );
    }
    return {
      learnerId: updated.learnerId,
      consentStatus: updated.consentStatus,
      allowPublicPortfolio: updated.allowPublicPortfolio,
      allowPartnerTalentDiscovery: updated.allowPartnerTalentDiscovery,
    };
  }

  async currentProfile(user: AuthUser) {
    const row = await accessQueries.userById(this.db, user.id);
    if (!row) return user;
    return {
      id: row.id,
      role: row.role,
      organisationId: row.organisation_id,
    };
  }

  async registerRole(
    user: AuthUser,
    payload: {
      role: 'PARENT' | 'SCHOOL_ADMIN' | 'ORG_PARTNER' | 'MENTOR';
      fullName: string;
      email?: string;
      phoneNumber?: string;
      organisationName?: string;
      organisationType?: 'SCHOOL' | 'NGO' | 'TRAINING_PROVIDER' | 'EMPLOYER' | 'GOVERNMENT';
    },
  ) {
    const result = await onboardingQueries.registerRole(this.db, user.id, payload);
    if (result.status === 'role_conflict') {
      throw new ConflictException(
        `This account is already registered with role ${result.existingRole}. Sign in with that workspace instead.`,
      );
    }
    return result;
  }

  async registerChild(
    user: AuthUser,
    payload: {
      fullName: string;
      dateOfBirth: string;
      educationStage: string;
      schoolName?: string;
      declaredInterests: string[];
      guardianName?: string;
      guardianPhone?: string;
      guardianEmail?: string;
      activateConsentImmediately?: boolean;
      allowPublicPortfolio?: boolean;
      allowPartnerTalentDiscovery?: boolean;
    },
  ) {
    if (
      user.role !== 'PARENT' &&
      user.role !== 'SCHOOL_ADMIN' &&
      user.role !== 'ORG_PARTNER' &&
      user.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException('Only parents, school administrators, or partner organisations can register a child.');
    }
    const result = await onboardingQueries.registerChild(this.db, user, payload);
    if (result.status === 'missing_guardian_contact') {
      throw new BadRequestException(
        'When a school or organisation registers a learner, the parent/guardian full name and phone number are required for NDPA consent.',
      );
    }
    if (result.status === 'guardian_account_conflict') {
      throw new ConflictException('The guardian email is already associated with a non-parent account.');
    }
    return result;
  }

  async listManagedLearners(user: AuthUser) {
    if (
      user.role !== 'PARENT' &&
      user.role !== 'SCHOOL_ADMIN' &&
      user.role !== 'ORG_PARTNER' &&
      user.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException('Unauthorized to list managed learners.');
    }
    return onboardingQueries.listManagedLearners(this.db, user);
  }

  async bootstrapSuperAdmin(
    user: AuthUser,
    payload: { fullName: string; email?: string; adminSecret: string },
  ) {
    const configuredSecret =
      this.config.get<string>('ADMIN_REGISTRATION_SECRET') ??
      this.config.getOrThrow<string>('CONSENT_OTP_SECRET');

    const expectedBuf = Buffer.from(configuredSecret, 'utf8');
    const suppliedBuf = Buffer.from(payload.adminSecret, 'utf8');
    const isValid =
      expectedBuf.length >= 16 &&
      expectedBuf.length === suppliedBuf.length &&
      timingSafeEqual(expectedBuf, suppliedBuf);

    if (!isValid) {
      throw new ForbiddenException('Invalid operator security key. Super Admin provisioning denied.');
    }

    return onboardingQueries.bootstrapSuperAdmin(this.db, user.id, {
      fullName: payload.fullName,
      email: payload.email,
    });
  }

  private hashCode(challengeId: string, code: string): string {
    const secret = this.config.getOrThrow<string>('CONSENT_OTP_SECRET');
    if (Buffer.byteLength(secret, 'utf8') < 32) {
      throw new ServiceUnavailableException('CONSENT_OTP_SECRET must contain at least 32 bytes.');
    }
    return createHmac('sha256', secret)
      .update(`${challengeId}:${code}`)
      .digest('hex');
  }
}
