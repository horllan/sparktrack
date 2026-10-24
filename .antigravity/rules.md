# SparkTrack Antigravity Agent Constitution & Workspace Rules

## 1. Architectural Separation (Headless IP Guarantee)
- Strictly maintain separation between `apps/api-core/src/platform-modules` (Learning, Projects, Assessments, Mentorship, Billing) and `apps/api-core/src/intelligence-core` (Headless IP: Evidence Engine, Skill Engine, Capability Graph, Progress Engine, Pathway Engine, Recommendation Engine).
- NEVER import UI, HTTP session state, or portal-specific logic into `intelligence-core`. `intelligence-core` must remain independently licensable via the SparkTrack Intelligence API.

## 2. Database Engineering ("SQL AI Developer" Standard)
- Target Database: PostgreSQL 16/17 (Supabase) with `pgcrypto`, `vector` (`pgvector`), `btree_gist`, and `pg_trgm`.
- Use **Drizzle ORM** for schema definitions and standard CRUD, and **Kysely / Typed SQL** to invoke PostgreSQL stored functions, Recursive CTE graph traversals, `halfvec` HNSW vector similarity searches, and bitemporal `tstzrange` queries.
- **Cryptographic Ledger Immutability:** NEVER generate `UPDATE` or `DELETE` SQL statements against `evidence.cryptographic_ledger`. All evidence verification events are append-only and SHA-256 hash-chained.
- **Bitemporal Progression:** Always query historical or current learner skill states using `intelligence.fn_get_learner_profile_as_of(learner_id, timestamp)` or `WHERE upper_inf(valid_period)`.

## 3. Child Safety, NDPA Compliance & Multi-Tenant Isolation
- Every query touching `core.learner_profiles` or `evidence.artifacts` must enforce Row-Level Security (RLS).
- Verify `consent_status = 'VERIFIED_ACTIVE'` before allowing public portfolio rendering or external API talent discovery.
- `allow_public_portfolio` and `allow_partner_talent_discovery` must default to `FALSE` for all minors (ages 10-17).

## 4. Non-Deterministic AI Philosophy (Exploration Over Assignment)
- Never assign deterministic career labels to minors (e.g., NEVER output "You are going to become a cybersecurity engineer").
- Always frame insights as **Career Exploration** and **Uncertainty Reduction** (e.g., "Your current evidence shows strong and growing signals in analytical problem-solving... Cybersecurity is one pathway worth exploring further").
- Treat behavioural indicators (`persistence`, `collaboration`, `communication`, `creativity`, `analytical_thinking`, `problem_solving`, `initiative`) strictly as evolving developmental signals, never permanent labels.

## 5. Hybrid Offline-First Resilience (African Infrastructure Standard)
- All student project/evidence submission forms and mentor 3-minute micro-rubric forms must write locally to `IndexedDB` (`packages/offline-sync` via `Dexie.js`) first with a client-generated `client_sync_id` UUID, and sync idempotently to NestJS (`/v1/evidence/sync`) and Cloudflare R2 when connectivity is available.
