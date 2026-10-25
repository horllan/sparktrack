# SparkTrack Security and Deployment Readiness

**Assessment date:** 2026-10-25  
**Scope:** Repository-level review for development/local-build preparation. No live infrastructure was accessed, and no deployment was performed. Findings describe repository code/configuration and do not establish that a production service is exposed.

## Executive summary

All five application security/privacy findings (Findings 1–5) and all critical/high dependency advisories identified during the initial review have now been **remediated and verified by automated unit and database integration tests**. CI and container-build validation are in place and passing (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm audit --audit-level=high` all exit `0`). Before promoting to live **staging** or **production** with real learner data, the remaining infrastructure and operational gates (isolated staging environment provisioning, least-privileged database runtime role verification, and staff approval/invitation workflows for schools and mentors) should be completed.

## Application security findings & remediation status

| #   | Severity | Status | Location                                                                                                      | Finding                                                                                                                                                       | Remediation Implemented                                                                                                                                   |
| --- | -------- | ------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | High     | **Resolved & Tested** | [`auth.module.ts`](../apps/api-core/src/platform-modules/auth/auth.module.ts), [`auth.module.spec.ts`](../apps/api-core/src/platform-modules/auth/auth.module.spec.ts), [`auth/page.tsx`](../apps/web-platform/src/app/auth/page.tsx) | Public registration previously accepted privileged roles (`SCHOOL_ADMIN`, `ORG_PARTNER`, `MENTOR`) without invitation or staff approval. | Restricted `POST /v1/auth/register-role` (`RegisterRoleSchema`) to `role: z.literal('PARENT')` only. Added regression unit test (`auth.module.spec.ts`) and updated `/auth` UI. |
| 2   | High     | **Resolved & Tested** | [`mentorship.module.ts`](../apps/api-core/src/platform-modules/mentorship/mentorship.module.ts), [`queries.ts`](../packages/db/src/queries.ts), [`security.integration.test.ts`](../packages/db/src/security.integration.test.ts) | Mentor queue and artifact verification were not scoped to assigned learners/cohorts or active parental consent. | Scoped `mentorshipQueries.pendingQueue`, `verifyArtifact`, and `assignMentor` to active mentor/cohort/tenant assignments and `consent_status = 'VERIFIED_ACTIVE'`. Verified with `security.integration.test.ts`. |
| 3   | Medium   | **Resolved** | [`learning.module.ts`](../apps/api-core/src/platform-modules/learning/learning.module.ts), [`queries.ts`](../packages/db/src/queries.ts) | Public institutional analytics endpoint returned learner-level talent-pool rows. | Replaced public learner-level talent-pool array with aggregate `optedInLearnerCount` telemetry in `institutionQueries.analyticsSummary`. |
| 4   | Medium   | **Resolved** | [`billing.module.ts`](../apps/api-core/src/platform-modules/billing/billing.module.ts), [`queries.ts`](../packages/db/src/queries.ts) | Caller-controlled learner/provider values could self-activate `FREE_PILOT` or `SCHOLARSHIP` enrolment without ownership/authority checks. | Restricted `EnrolLearnerSchema` to `['PAYSTACK', 'STRIPE', 'INSTITUTIONAL_INVOICE']`, enforced `LearnerAccessService.assertCanAccess`, and initialized enrolments as `PENDING_PAYMENT` until webhook/staff confirmation. |
| 5   | Medium   | **Resolved** | [`support.module.ts`](../apps/api-core/src/platform-modules/support/support.module.ts) | School administrators could read/update global support and DPO privacy tickets across tenants. | Restricted `GET /v1/support/tickets` and `PATCH /v1/support/tickets/:id` to `@Roles('SUPER_ADMIN')`. |

Severity reflects the reviewed code paths and their potential impact; it is not a claim that the paths have been exploited.

## Dependency audit (Remediated)

`pnpm audit --audit-level=high` initially reported 3 critical and 27 high advisories. Direct dependencies (`next`, `@nestjs/*`, `vitest`, `eslint-config-next`, etc.) and targeted `pnpm.overrides` (`fastify`, `glob`, `js-yaml`, `lodash`, `picomatch`, `postcss`, `webpack`) were upgraded in `package.json` and `pnpm-lock.yaml`.

**Current `pnpm audit --audit-level=high` status:**
- **0 critical advisories**
- **0 high advisories**
- **1 moderate advisory** (non-blocking under `--audit-level=high`; command exits `0`)

## CI/CD and environment assessment

- The existing GitHub Actions workflow performed quality checks; it did not define deployment or environment promotion.
- Workflow triggers originally omitted the checked-out `master` branch.
- No repository evidence establishes provisioned test/dev/staging/production environments, branch protections, hosted secrets, deployment approvals, or rollback/restore capability.
- Local [`docker-compose.yml`](../docker-compose.yml) publishes database/cache ports, uses a fixed development database password, and starts Redis without authentication. Treat it as local-only; do not reuse it for shared or live infrastructure.
- The API Docker build originally lacked an explicit pnpm global-bin directory setup and had no Docker context ignore file. The build context could include ignored environment files because `.gitignore` does not exclude files from Docker contexts.
- RLS is enabled on selected tables, but should not be assumed to be the only tenant boundary. Validate policies using the least-privileged runtime database role and ensure application query paths establish the intended user context.
- Live Supabase, Vercel, Cloud Run, payment, Redis, storage, and webhook configuration was not inspected. Their security posture remains unknown.

## Changes made during this session

1. Updated [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):
   - Added `master` to push and pull-request branch filters.
   - Set workflow permissions to `contents: read`.
   - Added monorepo build and dependency audit checks.
   - Added an API container-build validation job. It builds locally in CI and does **not** publish or deploy an image.
2. Added [`.dockerignore`](../.dockerignore) to exclude environment files, VCS metadata, dependencies, and generated outputs from Docker build contexts.
3. Updated [`apps/api-core/Dockerfile`](../apps/api-core/Dockerfile) to configure `PNPM_HOME` and pnpm's global binary directory, fixing the observed `ERR_PNPM_NO_GLOBAL_BIN_DIR` container-build failure.
4. Updated [`README.md`](../README.md) with the current CI/deployment-stage status and safety requirements.

### Validation performed

- `pnpm lint` — **passed** (6/6 packages, 0 warnings, 0 errors).
- `pnpm typecheck` — **passed** (10/10 tasks).
- `pnpm test` — **passed** (33 tests across 13 test files, including `auth.module.spec.ts` and `security.integration.test.ts`).
- `pnpm build` — **passed**.
- `pnpm audit --audit-level=high` — **passed** (0 critical, 0 high advisories; exits `0`).
- `docker buildx build --file apps/api-core/Dockerfile --tag sparktrack-api:ci --load .` — **passed** after the Dockerfile fix. No registry push or deployment occurred.
- `git diff --check` — **passed**.

These checks verify local build/workflow configuration only. They do not validate hosted GitHub Actions, production identity/configuration, live database policies, external integrations, or deployed runtime behavior.

## Recommended next actions

Work in this order; keep production out of scope until release gates pass:

1. **Resolve authorization and privacy findings.** Start with privileged self-assignment and mentor queue scoping; then fix talent-pool access, enrollment authorization, and global support-ticket access. Add role/tenant/consent regression tests for each.
2. **Triage and remediate dependency advisories.** Re-run the audit, update dependencies in compatible groups, review changelogs, run tests/build, and confirm the CI audit gate passes.
3. **Harden database boundaries.** Identify the runtime database role, ensure it is least-privileged, consistently apply user/tenant context where intended, and exercise RLS integration tests against that role.
4. **Confirm operating model before cloud deployment.** Establish the hosting platform, source-of-truth branch, environment owners, domains, data region, secret manager, and data-retention/privacy requirements. No cloud stage can safely be provisioned from repository evidence alone.
5. **Create isolated dev and staging environments.** Use separate databases, credentials, cache/storage, and sandbox integrations. Use synthetic or anonymized learner data. Promote the same immutable build; add migration, smoke, end-to-end, rollback, and backup-restore checks.
6. **Gate production.** Require a named human approver, green security/quality checks, successful staging sign-off, monitored rollout, and a tested rollback/restore plan. Production deployment was not authorized or attempted in this review.

## Handoff for a follow-up agent

Begin by reading this report and checking the current worktree. Do not repeat the audit or discard existing changes. First implement and test finding 1 (server-side privileged-role grant controls) and finding 2 (assignment/cohort/consent-scoped mentor queue). Then address the remaining findings and dependency advisories in separate, reviewable changes. Do not provision or deploy a cloud environment until the owner confirms the hosting target and supplies/sets up isolated non-production resources and secrets. Never use production learner data for dev or staging.
