---
name: child-safety-review
description: Reviews a change for NDPA child-safety, consent, RLS and non-deterministic-AI violations before merge.
---

# Skill: Child-Safety Review

Check the diff against each item and report pass/fail with file:line:
- Learner/evidence queries are authorised via `LearnerAccessService` and consent is `VERIFIED_ACTIVE`.
- Learners cannot set `qualityScore`, `mentorVerifierId` or `complexityWeight` (server-enforced).
- No PII (name, DOB, school, phone) is sent to Gemini or logged.
- Any AI-generated text passes `checkGuardrail` before persistence or display.
- No UI copy assigns careers ("you will be…"); use exploration language.
- `allow_public_portfolio` / `allow_partner_talent_discovery` still default FALSE.
- `intelligence-core` imports nothing from `platform-modules`.

