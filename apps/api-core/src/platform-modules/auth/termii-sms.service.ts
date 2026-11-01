import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsDispatchResult {
  deliveryMode: 'LIVE' | 'SANDBOX_SIMULATION';
  verificationLink: string;
}

@Injectable()
export class TermiiSmsService {
  private readonly logger = new Logger(TermiiSmsService.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private isPlaceholderKey(apiKey: string | undefined): boolean {
    if (!apiKey) return true;
    const trimmed = apiKey.trim();
    return (
      trimmed.length === 0 ||
      trimmed.includes('REPLACE_WITH') ||
      trimmed.includes('xxxxxxxx')
    );
  }

  async sendConsentCode(phoneNumber: string, code: string, challengeId: string): Promise<SmsDispatchResult> {
    const stage = (
      this.config.get<string>('SPARKTRACK_STAGE') ??
      this.config.get<string>('NODE_ENV') ??
      'development'
    ).toLowerCase();
    const isProduction = stage === 'production';

    const verificationUrl =
      this.config.get<string>('CONSENT_VERIFICATION_URL') ??
      (isProduction ? '' : 'http://localhost:3000/parent/consent');
    if (!verificationUrl) {
      throw new ServiceUnavailableException('CONSENT_VERIFICATION_URL must be configured.');
    }

    const url = new URL(verificationUrl);
    if (url.protocol !== 'https:' && isProduction) {
      throw new ServiceUnavailableException('Consent verification URL must use HTTPS in production.');
    }
    url.searchParams.set('challengeId', challengeId);

    const senderId = this.config.get<string>('TERMII_SENDER_ID') ?? 'SparkTrack';
    const apiKey = this.config.get<string>('TERMII_API_KEY');

    if (this.isPlaceholderKey(apiKey)) {
      if (isProduction) {
        throw new ServiceUnavailableException('TERMII_API_KEY must be configured with a live key in production.');
      }
      this.logger.log(
        `[Termii Sandbox Simulation] Simulated SMS to ${phoneNumber.slice(0, 4)}***${phoneNumber.slice(-2)} for challenge ${challengeId}`,
      );
      return {
        deliveryMode: 'SANDBOX_SIMULATION',
        verificationLink: url.toString(),
      };
    }

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
    const result = (await response.json().catch(() => null)) as { code?: string } | null;
    if (!result?.code || result.code.toLowerCase() !== 'ok') {
      throw new ServiceUnavailableException('The consent SMS provider rejected the request. Please try again.');
    }

    return {
      deliveryMode: 'LIVE',
      verificationLink: url.toString(),
    };
  }
}
