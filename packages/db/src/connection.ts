import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import * as schema from './schema.js';
import type { SparkTrackDatabase } from './kysely-types.js';

/**
 * Safely encodes raw passwords containing `#`, `@`, or `?` in PostgreSQL connection strings
 * so `new URL()` inside `postgres` / `pg` does not fail with ERR_INVALID_URL.
 */
export function normalizeDatabaseUrl(databaseUrl: string): string {
  const m = databaseUrl.match(/^(postgres(?:ql)?:\/\/)([^/:@]+):(.+)@([^@/?#]+(?::\d+)?\/[^?#]*(?:\?.*)?)$/i);
  if (!m) return databaseUrl;
  const [, scheme, user, rawPass, rest] = m;
  let decoded = rawPass!;
  try { decoded = decodeURIComponent(rawPass!); } catch { /* raw unencoded */ }
  return `${scheme}${user}:${encodeURIComponent(decoded)}@${rest}`;
}

/** Drizzle client (standard CRUD). */
export function createDrizzleClient(databaseUrl: string) {
  // prepare:false is required behind Supabase's PgBouncer transaction pooler (port 6543).
  const client = postgres(normalizeDatabaseUrl(databaseUrl), { max: 10, prepare: false });
  return drizzle(client, { schema });
}
export type DrizzleClient = ReturnType<typeof createDrizzleClient>;

/** Kysely client (CTEs, pgvector, tstzrange, stored functions). */
export function createKyselyClient(databaseUrl: string): Kysely<SparkTrackDatabase> {
  return new Kysely<SparkTrackDatabase>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), max: 10 }) }),
  });
}

