import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { TermiiSmsService } from './termii-sms.service';

describe('TermiiSmsService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function createService() {
    vi.stubEnv('CONSENT_VERIFICATION_URL', 'https://sparktrack.example/parent/consent');
    vi.stubEnv('TERMII_SENDER_ID', 'SparkTrack');
    vi.stubEnv('TERMII_API_KEY', 'test-key');
    return new TermiiSmsService(new ConfigService());
  }

  it('sends a consent link and code through Termii', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'ok' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const sms = createService();

    await sms.sendConsentCode('+2348012345678', '012345', 'challenge-id');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.ng.termii.com/api/sms/send');
    const payload = JSON.parse(String(options.body)) as { to: string; sms: string; api_key: string };
    expect(payload.to).toBe('2348012345678');
    expect(payload.sms).toContain('012345');
    expect(payload.sms).toContain('challengeId=challenge-id');
    expect(payload.api_key).toBe('test-key');
  });

  it('surfaces provider rejection instead of reporting successful delivery', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'invalid' }), { status: 200 })));
    const sms = createService();

    await expect(sms.sendConsentCode('+2348012345678', '012345', 'challenge-id'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
