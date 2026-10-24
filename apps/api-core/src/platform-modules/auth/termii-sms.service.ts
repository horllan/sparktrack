import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TermiiSmsService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async sendConsentCode(phoneNumber: string, code: string, challengeId: string): Promise<void> {
    const verificationUrl = this.config.getOrThrow<string>('CONSENT_VERIFICATION_URL');
    const senderId = this.config.getOrThrow<string>('TERMII_SENDER_ID');
    const apiKey = this.config.getOrThrow<string>('TERMII_API_KEY');
    const url = new URL(verificationUrl);
    if (url.protocol !== 'https:' && this.config.get<string>('NODE_ENV') === 'production') {
      throw new ServiceUnavailableException('Consent verification URL must use HTTPS in production.');
    }
    url.searchParams.set('challengeId', challengeId);

    let response: Response;
    try {
      response = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          api_key: apiKey,
          to: phoneNumber.replace(/^\+/, ''),
          from: senderId,
          sms: `SparkTrack parental consent code: ${code}. Open ${url.toString()} to review and respond. Expires in 10 minutes.`,
          type: 'plain',
          channel: 'generic',
        }),
      });
    } catch {
      throw new ServiceUnavailableException('The consent SMS could not be sent. Please try again.');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('The consent SMS provider rejected the request. Please try again.');
    }
    const result = await response.json().catch(() => null) as { code?: string } | null;
    if (!result?.code || result.code.toLowerCase() !== 'ok') {
      throw new ServiceUnavailableException('The consent SMS provider rejected the request. Please try again.');
    }
  }
}
