import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Kysely } from 'kysely';
import { describe, expect, it } from 'vitest';
import type { SparkTrackDatabase } from '@sparktrack/db';
import { LearnerAccessService, ROLES_KEY } from '../../common/auth/auth.guard';
import type { AuthUser } from '../../common/auth/auth.guard';
import { AuthPlatformService } from './auth-platform.service';
import { AcceptInvitationSchema, AuthModule, RegisterRoleSchema } from './auth.module';
import { TermiiSmsService } from './termii-sms.service';

describe('Public role registration validation', () => {
  it('allows parent registration but requires approval for privileged roles', () => {
    const base = { fullName: 'SparkTrack User', email: 'user@example.com' };

    expect(RegisterRoleSchema.safeParse({ ...base, role: 'PARENT' }).success).toBe(true);
    expect(RegisterRoleSchema.safeParse({ ...base, role: 'SCHOOL_ADMIN' }).success).toBe(false);
    expect(RegisterRoleSchema.safeParse({ ...base, role: 'ORG_PARTNER' }).success).toBe(false);
    expect(RegisterRoleSchema.safeParse({ ...base, role: 'MENTOR' }).success).toBe(false);
  });

  it('requires a signed invitation token to accept privileged institutional or mentor roles', () => {
    const payload = {
      fullName: 'Adaeze Obi',
      email: 'adaeze@queenscollege.edu.ng',
      role: 'SCHOOL_ADMIN' as const,
      organisationName: "Queen's College Lagos",
      organisationType: 'SCHOOL' as const,
    };

    expect(AcceptInvitationSchema.safeParse(payload).success).toBe(false);
    expect(
      AcceptInvitationSchema.safeParse({
        ...payload,
        invitationToken: 'SPK-INV.SCHOOL_ADMIN.1999999999.0123456789abcdef0123456789abcdef',
      }).success,
    ).toBe(true);
  });
});

describe('Managed learner listing & operator secret domain isolation', () => {
  const service = new AuthPlatformService(
    {} as Kysely<SparkTrackDatabase>,
    {
      get: (key: string) => (key === 'CONSENT_OTP_SECRET' ? 'consent_only_secret_32_bytes_minimum_value' : undefined),
    } as unknown as ConfigService,
    {} as TermiiSmsService,
    {} as LearnerAccessService,
  );

  it.each(['SCHOOL_ADMIN', 'ORG_PARTNER'] as const)(
    'rejects %s accounts without an organisation',
    async (role) => {
      const user: AuthUser = { id: 'user-id', role, organisationId: null };
      await expect(service.listManagedLearners(user)).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('never falls back from ADMIN_REGISTRATION_SECRET to CONSENT_OTP_SECRET for Super Admin bootstrap', async () => {
    const user: AuthUser = { id: 'user-id', role: 'LEARNER', organisationId: null };
    await expect(
      service.bootstrapSuperAdmin(user, {
        fullName: 'Operator',
        adminSecret: 'consent_only_secret_32_bytes_minimum_value',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('restricts per-block /api/health/ledger audit endpoint to SUPER_ADMIN', () => {
    const controllers = Reflect.getMetadata('controllers', AuthModule) as Array<{
      prototype: { ledger?: () => unknown };
    }>;
    const healthCtrl = controllers.find((c) => Object.hasOwn(c.prototype, 'ledger'));
    const handler = healthCtrl?.prototype.ledger;
    if (!handler) throw new Error('HealthController.ledger route was not registered.');
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['SUPER_ADMIN']);
  });
});
