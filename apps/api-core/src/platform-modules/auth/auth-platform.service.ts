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
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { accessQueries, apiKeyQueries, consentQueries, governanceQueries, onboardingQueries } from '@sparktrack/db';
import type { Kysely } from 'kysely';
import type { ConsentVerification, LearnerOnboarding } from '@sparktrack/contracts';
import type { SparkTrackDatabase } from '@sparktrack/db';
import { KYSELY } from '../../common/database/database.module';
import { LearnerAccessService, type AuthUser } from '../../common/auth/auth.guard';
import { UpstashRedisService } from '../../common/cache/upstash-redis.service';
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
    @Optional() @Inject(UpstashRedisService) private readonly cache?: UpstashRedisService,
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
    let smsResult: Awaited<ReturnType<TermiiSmsService['sendConsentCode']>>;
    try {
      smsResult = await this.sms.sendConsentCode(recipient.phone_number, code, createdChallengeId);
    } catch (error) {
      await consentQueries.discardChallenge(this.db, createdChallengeId);
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(`Consent SMS delivery failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw new ServiceUnavailableException('The consent SMS could not be sent. Please try again.');
    }
    return {
      status: 'PENDING_PARENTAL_CONSENT' as const,
      challengeId: createdChallengeId,
      expiresAt: expiresAt.toISOString(),
      deliveryMode: smsResult?.deliveryMode ?? ('LIVE_SMS' as const),
      ...(smsResult?.deliveryMode === 'SANDBOX_SIMULATION'
        ? {
            sandboxOtpCode: code,
            verificationLink: smsResult.verificationLink,
          }
        : {}),
    };
  }

  async verifyConsent(payload: ConsentVerification) {
    if (this.cache) {
      const rl = await this.cache.checkRateLimit(`sparktrack:rl:consent-verify:${payload.challengeId}`, 10, 600);
      if (!rl.allowed) {
        throw new HttpException('Too many verification attempts. Please wait before trying again.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
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
      role: 'PARENT';
      fullName: string;
      email?: string;
      phoneNumber?: string;
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
      learnerStage?: string;
      educationLevel?: string;
      learningGoal?: string;
      currentRole?: string;
      targetRole?: string;
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
    if (
      (user.role === 'SCHOOL_ADMIN' || user.role === 'ORG_PARTNER') &&
      !user.organisationId
    ) {
      throw new ForbiddenException('Your account is not assigned to an organisation.');
    }
    const learners = await onboardingQueries.listManagedLearners(this.db, user);
    let velocityFlagged = false;
    if (this.cache) {
      const rl = await this.cache.checkRateLimit(`sparktrack:dam:velocity:roster:${user.id}`, 30, 60);
      velocityFlagged = !rl.allowed;
    }
    await governanceQueries
      .logActivity(this.db, {
        actorId: user.id,
        actorRole: user.role,
        organisationId: user.organisationId,
        actionType: 'ROSTER_PII_QUERY',
        resourceDomain: 'CORE_IDENTITY',
        classificationAccessed: 'TIER_3_CONFIDENTIAL_PII',
        recordsReturned: learners.length,
        maskingApplied: user.role !== 'PARENT',
        velocityFlagged,
        outcome: velocityFlagged ? 'HIGH_VELOCITY_ALERT' : 'ALLOWED',
      })
      .catch(() => null);
    if (user.role === 'PARENT') return learners;
    return learners.map((learner) => ({ ...learner, whatsappOptIn: false }));
  }

  async bootstrapSuperAdmin(
    user: AuthUser,
    payload: { fullName: string; email?: string; adminSecret: string },
  ) {
    if (this.cache) {
      const rl = await this.cache.checkRateLimit(`sparktrack:rl:admin-bootstrap:${user.id}`, 5, 900);
      if (!rl.allowed) {
        throw new HttpException('Too many operator bootstrap attempts. Try again in 15 minutes.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const configuredSecret = this.getAdminSecret();
    const expectedBuf = Buffer.from(configuredSecret, 'utf8');
    const suppliedBuf = Buffer.from(payload.adminSecret, 'utf8');
    const isValid =
      expectedBuf.length >= 32 &&
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

  async issueInvitation(payload: {
    email: string;
    role: 'SCHOOL_ADMIN' | 'ORG_PARTNER' | 'MENTOR';
    fullName?: string;
    organisationName?: string;
    organisationType?: 'SCHOOL' | 'NGO' | 'TRAINING_PROVIDER' | 'EMPLOYER' | 'GOVERNMENT';
    targetUserId?: string;
  }) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const expiresEpoch = Math.floor(Date.now() / 1000) + 7 * 86_400;
    const signature = this.signInvitation(normalizedEmail, payload.role, expiresEpoch);
    const invitationToken = `SPK-INV.${payload.role}.${expiresEpoch}.${signature}`;

    let provisionedUser: { userId: string; role: string; organisationId: string | null } | null = null;
    if (payload.targetUserId) {
      const res = await onboardingQueries.provisionPrivilegedRole(this.db, payload.targetUserId, {
        role: payload.role,
        fullName: payload.fullName?.trim() || normalizedEmail,
        email: normalizedEmail,
        organisationName: payload.organisationName,
        organisationType: payload.organisationType,
      });
      provisionedUser = {
        userId: res.userId,
        role: res.role,
        organisationId: res.organisationId,
      };
    }

    return {
      invitationToken,
      email: normalizedEmail,
      role: payload.role,
      expiresAt: new Date(expiresEpoch * 1000).toISOString(),
      provisionedUser,
    };
  }

  async acceptInvitation(
    user: AuthUser,
    payload: {
      invitationToken: string;
      role: 'SCHOOL_ADMIN' | 'ORG_PARTNER' | 'MENTOR';
      fullName: string;
      email: string;
      phoneNumber?: string;
      organisationName?: string;
      organisationType?: 'SCHOOL' | 'NGO' | 'TRAINING_PROVIDER' | 'EMPLOYER' | 'GOVERNMENT';
    },
  ) {
    const parts = payload.invitationToken.trim().split('.');
    if (parts.length !== 4 || parts[0] !== 'SPK-INV') {
      throw new ForbiddenException('Invalid invitation token format.');
    }

    const [, tokenRole, expiresStr, suppliedSig] = parts;
    const expiresEpoch = Number(expiresStr);
    if (!Number.isFinite(expiresEpoch) || expiresEpoch <= Math.floor(Date.now() / 1000)) {
      throw new ForbiddenException('This invitation token has expired. Request a fresh token from SparkTrack Operations.');
    }
    if (tokenRole !== payload.role) {
      throw new ForbiddenException(`This invitation token is scoped to role ${tokenRole}, not ${payload.role}.`);
    }

    const normalizedEmail = payload.email.trim().toLowerCase();
    const expectedSig = this.signInvitation(normalizedEmail, payload.role, expiresEpoch);
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    const suppliedBuf = Buffer.from(suppliedSig ?? '', 'hex');

    if (expectedBuf.length === 0 || expectedBuf.length !== suppliedBuf.length || !timingSafeEqual(expectedBuf, suppliedBuf)) {
      throw new ForbiddenException('Invalid invitation token signature or email mismatch.');
    }

    return onboardingQueries.provisionPrivilegedRole(this.db, user.id, {
      role: payload.role,
      fullName: payload.fullName,
      email: normalizedEmail,
      phoneNumber: payload.phoneNumber,
      organisationName: payload.organisationName,
      organisationType: payload.organisationType,
    });
  }

  async listInstitutionalAccounts() {
    return onboardingQueries.listInstitutionalAndMentorAccounts(this.db);
  }

  async registerChildrenBulk(
    user: AuthUser,
    students: Array<{
      fullName: string;
      dateOfBirth: string;
      educationStage: string;
      schoolName?: string;
      declaredInterests: string[];
      guardianName?: string;
      guardianPhone?: string;
      guardianEmail?: string;
    }>,
  ) {
    const created: Array<{
      learnerId: string;
      fullName: string;
      educationStage: string;
      consentStatus: string;
      accessCode: string;
    }> = [];
    const errors: Array<{ index: number; fullName: string; reason: string }> = [];

    for (let i = 0; i < students.length; i++) {
      const s = students[i]!;
      try {
        const res = await this.registerChild(user, s);
        if (res.status === 'created') {
          created.push({
            learnerId: res.learnerId,
            fullName: res.fullName,
            educationStage: res.educationStage,
            consentStatus: res.consentStatus,
            accessCode: res.accessCode,
          });
        }
      } catch (err) {
        errors.push({
          index: i + 1,
          fullName: s.fullName,
          reason: err instanceof Error ? err.message : 'Could not register student',
        });
      }
    }

    return {
      totalSubmitted: students.length,
      createdCount: created.length,
      errorCount: errors.length,
      created,
      errors,
    };
  }

  async listApiKeys(user: AuthUser) {
    return apiKeyQueries.listKeys(this.db, user);
  }

  async issueApiKey(
    user: AuthUser,
    payload: {
      label: string;
      scopes: string[];
      rateLimitPerMinute: number;
      expiresInDays?: number;
    },
  ) {
    const issued = await apiKeyQueries.issueKey(this.db, {
      organisationId: user.organisationId,
      createdBy: user.id,
      label: payload.label,
      scopes: payload.scopes,
      rateLimitPerMinute: payload.rateLimitPerMinute,
      expiresInDays: payload.expiresInDays,
    });
    await governanceQueries
      .logActivity(this.db, {
        actorId: user.id,
        actorRole: user.role,
        organisationId: user.organisationId,
        actionType: 'ENTERPRISE_API_KEY_ISSUED',
        resourceDomain: 'CORE_IDENTITY',
        classificationAccessed: 'TIER_4_RESTRICTED_MINOR_SECRETS',
        recordsReturned: 1,
        maskingApplied: true,
        outcome: 'TOKENIZED_SHA256',
        metadata: { keyPrefix: issued.keyPrefix, scopes: issued.scopes },
      })
      .catch(() => null);
    return issued;
  }

  async revokeApiKey(user: AuthUser, keyId: string) {
    const res = await apiKeyQueries.revokeKey(this.db, keyId, user);
    if (res.status === 'not_found') {
      throw new NotFoundException('API key not found or already revoked.');
    }
    await governanceQueries
      .logActivity(this.db, {
        actorId: user.id,
        actorRole: user.role,
        organisationId: user.organisationId,
        actionType: 'ENTERPRISE_API_KEY_REVOKED',
        resourceDomain: 'CORE_IDENTITY',
        classificationAccessed: 'TIER_4_RESTRICTED_MINOR_SECRETS',
        recordsReturned: 1,
        maskingApplied: true,
        outcome: 'REVOKED',
        metadata: { keyId },
      })
      .catch(() => null);
    return res;
  }

  async dataGovernanceOverview() {
    return governanceQueries.overview(this.db);
  }

  async scanGovernanceSample(user: AuthUser, sampleText: string) {
    return governanceQueries.inspectAndMaskSample(this.db, user, sampleText);
  }

  private getAdminSecret(): string {
    const secret = this.config.get<string>('ADMIN_REGISTRATION_SECRET')?.trim();
    if (!secret || secret.startsWith('REPLACE_WITH') || Buffer.byteLength(secret, 'utf8') < 32) {
      throw new ServiceUnavailableException(
        'ADMIN_REGISTRATION_SECRET must be explicitly configured with at least 32 bytes.',
      );
    }
    return secret;
  }

  private signInvitation(email: string, role: string, expiresEpoch: number): string {
    const secret = this.getAdminSecret();
    return createHmac('sha256', secret)
      .update(`invite:${email}:${role}:${expiresEpoch}`)
      .digest('hex')
      .slice(0, 32);
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
