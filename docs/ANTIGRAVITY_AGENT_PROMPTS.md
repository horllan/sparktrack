# GOOGLE ANTIGRAVITY AGENT EXECUTION PROMPTS (VS CODE)

Open the **Antigravity Panel** in VS Code (`Cmd/Ctrl + Shift + P -> Antigravity: Open Agent Manager`), switch to **Planning Mode**, and run these 5 prompts sequentially.

---

## PROMPT 1: Database & Cryptographic Ledger Agent
```text
@workspace Read .antigravity/rules.md, docs/SPARKTRACK_MASTER_BLUEPRINT_V2.md, and packages/db/migrations/*.sql.
1. Initialize `packages/db` with Drizzle ORM, Kysely, and TypeScript configuration.
2. Execute `0001_sparktrack_core_architecture.sql` and `0002_seed_capability_graph.sql` against our Supabase PostgreSQL instance (or local Docker Postgres).
3. Create typed Kysely/Drizzle repository wrappers for:
   - Inserting offline-synced artifacts and sealing them into `evidence.cryptographic_ledger`
   - Querying bitemporal learner snapshots via `intelligence.fn_get_learner_profile_as_of`
   - Traversing `intelligence.graph_nodes` and `intelligence.graph_edges`
4. Write automated tests proving that UPDATE/DELETE on `evidence.cryptographic_ledger` throws a security exception.
```

---

## PROMPT 2: Headless SparkTrack Intelligence Backend Agent
```text
@workspace Read .antigravity/rules.md and docs/SPARKTRACK_MASTER_BLUEPRINT_V2.md.
Scaffold `apps/api-core` using NestJS with the Fastify adapter and Swagger/OpenAPI.
1. Build `src/intelligence-core` containing 6 isolated modules:
   - `EvidenceEngineModule` (idempotent `/v1/evidence/sync` + SHA-256 ledger sealing)
   - `SkillEngineModule` (time-decayed evidence weighting + mentor multiplier formula)
   - `CapabilityGraphModule` (Recursive CTE + pgvector halfvec HNSW similarity)
   - `ProgressEngineModule` (bitemporal `tstzrange` state updates: BEGINNER -> DEVELOPING -> COMPETENT -> ADVANCED)
   - `PathwayEngineModule` (Career & Entrepreneurship pathway affinity calculation + Observed vs. Declared interest divergence detector)
   - `RecommendationEngineModule` (LangGraph.js + Google Gemini synthesis of the 13-part SparkTrack Development Report with the Child-Safety Non-Deterministic Guardrail).
2. Export shared Zod schemas in `packages/contracts`.
```

---

## PROMPT 3: Offline-First PWA & Multi-Portal Frontend Agents (Run in Parallel)
### Agent 3A (Learner Portal & Offline Sync):
```text
@workspace Build `packages/offline-sync` using Dexie.js (IndexedDB) and scaffold `apps/web-platform` (Next.js App Router, Tailwind CSS, Shadcn UI, TanStack Query). Build the Student Portal: Onboarding with Declared Interests capture, Holiday Programme Activity Workspace, Offline-Capable Project & Evidence Uploader (Cloudflare R2 pre-signed URLs + IndexedDB queue), and the Interactive Portfolio.
```

### Agent 3B (Mentor & Admin Portals):
```text
@workspace In `apps/web-platform`, build the Mentor Portal featuring the Assigned Learner Queue and the 3-Minute Mobile-Offline Micro-Rubric & Behavioural Signal Evaluator (`persistence`, `collaboration`, `analytical_thinking`, `creativity`, `problem_solving`). Build the Admin Portal for managing Holiday Cohorts, Partner Schools, and Activities.
```

### Agent 3C (Parent & School Portals + Paystack Billing):
```text
@workspace In `apps/web-platform`, build the Parent Portal featuring SMS/Paystack Verifiable Parental Consent (`PENDING_PARENTAL_CONSENT` -> `VERIFIED_ACTIVE`), Holiday Camp Enrolment checkout, and the interactive 13-part SparkTrack Development Report viewer with Time-Travel comparison. Build the School Portal for cohort capability analytics.
```

---

## PROMPT 4: End-to-End Verification Agent ("13-Year-Old Explorer")
```text
@workspace Invoke the skill `.antigravity/skills/run-13yo-explorer-e2e-test/SKILL.md` to spin up the dev servers and run the full Section 37 end-to-end test in the headless browser. Verify that a 13-year-old who declares "I like design" but excels in Python, Cybersecurity, and Robotics receives a non-deterministic Development Report highlighting analytical strengths and recommending software engineering, cybersecurity, robotics, and technical product design for exploration.
```

---

## PROMPT 5: DevSecOps & Cloud Run / Vercel Deployment Agent
```text
@workspace Create `.github/workflows/ci-cd.yml` for automated linting, typechecking, Zod contract tests, and database migrations. Create a production multi-stage `Dockerfile` for `apps/api-core` optimized for Google Cloud Run (`europe-west1`), and configure `vercel.json` for `apps/web-platform`.
```
