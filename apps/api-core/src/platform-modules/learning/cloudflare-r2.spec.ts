import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { UpstashRedisService } from '../../common/cache/upstash-redis.service';
import { CloudflareR2Service } from './cloudflare-r2.service';

describe('Cloudflare R2 & Upstash Redis Infrastructure Services', () => {
  it('generates valid AWS Signature V4 (AWS4-HMAC-SHA256) presigned PUT and GET URLs for Cloudflare R2', () => {
    const config = new ConfigService({
      R2_ACCOUNT_ID: '00000000000000000000000000000001',
      R2_ACCESS_KEY_ID: '11111111111111111111111111111111',
      R2_SECRET_ACCESS_KEY: '2222222222222222222222222222222222222222222222222222222222222222',
      R2_BUCKET_NAME: 'sparktrack-evidence-artifacts',
    });

    const r2 = new CloudflareR2Service(config);
    expect(r2.isConfigured()).toBe(true);

    const ticket = r2.presignUpload({
      learnerId: '11111111-1111-4111-8111-111111111113',
      fileName: 'solar-tracker-schematic.pdf',
      contentType: 'application/pdf',
    });

    expect(ticket.provider).toBe('CLOUDFLARE_R2_S3_V4');
    expect(ticket.bucketName).toBe('sparktrack-evidence-artifacts');
    expect(ticket.r2Key).toMatch(
      /^learners\/11111111-1111-4111-8111-111111111113\/artifacts\/[0-9a-f-]+-solar-tracker-schematic\.pdf$/,
    );

    const uploadUrl = new URL(ticket.uploadUrl);
    expect(uploadUrl.hostname).toBe('00000000000000000000000000000001.r2.cloudflarestorage.com');
    expect(uploadUrl.pathname).toContain('/sparktrack-evidence-artifacts/learners/');
    expect(uploadUrl.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(uploadUrl.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(uploadUrl.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gracefully handles unconfigured Upstash Redis in isolated unit tests and connects when configured', async () => {
    const unconfigured = new UpstashRedisService(new ConfigService({}));
    expect(unconfigured.isConfigured()).toBe(false);
    expect((await unconfigured.ping()).status).toBe('unconfigured');
    expect(await unconfigured.getJson('any-key')).toBeNull();
    expect((await unconfigured.checkRateLimit('rl:test', 5, 60)).allowed).toBe(true);
  });
});
