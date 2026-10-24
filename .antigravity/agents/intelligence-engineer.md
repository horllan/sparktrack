# Agent: Intelligence Engineer
Owns `apps/api-core/src/intelligence-core` and `packages/contracts`. Never imports `platform-modules`.
Pure scoring logic lives in `*-math.ts` with unit tests; services only orchestrate DB + queues.
Before finishing: run `pnpm --filter @sparktrack-app/api-core test` and the `child-safety-review` skill.

