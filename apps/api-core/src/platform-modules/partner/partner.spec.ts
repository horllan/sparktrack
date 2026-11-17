import { describe, expect, it } from 'vitest';
import {
  decryptWebhookSecret,
  encryptWebhookSecret,
  signPartnerWebhookPayload,
} from '@sparktrack/db';

async function verifyWebhookWebCrypto(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((item) => {
      const [k, v] = item.trim().split('=');
      return [k, v];
    }),
  );
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1 || !/^\d+$/.test(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > toleranceSeconds) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${rawBody}`));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return expected === v1;
}

describe('Partner Integration Gateway — Crypto & Web Crypto Webhook Verification', () => {
  it('encrypts and decrypts webhook secrets with AES-256-GCM', () => {
    const masterKey = 'super-secret-master-key-for-testing-2026';
    const rawSecret = 'whsec_spk_test_secret_value_123456';
    const ciphertext = encryptWebhookSecret(rawSecret, masterKey);
    expect(ciphertext).not.toContain(rawSecret);
    expect(ciphertext.split('.').length).toBe(3);
    expect(decryptWebhookSecret(ciphertext, masterKey)).toBe(rawSecret);
  });

  it('signs outbound partner webhooks and verifies them with Web Crypto HMAC-SHA256', async () => {
    const secret = 'whsec_spk_test_webhook_signing_key';
    const payloadJson = JSON.stringify({
      id: 'evt_123',
      type: 'evidence.sealed',
      data: { externalLearnerId: 'bootcamp-2026-042', ledgerSeq: 42 },
    });
    const nowEpoch = Math.floor(Date.now() / 1000);
    const header = signPartnerWebhookPayload(payloadJson, secret, nowEpoch);

    await expect(verifyWebhookWebCrypto(payloadJson, header, secret)).resolves.toBe(true);
    await expect(verifyWebhookWebCrypto(`${payloadJson} `, header, secret)).resolves.toBe(false);
    await expect(verifyWebhookWebCrypto(payloadJson, header, 'wrong-secret')).resolves.toBe(false);

    const staleHeader = signPartnerWebhookPayload(payloadJson, secret, nowEpoch - 900);
    await expect(verifyWebhookWebCrypto(payloadJson, staleHeader, secret, 300)).resolves.toBe(false);
  });
});

