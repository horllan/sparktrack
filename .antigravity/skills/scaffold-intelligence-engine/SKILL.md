---
name: scaffold-intelligence-engine
description: Scaffolds or updates a headless engine slice inside apps/api-core/src/intelligence-core following NestJS Fastify, Zod, and SQL AI Developer standards.
---

# Skill: Scaffold SparkTrack Intelligence Engine Module

When invoked, follow these exact steps:
1. Create the NestJS module, service, controller, and Zod DTO contracts inside `apps/api-core/src/intelligence-core/<engine-name>`.
2. Ensure zero dependencies on `platform-modules`. Communicate solely via domain events (BullMQ / Upstash Redis) and `packages/db` Kysely/Drizzle repositories.
3. Expose Swagger/OpenAPI decorators on all endpoints for B2B Intelligence API readiness.
4. Write unit and integration tests verifying non-deterministic guardrails and SQL ledger integrity.
