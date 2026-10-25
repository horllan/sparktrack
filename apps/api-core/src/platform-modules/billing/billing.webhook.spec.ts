import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { EnrolLearnerSchema, verifyPaystackSignature, verifyStripeSignature } from './billing.module';

describe('Billing enrolment validation', () => {
  it('rejects client-selected free-pilot and scholarship activation', () => {
    const base = {
      learnerId: '11111111-1111-4111-8111-111111111111',
      cohortId: '22222222-2222-4222-8222-222222222222',
    };

    expect(EnrolLearnerSchema.safeParse({ ...base, paymentProvider: 'PAYSTACK' }).success).toBe(true);
    expect(EnrolLearnerSchema.safeParse({ ...base, paymentProvider: 'FREE_PILOT' }).success).toBe(false);
    expect(EnrolLearnerSchema.safeParse({ ...base, paymentProvider: 'SCHOLARSHIP' }).success).toBe(false);
  });
});

describe('Billing webhook cryptographic signature verification', () => {
  it('verifies valid Paystack HMAC-SHA512 signatures and rejects tampered payloads', () => {
    const secret = 'sk_test_sparktrack_paystack_secret';
    const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'ref_123', amount: 1500000 } });
    const sig = createHmac('sha512', secret).update(payload).digest('hex');

    expect(verifyPaystackSignature(payload, sig, secret)).toBe(true);
    expect(verifyPaystackSignature(payload, sig, 'wrong_secret')).toBe(false);
    expect(verifyPaystackSignature(payload + ' ', sig, secret)).toBe(false);
  });

  it('verifies valid Stripe t,v1 HMAC-SHA256 signatures and rejects tampered payloads', () => {
    const secret = 'whsec_sparktrack_stripe_secret';
    const timestamp = '1730000000';
    const payload = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_1' } } });
    const v1 = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    const header = `t=${timestamp},v1=${v1}`;

    expect(verifyStripeSignature(payload, header, secret)).toBe(true);
    expect(verifyStripeSignature(payload, header, 'wrong_secret')).toBe(false);
    expect(verifyStripeSignature(payload, `t=${timestamp},v1=deadbeef`, secret)).toBe(false);
  });
});
