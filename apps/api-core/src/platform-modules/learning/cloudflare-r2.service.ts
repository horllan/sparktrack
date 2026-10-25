import { createHash, createHmac, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PresignedR2Ticket {
  provider: 'CLOUDFLARE_R2_S3_V4' | 'LOCAL_HMAC_FALLBACK';
  bucketName: string;
  r2Key: string;
  uploadUrl: string;
  downloadUrl: string;
  expiresAt: string;
  contentType: string;
}

@Injectable()
export class CloudflareR2Service {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID')?.trim();
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY')?.trim();
    return Boolean(
      accountId &&
        accessKeyId &&
        secretAccessKey &&
        !accountId.includes('your-') &&
        !accessKeyId.includes('your-'),
    );
  }

  presignUpload(p: {
    learnerId: string;
    fileName: string;
    contentType: string;
    expiresInSeconds?: number;
  }): PresignedR2Ticket {
    const safeFile = p.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const r2Key = `learners/${p.learnerId}/artifacts/${randomUUID()}-${safeFile}`;
    const bucketName = this.config.get<string>('R2_BUCKET_NAME')?.trim() || 'sparktrack-evidence-artifacts';
    const expiresSeconds = Math.min(Math.max(p.expiresInSeconds ?? 900, 60), 3600);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresSeconds * 1000).toISOString();

    const accountId = this.config.get<string>('R2_ACCOUNT_ID')?.trim();
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY')?.trim();

    if (
      accountId &&
      accessKeyId &&
      secretAccessKey &&
      !accountId.includes('your-') &&
      !accessKeyId.includes('your-')
    ) {
      const host = `${accountId}.r2.cloudflarestorage.com`;
      const uploadUrl = this.signS3V4Url({
        method: 'PUT',
        host,
        bucketName,
        objectKey: r2Key,
        accessKeyId,
        secretAccessKey,
        expiresSeconds,
        now,
      });
      const downloadUrl = this.signS3V4Url({
        method: 'GET',
        host,
        bucketName,
        objectKey: r2Key,
        accessKeyId,
        secretAccessKey,
        expiresSeconds: 3600,
        now,
      });

      return {
        provider: 'CLOUDFLARE_R2_S3_V4',
        bucketName,
        r2Key,
        uploadUrl,
        downloadUrl,
        expiresAt,
        contentType: p.contentType,
      };
    }

    const endpoint = this.config.get<string>('R2_PUBLIC_ENDPOINT') ?? 'https://r2.sparktrack.africa';
    const signingSecret = secretAccessKey ?? 'dev-r2-signing-key';
    const signature = createHmac('sha256', signingSecret)
      .update(`${r2Key}:${p.contentType}:${expiresAt}`)
      .digest('hex');
    const fallbackUrl = `${endpoint.replace(/\/$/, '')}/${r2Key}?expires=${encodeURIComponent(expiresAt)}&sig=${signature}`;

    return {
      provider: 'LOCAL_HMAC_FALLBACK',
      bucketName,
      r2Key,
      uploadUrl: fallbackUrl,
      downloadUrl: fallbackUrl,
      expiresAt,
      contentType: p.contentType,
    };
  }

  private signS3V4Url(p: {
    method: 'PUT' | 'GET';
    host: string;
    bucketName: string;
    objectKey: string;
    accessKeyId: string;
    secretAccessKey: string;
    expiresSeconds: number;
    now: Date;
  }): string {
    const region = 'auto';
    const service = 's3';
    const isoBasic = p.now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = isoBasic.slice(0, 8);
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    const encodedKey = p.objectKey
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    const canonicalUri = `/${encodeURIComponent(p.bucketName)}/${encodedKey}`;

    const queryParams: Array<[string, string]> = [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', `${p.accessKeyId}/${credentialScope}`],
      ['X-Amz-Date', isoBasic],
      ['X-Amz-Expires', String(p.expiresSeconds)],
      ['X-Amz-SignedHeaders', 'host'],
    ];
    queryParams.sort(([a], [b]) => a.localeCompare(b));

    const canonicalQueryString = queryParams
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const canonicalHeaders = `host:${p.host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
      p.method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const hashedCanonicalRequest = createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');
    const stringToSign = ['AWS4-HMAC-SHA256', isoBasic, credentialScope, hashedCanonicalRequest].join('\n');

    const kDate = createHmac('sha256', `AWS4${p.secretAccessKey}`).update(dateStamp, 'utf8').digest();
    const kRegion = createHmac('sha256', kDate).update(region, 'utf8').digest();
    const kService = createHmac('sha256', kRegion).update(service, 'utf8').digest();
    const kSigning = createHmac('sha256', kService).update('aws4_request', 'utf8').digest();
    const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    return `https://${p.host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }
}

