# SparkTrack: Project Workflow, Health Review, and Redesign Recommendations

**Review date:** 2026-10-24  
**Review scope:** Repository architecture, learner and guardian workflows, API access boundaries, persistence and offline sync, automated checks, and current web experience.

## Executive summary

SparkTrack has a credible vertical-slice foundation: Supabase-backed authentication, learner onboarding, guardian consent challenges, evidence capture, an append-only ledger, skill and pathway calculations, time-travel progression, and report generation are represented in code. The monorepo is structured around those domain boundaries, and the test suite exercises several of the core behaviors.

It is **not yet safe to conclude that everything is working properly or that the system is ready for a real pilot**. Build, type checking, and tests passed locally, but lint fails and there are important authorization and consent-enforcement gaps in API endpoints. Some integrations described in the blueprint are only partially wired, and there is no end-to-end web UI test suite.

### Validation results

| Check | Result | Notes |
|---|---|---|
| `pnpm test` | Pass | 30 tests across API, DB, contracts, and offline sync. PostgreSQL consent and ledger integration tests passed. |
| `pnpm typecheck` | Pass | All 10 Turbo tasks passed. |
| `pnpm build` | Pass | API, packages, and Next.js production build completed. |
| `pnpm lint` | Fail | 28 errors: 27 API import-style errors and one UI empty-interface error; offline-sync also reports six warnings. |
| Web UI tests | Not configured | The web workspace has no test script or browser/e2e suite. |

The report-generation test ran without a configured Gemini key and exercised the deterministic fallback rather than proving a live Gemini integration. A successful build does not validate production credentials, deployed database policies, SMS delivery, payments, or object-storage uploads.

## Current architecture

- **Web:** Next.js App Router and React PWA in [`apps/web-platform`](../apps/web-platform). It provides the home page and separate student, parent, mentor, school, and admin routes.
- **API:** NestJS with Fastify in [`apps/api-core`](../apps/api-core). `platform-modules` cover auth, learning, mentorship, and billing; `intelligence-core` covers evidence, skills, graph, progress, pathways, reports, and the BullMQ worker.
- **Shared contracts:** Zod schemas in [`packages/contracts`](../packages/contracts).
- **Database:** PostgreSQL migrations and query helpers in [`packages/db`](../packages/db), using Kysely and Drizzle clients. Migrations create the graph, consent controls, RLS policies, and immutable evidence ledger.
- **Offline queue:** Dexie/IndexedDB persistence and a retry-capable sync engine in [`packages/offline-sync`](../packages/offline-sync).
- **Shared UI:** Reusable primitives in [`packages/ui`](../packages/ui).
- **Local services:** PostgreSQL 17 with pgvector and Redis are defined in [`docker-compose.yml`](../docker-compose.yml).

The implementation is narrower than the complete product blueprint. Some areas have functional foundations, while production operations such as live payment checkout, a proper R2 upload flow, complete role administration, and reliable background sync remain incomplete or require verification.

## End-to-end project workflow

### 1. Local setup

1. Install the repository's pinned package manager and dependencies: `pnpm install`.
2. Start local infrastructure with `docker compose up -d` (PostgreSQL and Redis).
3. Configure the variables in [`.env.example`](../.env.example) in the root `.env`. The web app also reads its local Supabase settings from `apps/web-platform/.env.local`.
4. Apply schema changes with `pnpm db:migrate`; load graph/demo data with `pnpm db:seed` where appropriate.
5. Start the monorepo with `pnpm dev`. The web app is on port 3000 and the API is on port 4000; API documentation is exposed at `/docs`.

The exact production URLs, database roles, secrets, and provider setup must be provisioned separately. Never use the development-only values from Compose as production credentials.

### 2. Learner identity and onboarding

1. The learner signs up or signs in using Supabase Auth on the student onboarding route.
2. The web app sends the Supabase access token to the API.
3. The global API guard verifies the JWT and resolves the user's role from `core.users`. A learner can provision a profile through the onboarding endpoint.
4. The onboarding API saves the learner profile and guardian contact data.

### 3. Guardian consent

1. The learner requests consent. The API creates a short-lived challenge, hashes the six-digit code with `CONSENT_OTP_SECRET`, and sends it by Termii SMS.
2. The guardian opens the consent page, supplies the code, and chooses whether to grant consent and the optional public-portfolio/partner-discovery permissions.
3. The API verifies and consumes the challenge, recording the guardian's decision and optional grants.
4. Evidence ingestion checks for verified consent before writing learner evidence.

The intended flow is sensible, but the separate consent-preferences update endpoint currently allows bypassing this verification step; see the findings below.

### 4. Learning evidence and offline queue

1. A learner selects an artifact type, title, description/URL, and skill codes in the student dashboard.
2. The browser writes the artifact to IndexedDB using a client-generated idempotency key.
3. The sync engine posts queued items to `/api/v1/evidence/sync` with the current Supabase token.
4. The API checks learner access and consent, validates the shared Zod payload, and delegates to the database ledger query.
5. New evidence is sealed into the SHA-256 chain. A retry with the same client sync ID is intended to be idempotent.
6. Skill scores are recomputed inline, then a BullMQ event is enqueued to repeat/reconcile the computation asynchronously.
7. The progress engine records changed skill states in the bitemporal progression table.

The queue persists failed items and computes a retry delay, but the service worker does not run Background Sync and the browser does not automatically re-run the queue when connectivity returns. The current UX can also say an item was synced when it was not.

### 5. Mentor review

1. A mentor reviews unverified evidence and submits a micro-rubric.
2. Rubric submission creates a new sealed mentor-observation artifact and stores the rubric signals.
3. Skill and progression data are recomputed.

The current review queue endpoint is public, and the assignment and verification routes do not enforce mentor/admin role and assignment checks.

### 6. Skill, pathway, and report views

1. Skill scores are computed from evidence and mentor signals.
2. Pathway affinities are calculated from the capability graph and learner evidence/interests; they are presented as exploration signals.
3. A parent/authorized user may request the latest report or generate a new one.
4. Report generation sends minimized aggregates to Gemini, checks the generated text against child-safety guardrails, and falls back to deterministic template text if generation fails or fails the guardrail.
5. Reports are persisted with a snapshot timestamp and model identifier.

### 7. Parent, school, and operations workflows

- The parent route provides consent preferences, report generation, and historical progression queries.
- The school route reads institutional analytics.
- The admin route can create organisations and cohorts, enrol learners, and assign mentors.
- Paystack and Stripe webhook routes attempt to confirm a payment against a reference.

The user interfaces exist, but a number of these API operations currently lack role-level authorization. The UI itself does not replace server-side access control.

## Review findings and recommended action

Priorities below indicate what should be resolved before a real learner-data pilot. These are code-review findings, not a formal compliance determination.

| Priority | Finding | Evidence and impact | Recommended action |
|---|---|---|---|
| **Blocker** | Consent status can be set to verified without SMS challenge completion. | The authenticated `PATCH /v1/auth/consent/preferences/:learnerId` calls `assertCanAccess`, then accepts `VERIFIED_ACTIVE`; the database update writes that status directly. A related user can therefore bypass the challenge flow and enable evidence processing or optional discovery. See [`auth-platform.service.ts`](../apps/api-core/src/platform-modules/auth/auth-platform.service.ts) and [`queries.ts`](../packages/db/src/queries.ts). | Make challenge verification the only path that activates consent. Separate revocation/preference changes from consent-state transitions, restrict those changes to the verified guardian, and test that learners/mentors cannot activate consent or grants. |
| **Blocker** | Sensitive mentor and institution endpoints are public. | `GET /v1/mentorship/queue` returns learner names, IDs, education stage, artifact titles/descriptions, and skills. Public institution analytics includes an opted-in talent pool with learner-level details, and public `POST /institutions/refresh-summary` returns learner data. See [`mentorship.module.ts`](../apps/api-core/src/platform-modules/mentorship/mentorship.module.ts), [`learning.module.ts`](../apps/api-core/src/platform-modules/learning/learning.module.ts), and [`queries.ts`](../packages/db/src/queries.ts). | Remove public access. Require the appropriate mentor or partner role, enforce cohort/organisation membership, and return learner-level discovery data only to explicitly authorized partners. Keep only deliberately public, aggregate data unauthenticated. |
| **Blocker** | Role-sensitive writes accept any authenticated account. | Cohort creation, enrolment, organisation creation, mentor assignment, and artifact verification require authentication but do not declare role checks. Artifact verification also lacks a check that the requester is an assigned mentor. The global guard authenticates callers, but authenticated does not mean authorized for these operations. | Add explicit roles and object-level authorization to every write endpoint. Verify mentor assignment/cohort relationship and enforce admin/organisation ownership on operational endpoints. Add negative tests for each role. |
| **High** | Consent preferences are publicly readable by learner UUID. | `GET /v1/auth/consent/preferences/:learnerId` is marked public and returns consent state and privacy grants. UUIDs are not an access-control mechanism. | Require guardian/learner authorization as appropriate; expose only the minimum status needed for a consent link, and avoid returning privacy flags to anonymous callers. |
| **High** | Payment webhook verification uses reserialized JSON rather than the raw request body. | Both webhook handlers call `JSON.stringify(body)` before verifying signatures. Provider signatures are calculated over the exact raw payload bytes; parser reserialization can reject valid deliveries. Stripe signature timestamp freshness is also not checked. See [`billing.module.ts`](../apps/api-core/src/platform-modules/billing/billing.module.ts). | Preserve raw request bytes in Fastify/Nest and verify against them; use provider-supported verification, including Stripe timestamp tolerance and idempotency. Add integration tests with provider-generated payload/signature fixtures. |
| **High** | R2 upload endpoint is not a production presigned upload implementation. | The API creates a custom HMAC URL and falls back to the hard-coded `dev-r2-signing-key`; the student evidence UI currently submits empty `storageR2Keys`. A custom query signature is not by itself an R2/S3-compatible presigned upload URL. See [`learning.module.ts`](../apps/api-core/src/platform-modules/learning/learning.module.ts) and [`student/dashboard/page.tsx`](../apps/web-platform/src/app/(student)/student/dashboard/page.tsx). | Use the R2 S3-compatible presigner or a secured upload service, fail closed if credentials are absent, bind content type/size/expiry, and complete a browser upload-to-evidence end-to-end test. |
| **High** | Evidence UI can show a false synced-success message. | `SyncEngine.syncAll()` returns normally when no access token is available and marks HTTP/network failures as queued failures rather than rejecting. The student UI then clears its form and announces that evidence was synced. Data remains in IndexedDB, but the user is told the server/ledger has it when that may not be true. See [`sync-engine.ts`](../packages/offline-sync/src/sync-engine.ts) and [`student/dashboard/page.tsx`](../apps/web-platform/src/app/(student)/student/dashboard/page.tsx). | Return a structured sync result; only announce server confirmation when the API acknowledges it. Keep a clear pending/failed state and actionable retry control. Trigger a sync on reconnection and consider Background Sync where supported. |
| **Medium** | Health endpoint reports `status: "ok"` even when ledger integrity is false. | The health handler returns a boolean `ledgerIntegrityValid` but sets status to `"ok"` unconditionally. Monitoring may treat a broken chain as healthy. See [`auth.module.ts`](../apps/api-core/src/platform-modules/auth/auth.module.ts). | Set an unhealthy status/HTTP code when DB or ledger verification fails, or split liveness from readiness and integrity diagnostics. |
| **Medium** | Automated checks do not cover the web experience or most API boundaries. | There is no web test script. Current API tests cover selected pure functions and one full intelligence pipeline, but there are no broad route authorization tests for the findings above. | Add API integration tests for role/ownership/consent access and browser tests for onboarding, consent, evidence queue states, and report viewing. Make lint clean in CI. |
| **Medium** | Workspace-root inference is environment-dependent. | Next.js build and lint selected `C:\\Users\\makan\\package-lock.json` as the workspace root and warned that the root might be wrong; it also detected the repository's pnpm lockfile. This may affect tracing in other environments. | Pin the Next.js tracing root to the repository and remove/resolve only unintended lockfiles in the actual environment. Do not remove files outside this repository without confirming ownership. |

### Lint details

`pnpm lint` currently fails with 27 `@typescript-eslint/consistent-type-imports` errors in the API and one `@typescript-eslint/no-empty-object-type` error in the shared UI package. Offline sync also has six lint warnings. These appear to be style/type-import issues rather than runtime failures, but they block a clean CI quality gate.

## Redesign recommendations

### Product and information architecture

1. **Make the experience role-first.** Replace the current global list of every portal with a sign-in/onboarding entry and role-specific navigation. Learners should not see school/admin controls; guardians, mentors, and institutional users should get their own clear destinations.
2. **Design around the learning loop, not internal engines.** The learner home should emphasize “continue an activity,” “add evidence,” and “see what changed.” Keep hashes, ledger sequence numbers, model names, and other technical concepts in a details/audit view.
3. **Give each audience a focused home.**
   - **Learner:** next activity, evidence drafts, verified evidence, skill growth over time, and exploration ideas.
   - **Parent/guardian:** consent status and controls first, then evidence-backed progress and report history.
   - **Mentor:** assigned cohort queue, review rubric, and follow-up actions.
   - **School/partner:** cohort-level summaries by default; learner-level discovery only when role, consent, and partnership allow it.
   - **Operations:** cohort, enrolment, payment, and assignment workflows with validation and audit history.
4. **Design explicit states.** Distinguish draft, pending upload, queued offline, syncing, synced/confirmed, needs attention, and rejected. Do not collapse local persistence into server confirmation.
5. **Keep AI and pathway language exploratory.** Show the evidence behind a signal, how much evidence supports it, and what is uncertain. Avoid presenting an affinity score as a career prediction or fixed identity.

### Visual direction

- Use a warm, confident, contemporary visual language appropriate to young people and families: approachable without looking childish or like a generic school admin template.
- Keep SparkTrack amber as an accent, not the only visual hierarchy. Add a calm dark ink, accessible neutral surfaces, and restrained complementary colors for status and data visualization.
- Define design tokens for typography, spacing, radii, elevation, borders, focus rings, and semantic status colors. Apply the tokens across the shared UI package before rebuilding individual pages.
- Give dashboards a stronger page hierarchy: page title and context, one primary action, concise summary, then progressive disclosure for detailed data.
- Use charts only when they explain change over time; pair each with labels and a plain-language summary. Provide evidence drill-downs rather than decorative metrics.

### Accessibility, mobile, and low-bandwidth use

- Use mobile-first layouts and large, touch-friendly actions; prioritize the student evidence workflow for small screens.
- Verify WCAG AA contrast, keyboard access, visible focus, semantic labels, screen-reader announcements, and reduced-motion behavior.
- Avoid relying on color or emoji alone for status.
- Make offline status specific to each queued item and explain whether work is saved locally or confirmed by the server.
- Keep pages resilient to slow API responses: skeleton/loading states, retry paths, concise error messages, and minimized payloads.

### Suggested redesign sequence

1. **Trust and correctness first:** close the consent and authorization gaps, protect learner-level endpoints, fix webhook raw-body verification, and make sync feedback truthful.
2. **Discovery and prototype:** map the five role journeys, validate navigation and language with representative users, and prototype the learner and guardian flows before rebuilding all portals.
3. **Design system foundation:** establish tokens, accessible UI primitives, responsive navigation, forms, empty/loading/error states, and chart patterns in `packages/ui`.
4. **Rebuild the highest-value vertical slice:** learner home → activity/evidence → offline/synced states → progress view; then guardian consent/report and mentor review.
5. **Extend by role:** school/partner analytics and operations after role boundaries and data visibility have been verified.
6. **Usability and regression validation:** test realistic tasks on mobile and low-bandwidth connections, run accessibility checks, and add browser tests for role-specific journeys.

## Overall assessment

The domain model and vertical-slice concepts are promising, and the automated build/type/test baseline is functional. Treat the current code as a **working prototype, not a production-ready child-data platform**. Resolve the blocker findings and provider integration gaps before collecting real learner evidence; then redesign around clear role-specific journeys and trustworthy evidence/sync states.
