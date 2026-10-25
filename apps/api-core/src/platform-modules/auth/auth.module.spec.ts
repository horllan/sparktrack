import { describe, expect, it } from 'vitest';
import { RegisterRoleSchema } from './auth.module';

describe('Public role registration validation', () => {
  it('allows parent registration but requires approval for privileged roles', () => {
    const base = { fullName: 'SparkTrack User', email: 'user@example.com' };

    expect(RegisterRoleSchema.safeParse({ ...base, role: 'PARENT' }).success).toBe(true);
    expect(RegisterRoleSchema.safeParse({ ...base, role: 'SCHOOL_ADMIN' }).success).toBe(false);
    expect(RegisterRoleSchema.safeParse({ ...base, role: 'ORG_PARTNER' }).success).toBe(false);
    expect(RegisterRoleSchema.safeParse({ ...base, role: 'MENTOR' }).success).toBe(false);
  });
});
