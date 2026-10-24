---
name: add-db-migration
description: Adds a new, forward-only PostgreSQL migration to packages/db/migrations following SparkTrack's SQL AI Developer, RLS and ledger-immutability standards.
---

# Skill: Add DB Migration

1. Create `packages/db/migrations/NNNN_<snake_case>.sql` (next number; never edit an applied migration).
2. Every new table holding learner data MUST: `ENABLE ROW LEVEL SECURITY`, add policies using `core.fn_can_access_learner(learner_id)`, and default any sharing flags to `FALSE`.
3. Never write UPDATE/DELETE/TRUNCATE against `evidence.cryptographic_ledger`.
4. Keep Drizzle (`packages/db/src/schema.ts`) in sync for plain CRUD columns; use Kysely raw SQL for `halfvec`, `tstzrange`, recursive CTEs.
5. Verify: `docker compose up -d postgres` then `pnpm db:migrate` on a fresh volume (`docker compose down -v` first).

