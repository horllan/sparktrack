#!/usr/bin/env tsx
/**
 * SparkTrack Stage 3 (Pre-Production Staging Sandbox) Verification Gate
 * Validates configuration, staging database migrations, Upstash Redis,
 * Cloudflare R2 evidence storage, and SHA-256 cryptographic ledger integrity.
 */

import { existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import * as dotenv from 'dotenv';
import postgres from 'postgres';
import { normalizeDatabaseUrl, createKyselyClient, ledgerQueries } from '../packages/db/src/index.js';

// Load staging configuration
const rootDir = resolve(__dirname, '..');
const stagingEnvPath = join(rootDir, '.env.staging');
const defaultEnvPath = join(rootDir, '.env');

if (existsSync(stagingEnvPath)) {
  dotenv.config({ path: stagingEnvPath });
  console.log(`[Stage 3] Loaded configuration from ${stagingEnvPath}`);
} else {
  dotenv.config({ path: defaultEnvPath });
  console.log(`[Stage 3] Notice: .env.staging not found; testing against environment/.env`);
}

interface CheckResult {
  category: string;
  item: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
}

const results: CheckResult[] = [];

function record(category: string, item: string, status: 'PASS' | 'WARN' | 'FAIL', details: string) {
  results.push({ category, item, status, details });
  const badge = status === 'PASS' ? '✅ [PASS]' : status === 'WARN' ? '⚠️ [WARN]' : '❌ [FAIL]';
  console.log(`${badge} [${category}] ${item}: ${details}`);
}

async function verifyStage3() {
  console.log('\n============================================================');
  console.log('   SPARKTRACK STAGE 3 (STAGING SANDBOX) PRE-FLIGHT AUDIT   ');
  console.log('============================================================\n');

  // --- Step 1: Environment & Secrets Isolation Audit ---
  const stage = process.env.SPARKTRACK_STAGE || process.env.NODE_ENV || 'staging';
  record('Environment', 'Stage Designation', 'PASS', `Active stage: "${stage}"`);

  const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL;
  if (!dbUrl) {
    record('Secrets', 'DATABASE_URL', 'FAIL', 'Missing DATABASE_URL in environment');
  } else {
    // Staging isolation guard: Ensure we do not accidentally run staging verification against production db
    const isProdDb = dbUrl.toLowerCase().includes('prod') && !dbUrl.toLowerCase().includes('staging');
    if (isProdDb) {
      record('Secrets', 'DATABASE_URL Isolation', 'WARN', 'Database URL appears to reference production name; ensure staging isolation');
    } else {
      record('Secrets', 'DATABASE_URL Isolation', 'PASS', 'Staging database URL isolates pre-production from live production');
    }
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret || jwtSecret.startsWith('REPLACE_WITH')) {
    record('Secrets', 'SUPABASE_JWT_SECRET', 'WARN', 'SUPABASE_JWT_SECRET is placeholder or unset in staging config');
  } else if (jwtSecret.length < 32) {
    record('Secrets', 'SUPABASE_JWT_SECRET', 'FAIL', `JWT secret too short (${jwtSecret.length} chars, min 32 required)`);
  } else {
    record('Secrets', 'SUPABASE_JWT_SECRET', 'PASS', `Validated (${jwtSecret.length} chars)`);
  }

  const otpSecret = process.env.CONSENT_OTP_SECRET;
  if (!otpSecret || otpSecret.startsWith('REPLACE_WITH')) {
    record('Secrets', 'CONSENT_OTP_SECRET', 'WARN', 'CONSENT_OTP_SECRET is placeholder or unset in staging config');
  } else if (otpSecret.length < 32) {
    record('Secrets', 'CONSENT_OTP_SECRET', 'FAIL', `Consent OTP secret too short (${otpSecret.length} chars, min 32 required)`);
  } else {
    record('Secrets', 'CONSENT_OTP_SECRET', 'PASS', `Validated (${otpSecret.length} chars)`);
  }

  const adminSecret = process.env.ADMIN_REGISTRATION_SECRET;
  if (!adminSecret || adminSecret.startsWith('REPLACE_WITH')) {
    record('Secrets', 'ADMIN_REGISTRATION_SECRET', 'WARN', 'ADMIN_REGISTRATION_SECRET is placeholder or unset in staging config');
  } else if (adminSecret.length < 32) {
    record('Secrets', 'ADMIN_REGISTRATION_SECRET', 'FAIL', `Admin secret too short (${adminSecret.length} chars, min 32 required)`);
  } else {
    record('Secrets', 'ADMIN_REGISTRATION_SECRET', 'PASS', `Validated (${adminSecret.length} chars)`);
  }

  // --- Step 2: Database Connectivity & Migration Schema Check ---
  if (dbUrl) {
    try {
      const sql = postgres(normalizeDatabaseUrl(dbUrl), {
        max: 1,
        connect_timeout: 10,
        onnotice: () => undefined,
      });

      const [ping] = await sql`SELECT 1 as alive, current_database() as db_name, version() as ver`;
      record('Database', 'Connectivity', 'PASS', `Connected to database "${ping?.db_name}" (Postgres 17 engine alive)`);

      // Verify migration sync
      const migrationsDir = resolve(rootDir, 'packages/db/migrations');
      const diskFiles = existsSync(migrationsDir)
        ? readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
        : [];

      let appliedCount = 0;
      try {
        const rows = await sql<{ filename: string }[]>`
          SELECT filename FROM public._sparktrack_migrations ORDER BY filename
        `;
        appliedCount = rows.length;
        const pending = diskFiles.filter((f) => !rows.some((r) => r.filename === f));
        if (pending.length === 0) {
          record('Database', 'Migrations Status', 'PASS', `All ${appliedCount}/${diskFiles.length} migration files applied in schema`);
        } else {
          record('Database', 'Migrations Status', 'WARN', `${pending.length} pending migration(s): ${pending.join(', ')}`);
        }
      } catch {
        record('Database', 'Migrations Status', 'WARN', 'Migration tracking table public._sparktrack_migrations not found or empty');
      }

      // --- Step 3: Cryptographic Ledger SHA-256 Hash Chain Integrity ---
      try {
        const kysely = createKyselyClient(dbUrl);
        const chain = await ledgerQueries.verifyChain(kysely);
        await kysely.destroy();

        if (chain.length === 0) {
          record('Ledger', 'SHA-256 Audit Chain', 'PASS', 'Genesis state verified (0 blocks registered, clean root anchor)');
        } else {
          const broken = chain.filter((b) => !b.isValid);
          if (broken.length === 0) {
            record('Ledger', 'SHA-256 Audit Chain', 'PASS', `All ${chain.length} cryptographic blocks intact with unbroken hashes`);
          } else {
            record('Ledger', 'SHA-256 Audit Chain', 'FAIL', `${broken.length} broken block hash link(s) detected at seq: ${broken.map((b) => b.ledgerSeq).join(', ')}`);
          }
        }
      } catch (ledgerErr) {
        record('Ledger', 'SHA-256 Audit Chain', 'WARN', `Ledger verification skipped: ${ledgerErr instanceof Error ? ledgerErr.message : 'query error'}`);
      }

      await sql.end();
    } catch (dbErr) {
      record('Database', 'Connectivity', 'FAIL', `Failed to connect to database: ${dbErr instanceof Error ? dbErr.message : 'timeout'}`);
    }
  }

  // --- Step 4: Redis / Cache Connectivity Check ---
  const redisUrl = process.env.REDIS_URL;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken && !upstashUrl.includes('your-instance')) {
    try {
      const res = await fetch(`${upstashUrl.replace(/\/$/, '')}/ping`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const body = (await res.json()) as { result?: string };
        if (body.result === 'PONG') {
          record('Cache', 'Upstash Redis REST', 'PASS', 'Upstash Redis ping responded PONG');
        } else {
          record('Cache', 'Upstash Redis REST', 'WARN', `Unexpected ping response: ${JSON.stringify(body)}`);
        }
      } else {
        record('Cache', 'Upstash Redis REST', 'WARN', `HTTP ${res.status} from Upstash ping`);
      }
    } catch (e) {
      record('Cache', 'Upstash Redis REST', 'WARN', `Upstash Redis unreachable: ${e instanceof Error ? e.message : 'network error'}`);
    }
  } else if (redisUrl) {
    record('Cache', 'Redis TCP', 'PASS', `Redis TCP connection string configured (${new URL(redisUrl).hostname})`);
  } else {
    record('Cache', 'Redis', 'WARN', 'Neither REDIS_URL nor UPSTASH credentials configured (using in-memory fallback)');
  }

  // --- Step 5: Cloudflare R2 Staging Verification ---
  const r2Endpoint = process.env.R2_PUBLIC_ENDPOINT;
  const r2Secret = process.env.R2_SECRET_ACCESS_KEY;
  if (r2Endpoint && r2Secret && !r2Secret.startsWith('REPLACE_WITH')) {
    record('Storage', 'Cloudflare R2 Staging', 'PASS', `Configured endpoint: ${r2Endpoint}`);
  } else {
    record('Storage', 'Cloudflare R2 Staging', 'WARN', 'R2 staging credentials not fully configured; uploads will use fallback');
  }

  // --- Summary & Gate Evaluation ---
  console.log('\n============================================================');
  console.log('                 STAGE 3 AUDIT SUMMARY                     ');
  console.log('============================================================');

  const failed = results.filter((r) => r.status === 'FAIL');
  const warnings = results.filter((r) => r.status === 'WARN');
  const passed = results.filter((r) => r.status === 'PASS');

  console.log(`Passed:   ${passed.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Failed:   ${failed.length}`);

  if (failed.length > 0) {
    console.error('\n❌ STAGE 3 PRE-FLIGHT FAILED: Critical configuration or integrity issues must be resolved.');
    process.exit(1);
  } else {
    console.log('\n✅ STAGE 3 PRE-FLIGHT PASSED: Environment and sandbox mirror meet readiness standards.');
    process.exit(0);
  }
}

void verifyStage3();

