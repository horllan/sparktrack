import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { normalizeDatabaseUrl } from './connection.js';

dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL or DIRECT_DATABASE_URL is required');
  process.exit(1);
}

/** Applies *.sql in order, each in its own transaction, tracked in public._sparktrack_migrations. */
async function migrate() {
  const sql = postgres(normalizeDatabaseUrl(url!), { max: 1, onnotice: () => undefined });
  try {
    await sql`CREATE TABLE IF NOT EXISTS public._sparktrack_migrations (
      id SERIAL PRIMARY KEY, filename TEXT NOT NULL UNIQUE, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    const dir = resolve(process.cwd(), 'migrations');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const applied = new Set((await sql<{ filename: string }[]>`SELECT filename FROM public._sparktrack_migrations`).map((r) => r.filename));
    for (const f of files) {
      if (applied.has(f)) { console.log(`skip    ${f}`); continue; }
      const content = await readFile(join(dir, f), 'utf-8');
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`INSERT INTO public._sparktrack_migrations (filename) VALUES (${f})`;
      });
      console.log(`applied ${f}`);
    }
  } catch (e) {
    console.error('Migration failed:', e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
void migrate();

