import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { normalizeDatabaseUrl } from './connection.js';

const stage = process.env.SPARKTRACK_STAGE || process.env.NODE_ENV || 'development';
const envFile =
  stage === 'staging'
    ? '.env.staging'
    : stage === 'production'
      ? '.env.production'
      : '.env';

dotenv.config({ path: resolve(process.cwd(), `../../${envFile}`) });
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error(`[migrate:${stage}] DATABASE_URL or DIRECT_DATABASE_URL is required`);
  process.exit(1);
}

const statusOnly = process.argv.includes('--status');

/** Applies *.sql in order, each in its own transaction, tracked in public._sparktrack_migrations. */
async function migrate() {
  const sql = postgres(normalizeDatabaseUrl(url!), { max: 1, onnotice: () => undefined });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public._sparktrack_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        checksum TEXT,
        stage TEXT
      )
    `;
    await sql`ALTER TABLE public._sparktrack_migrations ADD COLUMN IF NOT EXISTS checksum TEXT`;
    await sql`ALTER TABLE public._sparktrack_migrations ADD COLUMN IF NOT EXISTS stage TEXT`;

    const dir = resolve(process.cwd(), 'migrations');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const rows = await sql<{ filename: string; applied_at: Date; stage: string | null }[]>`
      SELECT filename, applied_at, stage FROM public._sparktrack_migrations ORDER BY filename
    `;
    const applied = new Map(rows.map((r) => [r.filename, r]));

    if (statusOnly) {
      console.log(`[migrate:${stage}] Migration status (${applied.size}/${files.length} applied):`);
      for (const f of files) {
        const info = applied.get(f);
        console.log(
          info
            ? `  [APPLIED] ${f} (${info.applied_at.toISOString()}${info.stage ? ` • stage=${info.stage}` : ''})`
            : `  [PENDING] ${f}`,
        );
      }
      return;
    }

    for (const f of files) {
      const content = await readFile(join(dir, f), 'utf-8');
      const checksum = createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
      if (applied.has(f)) {
        console.log(`[migrate:${stage}] skip    ${f}`);
        continue;
      }
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`
          INSERT INTO public._sparktrack_migrations (filename, checksum, stage)
          VALUES (${f}, ${checksum}, ${stage})
        `;
      });
      console.log(`[migrate:${stage}] applied ${f} (sha256:${checksum})`);
    }
  } catch (e) {
    if (statusOnly) {
      const dir = resolve(process.cwd(), 'migrations');
      const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
      console.warn(
        `[migrate:${stage}] Remote database unreachable (${e instanceof Error ? e.message : 'offline'}). Local migration files (${files.length}):`,
      );
      for (const f of files) {
        console.log(`  [LOCAL_SQL] ${f}`);
      }
      return;
    }
    console.error(`[migrate:${stage}] Migration failed:`, e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
void migrate();
