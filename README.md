# SparkTrack Monorepo — VS Code + Google Antigravity Starter Kit

This repository contains the complete architectural blueprint, Antigravity agent rules, MCP configuration, and PostgreSQL 17 "SQL AI Developer" migrations for **SparkTrack** and **SparkTrack Intelligence**.

## Quick Start in VS Code with Antigravity Extension

1. **Extract this ZIP archive** and open the folder in **VS Code** (`File -> Open Folder...`).
2. **Install Recommended Extensions:** Accept the prompt to install the **Google Antigravity** extension, Tailwind CSS, and PostgreSQL tooling (defined in `.vscode/extensions.json`).
3. **Configure Environment Variables:** Copy `.env.example` to `.env` and fill in your credentials. The onboarding/consent flow additionally requires Termii `TERMII_API_KEY`, `TERMII_SENDER_ID`, a random `CONSENT_OTP_SECRET` (at least 32 bytes), and `CONSENT_VERIFICATION_URL`. For local development, point the verification URL to `http://localhost:3000/parent/consent`; use your HTTPS deployment URL in production.
4. **Verify Antigravity Context:**
   - `.antigravity/rules.md` automatically enforces the **Agent Constitution** (Headless IP isolation, SQL Ledger immutability, NDPA Child Safety, and Non-Deterministic Career Exploration guardrails).
   - `.antigravity/mcp.json` connects Antigravity to your Supabase Postgres, GitHub, and Cloud Run environments.
   - `.antigravity/skills/` provides custom one-click agent skills.
5. **Start Building with Agents:** Open `docs/ANTIGRAVITY_AGENT_PROMPTS.md` and paste **Prompt 1** into the Antigravity Agent Manager in **Planning Mode**.

## Learner onboarding and guardian consent

The student onboarding page requires an authenticated Supabase learner account. It creates the learner profile through the API and sends a 10-minute, single-use consent code to the guardian by Termii. The guardian opens the SMS link and records consent (or declines); learner evidence remains blocked until consent is verified. Apply database migrations with `pnpm db:migrate` before using this flow.

## CI and deployment stages

The GitHub Actions workflow validates dependency advisories, database migrations, linting, typechecking, builds, tests, and an API container build. It runs for pull requests and pushes to `main`, `master`, and `develop`. The container image is built for validation only; this repository does not currently deploy to a development, staging, or production environment.

Keep development and staging isolated from production, including separate databases, credentials, cache/storage resources, and sandbox integrations. Use synthetic or anonymized learner data outside production. Do not promote a build until CI is green, environment-specific migration and smoke tests pass, and rollback/restore procedures have been exercised. Production deployment should require a separate human approval gate.

The dependency audit currently reports critical and high-severity advisories. Treat this as a release blocker and resolve the affected dependencies before using this workflow as an approval for any deployment. Configure branch protection to require the `Lint, Typecheck & Test` and `Build API container (validation only)` checks.

See the [security and deployment-readiness report](docs/SECURITY_AND_DEPLOYMENT_READINESS.md) for the repository findings, changes made, validation results, and follow-up steps.
