import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UpstashRedisService {
  private readonly logger = new Logger(UpstashRedisService.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private get credentials(): { url: string; token: string } | null {
    const url = this.config.get<string>('UPSTASH_REDIS_REST_URL')?.trim();
    const token = this.config.get<string>('UPSTASH_REDIS_REST_TOKEN')?.trim();
    if (!url || !token || url.includes('your-instance')) return null;
    return { url: url.replace(/\/$/, ''), token };
  }

  isConfigured(): boolean {
    return this.credentials !== null;
  }

  async ping(): Promise<{ status: 'connected' | 'unconfigured' | 'unreachable'; latencyMs?: number }> {
    const creds = this.credentials;
    if (!creds) return { status: 'unconfigured' };
    const start = Date.now();
    try {
      const res = await fetch(`${creds.url}/ping`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${creds.token}` },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return { status: 'unreachable' };
      const body = (await res.json()) as { result?: string };
      return body.result === 'PONG'
        ? { status: 'connected', latencyMs: Date.now() - start }
        : { status: 'unreachable' };
    } catch (err) {
      this.logger.warn(`Upstash ping failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return { status: 'unreachable' };
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const creds = this.credentials;
    if (!creds) return null;
    try {
      const res = await fetch(`${creds.url}/get/${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${creds.token}` },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { result?: string | null };
      if (!data.result) return null;
      return JSON.parse(data.result) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds = 60): Promise<boolean> {
    const creds = this.credentials;
    if (!creds) return false;
    try {
      const serialized = JSON.stringify(value);
      const res = await fetch(`${creds.url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([['SET', key, serialized, 'EX', String(ttlSeconds)]]),
        signal: AbortSignal.timeout(2500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async checkRateLimit(
    bucketKey: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; count: number }> {
    const creds = this.credentials;
    if (!creds) return { allowed: true, count: 1 };
    try {
      const res = await fetch(`${creds.url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', bucketKey],
          ['EXPIRE', bucketKey, String(windowSeconds), 'NX'],
        ]),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return { allowed: true, count: 1 };
      const results = (await res.json()) as Array<{ result?: number }>;
      const count = Number(results?.[0]?.result ?? 1);
      return { allowed: count <= maxRequests, count };
    } catch {
      return { allowed: true, count: 1 };
    }
  }
}

