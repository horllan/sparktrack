# SparkTrack Security and Deployment Readiness

**Assessment date:** 2026-10-27
**Scope:** Repository-level review for development/local-build preparation. No deployment was performed. Findings describe repository code/configuration and do not establish that a production service is exposed.

## Executive summary

The current branch is `master` at `280fdd3`. Repository review found two additional high-severity tenant-isolation issues; both are fixed with authorization regression tests. No critical or high dependency advisories are currently reported; one moderate advisory remains in development-only tooling, while the production dependency audit is clean.

Manual Stage 3 (staging) and Stage 4 (production) verification workflows exist, but they do not deploy an application image. The repository does not establish that cloud environments, secrets, approvals, or rollback procedures are configured. Do not treat these workflows as proof of deployment readiness.

During this review, the full test command loaded the repository `.env` and exercised database integration tests plus the AI-backed explorer test. This may have written synthetic test records to the database configured there and made Gemini API requests with synthetic test facts. Credential values were not inspected or printed, and no database cleanup or further live access was attempted. Tests now require an explicit loopback-only `SPARKTRACK_TEST_DATABASE_URL`; the AI-backed test uses a placeholder key. Verify the configured database environment and remove any persisted synthetic test data only after identifying the correct environment.

## Application security findings & remediation status

| #   | Severity | Status | Location                                                                                                      | Finding                                                                                                                                                       | Remediation Implemented                                                                                                                                   |
| --- | -------- | ------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | High     | **Resolved & Tested** | [`auth.module.ts`](../apps/api-core/src/platform-modules/auth/auth.module.ts), [`auth.module.spec.ts`](../apps/api-core/src/platform-modules/auth/auth.module.spec.ts), [`auth/page.tsx`](../apps/web-platform/src/app/auth/page.tsx) | Public registration previously accepted privileged roles (`SCHOOL_ADMIN`, `ORG_PARTNER`, `MENTOR`) without invitation or staff approval. | Restricted `POST /v1/auth/register-role` (`RegisterRoleSchema`) to `role: z.literal('PARENT')` only. Added regression unit test (`auth.module.spec.ts`) and updated `/auth` UI. |
| 2   | High     | **Resolved & Tested** | [`mentorship.module.ts`](../apps/api-core/src/platform-modules/mentorship/mentorship.module.ts), [`queries.ts`](../packages/db/src/queries.ts), [`security.integration.test.ts`](../packages/db/src/security.integration.test.ts) | Mentor queue and artifact verification were not scoped to assigned learners/cohorts or active parental consent. | Scoped `mentorshipQueries.pendingQueue`, `verifyArtifact`, and `assignMentor` to active mentor/cohort/tenant assignments and `consent_status = 'VERIFIED_ACTIVE'`. Verified with `security.integration.test.ts`. |
| 3   | Medium   | **Resolved** | [`learning.module.ts`](../apps/api-core/src/platform-modules/learning/learning.module.ts), [`queries.ts`](../packages/db/src/queries.ts) | Public institutional analytics endpoint returned learner-level talent-pool rows. | Replaced public learner-level talent-pool array with aggregate `optedInLearnerCount` telemetry in `institutionQueries.analyticsSummary`. |
| 4   | Medium   | **Resolved** | [`billing.module.ts`](../apps/api-core/src/platform-modules/billing/billing.module.ts), [`queries.ts`](../packages/db/src/queries.ts) | Caller-controlled learner/provider values could self-activate `FREE_PILOT` or `SCHOLARSHIP` enrolment without ownership/authority checks. | Restricted `EnrolLearnerSchema` to `['PAYSTACK', 'STRIPE', 'INSTITUTIONAL_INVOICE']`, enforced `LearnerAccessService.assertCanAccess`, and initialized enrolments as `PENDING_PAYMENT` until webhook/staff confirmation. |
| 5   | Medium   | **Resolved** | [`support.module.ts`](../apps/api-core/src/platform-modules/support/support.module.ts) | School administrators could read/update global support and DPO privacy tickets across tenants. | Restricted `GET /v1/support/tickets` and `PATCH /v1/support/tickets/:id` to `@Roles('SUPER_ADMIN')`. |
| 6   | High     | **Resolved & Tested** | [`auth-platform.service.ts`](../apps/api-core/src/platform-modules/auth/auth-platform.service.ts), [`auth.module.spec.ts`](../apps/api-core/src/platform-modules/auth/auth.module.spec.ts) | Organization-less `SCHOOL_ADMIN` or `ORG_PARTNER` accounts could list learner PII through the unscoped managed-learner query. | Denied listing without an assigned organization and added regression tests for both roles. |
| 7   | High     | **Resolved & Tested** | [`learning.module.ts`](../apps/api-core/src/platform-modules/learning/learning.module.ts), [`learning.module.spec.ts`](../apps/api-core/src/platform-modules/learning/learning.module.spec.ts) | School administrators could invoke a global learner-level materialized-summary refresh endpoint. | Restricted the route to `SUPER_ADMIN` and added a route-role regression test. |

Severity reflects the reviewed code paths and their potential impact; it is not a claim that the paths have been exploited.

## Dependency audit (Remediated)

`pnpm audit --audit-level=high` initially reported 3 critical and 27 high advisories. Direct dependencies (`next`, `@nestjs/*`, `vitest`, `eslint-config-next`, etc.) and targeted `pnpm.overrides` (`fastify`, `glob`, `js-yaml`, `lodash`, `picomatch`, `postcss`, `webpack`) were upgraded in `package.json` and `pnpm-lock.yaml`.

**Current `pnpm audit --audit-level=high` status:**
- **0 critical advisories**
- **0 high advisories**
- **1 moderate advisory** in development-only `ajv`/ESLint tooling (`pnpm audit --audit-level=high` exits `0`)
- `pnpm audit --prod --audit-level=moderate` — **no production dependency advisories**

## CI/CD and environment assessment

- CI validates quality and builds the API container without publishing it. Manual Stage 3 and Stage 4 workflows run checks, optional database migrations, and optional health checks; they do not deploy application images.
- CI runs on pushes and pull requests for `main`, `master`, and `develop`. Stage workflows are manual and depend on externally configured GitHub environments, secrets, and variables.
- No repository evidence establishes provisioned test/dev/staging/production environments, branch protections, hosted secrets, deployment approvals, or rollback/restore capability.
- Local [`docker-compose.yml`](../docker-compose.yml) publishes database/cache ports, uses a fixed development database password, and starts Redis without authentication. Treat it as local-only; do not reuse it for shared or live infrastructure.
- The API Docker build originally lacked an explicit pnpm global-bin directory setup and had no Docker context ignore file. The build context could include ignored environment files because `.gitignore` does not exclude files from Docker contexts.
- RLS is enabled on selected tables, but should not be assumed to be the only tenant boundary. Validate policies using the least-privileged runtime database role and ensure application query paths establish the intended user context.
- Live Supabase, Vercel, Cloud Run, payment, Redis, storage, and webhook configuration was not inspected. Their security posture remains unknown.
- Database integration tests now require an explicit local `SPARKTRACK_TEST_DATABASE_URL`; CI points this at its disposable Postgres service. The explorer test supplies a placeholder Gemini key to prevent external API requests.

## Changes made during this session

1. Updated [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):
   - Added `master` to push and pull-request branch filters.
   - Set workflow permissions to `contents: read`.
   - Added monorepo build and dependency audit checks.
   - Added an API container-build validation job. It builds locally in CI and does **not** publish or deploy an image.
2. Added [`.dockerignore`](../.dockerignore) to exclude environment files, VCS metadata, dependencies, and generated outputs from Docker build contexts.
3. Updated [`apps/api-core/Dockerfile`](../apps/api-core/Dockerfile) to configure `PNPM_HOME` and pnpm's global binary directory, fixing the observed `ERR_PNPM_NO_GLOBAL_BIN_DIR` container-build failure.
4. Updated [`README.md`](../README.md) with the current CI/deployment-stage status and safety requirements.
5. Fixed findings 6 and 7: organization-less institutional roles can no longer list learner records, and global learner-summary refresh is restricted to super administrators.
6. Changed database integration tests to require the explicit local test database URL rather than loading `.env`; CI passes its disposable Postgres URL. The explorer test uses a placeholder Gemini key.

### Validation from the initial assessment (2026-10-25)

- `pnpm lint` — **passed** (6/6 packages, 0 warnings, 0 errors).
- `pnpm typecheck` — **passed** (10/10 tasks).
- `pnpm test` — **passed** (33 tests across 13 test files, including `auth.module.spec.ts` and `security.integration.test.ts`).
- `pnpm build` — **passed**.
- `pnpm audit --audit-level=high` — **passed** (0 critical, 0 high advisories; exits `0`).
- `docker buildx build --file apps/api-core/Dockerfile --tag sparktrack-api:ci --load .` — **passed** after the Dockerfile fix. No registry push or deployment occurred.
- `git diff --check` — **passed**.

These checks verify local build/workflow configuration only. They do not validate hosted GitHub Actions, production identity/configuration, live database policies, external integrations, or deployed runtime behavior.

### Current reassessment validation (2026-10-27)

- `pnpm lint` — **passed**.
- `pnpm typecheck` — **passed**.
- `pnpm test` with database and AI credentials removed — **passed**; database integration and explorer E2E tests were skipped without the explicit local test URL.
- API authorization regression tests — **passed** (5 tests).
- API package build and isolated offline-sync package build — **passed**.
- `pnpm audit --audit-level=high` — **passed**, with one moderate development-only advisory.
- `pnpm audit --prod --audit-level=moderate` — **passed**, no production advisories.
- Full monorepo build — **not completed**; the local Node 24/Turbo build hit a process memory allocation failure on the offline-sync task. The web build compiled, but the overall build was stopped while its later checks were still running.
- No migration, live database query, deployment, or container build was performed after the initial test side effect described above.

## Recommended next actions

Work in this order; keep production out of scope until release gates pass:

1. **Verify the database used by the test run.** Confirm it was a disposable non-production database and safely remove the synthetic test fixtures if needed. No cleanup was attempted because the configured target was not inspected.
2. **Provision and document isolated dev/staging resources.** Use separate databases, credentials, cache/storage, and sandbox integrations. Use synthetic or anonymized learner data.
3. **Validate DB authorization in CI.** Confirm the runtime role is least-privileged and run the integration security tests against the isolated CI database.
4. **Complete release gates.** Make migrations and required health checks mandatory for a successful stage gate; validate GitHub environment approvals, backups, restore, monitoring, and rollback.
5. **Review the remaining moderate development-tool advisory** and upgrade safely if a compatible fix is available.
6. **Only then consider production.** Promote the same immutable build after staging sign-off and named human approval. Production deployment was not authorized or attempted in this review.

## Handoff for a follow-up agent

Begin by reading this report and checking the current worktree. Do not repeat the audit or discard existing changes. First confirm the database environment used by the earlier test run before considering any cleanup. The additional access-control findings are fixed in the current worktree. Do not provision or deploy a cloud environment until the owner confirms the hosting target and supplies isolated non-production resources and secrets. Never use production learner data for development or staging.
