import { describe, expect, it } from 'vitest';
import { AcceptInvitationSchema, RegisterRoleSchema } from './auth.module';

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
