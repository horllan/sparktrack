import type { Mock } from 'vitest';
import type { Db } from '@sparktrack/db';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HealthController } from './health.controller';
import type { ConfigService } from '@nestjs/config';
import type { UpstashRedisService } from '../cache/upstash-redis.service';

vi.mock('@sparktrack/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sparktrack/db')>();
  return {
    ...actual,
    ledgerQueries: {
      verifyChain: vi.fn(),
    },
  };
});

describe('HealthController', () => {
  let controller: HealthController;
  let mockDb: unknown;
  let mockRedis: Partial<UpstashRedisService>;
  let mockConfig: Partial<ConfigService>;
  let verifyChainMock: Mock;

  beforeEach(async () => {
    const dbModule = await import('@sparktrack/db');
    verifyChainMock = vi.mocked(dbModule.ledgerQueries.verifyChain) as unknown as Mock;
    verifyChainMock.mockReset();

    mockDb = {};
    mockRedis = {
      ping: vi.fn().mockResolvedValue({ status: 'connected', latencyMs: 12 }),
    };
    mockConfig = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'SPARKTRACK_STAGE') return 'staging';
        if (key === 'NODE_ENV') return 'staging';
        return undefined;
      }),
    };

    controller = new HealthController(
      mockDb as Db,
      mockRedis as UpstashRedisService,
      mockConfig as ConfigService,
    );
  });

  it('reports healthy status and ledgerIntegrityValid: true when chain is verified', async () => {
    verifyChainMock.mockResolvedValueOnce([
      { ledgerSeq: 1, isValid: true },
      { ledgerSeq: 2, isValid: true },
    ]);

    const res = await controller.checkHealth();
    expect(res.stage).toBe('staging');
    expect(res.database).toBe('connected');
    expect(res.redis).toBe('connected');
    expect(res.ledgerIntegrityValid).toBe(true);
    expect(res.ledgerBlockCount).toBe(2);
    expect(res.status).toBe('ok');
  });

  it('reports degraded status and ledgerIntegrityValid: false when chain has invalid block', async () => {
    verifyChainMock.mockResolvedValueOnce([
      { ledgerSeq: 1, isValid: true },
      { ledgerSeq: 2, isValid: false },
    ]);

    const res = await controller.checkHealth();
    expect(res.ledgerIntegrityValid).toBe(false);
    expect(res.ledgerBlockCount).toBe(2);
    expect(res.status).toBe('degraded');
  });

  it('reports ledgerIntegrityValid: true for genesis state (0 blocks)', async () => {
    verifyChainMock.mockResolvedValueOnce([]);

    const res = await controller.checkHealth();
    expect(res.ledgerIntegrityValid).toBe(true);
    expect(res.ledgerBlockCount).toBe(0);
    expect(res.status).toBe('ok');
  });

  it('provides detailed ledger audit chain in auditLedger()', async () => {
    verifyChainMock.mockResolvedValueOnce([
      { ledgerSeq: 1, isValid: true },
    ]);

    const audit = await controller.auditLedger();
    expect(audit.ledgerIntegrityValid).toBe(true);
    expect(audit.totalBlocks).toBe(1);
    expect(audit.blocks).toHaveLength(1);
  });
});

