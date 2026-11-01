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

## Lifelong learner onboarding, guardian consent, and messaging preferences

SparkTrack supports learners from JSS1 onwards, university and NYSC learners, working professionals, career changers, self-taught learners, and people outside formal education. Education level and school are optional context. Adult learners can onboard without entering a date of birth or guardian contact; under-18 learners must provide a date of birth and guardian contact, then receive a 10-minute, single-use Termii SMS consent request. Evidence for minors remains blocked until consent is verified. Apply database migrations with `pnpm db:migrate` before using onboarding.

Adult learners can optionally save a WhatsApp reminder preference and number. This records channel preference only; outbound WhatsApp messaging requires a configured WhatsApp Business Platform integration and an additional confirmation before messages begin. See [the WhatsApp front-door strategy](docs/SPARKTRACK_WHATSAPP_FRONT_DOOR_STRATEGY.md).

## CI and deployment stages

The GitHub Actions workflow validates dependency advisories, database migrations, linting, typechecking, builds, tests, and an API container build. It runs for pull requests and pushes to `main`, `master`, and `develop`. The container image is built for validation only. Manual Stage 3 (staging) and Stage 4 (production) workflows run verification steps but do not deploy an application image.

### Stage 3 (Staging Sandbox Mirror)
To spin up and audit the isolated Stage 3 sandbox:
- `pnpm stage:up`: Launch isolated PostgreSQL 17 (port 5433), Redis 7 (port 6380), API Core (port 4001), and Web Platform (port 3001) sandbox via `docker-compose.staging.yml`.
- `pnpm stage:verify`: Run the automated pre-flight audit validating staging environment isolation, database migrations, Redis ping, Cloudflare R2 bucket status, and SHA-256 cryptographic ledger integrity.
- `pnpm stage:down`: Stop and clean up the staging sandbox containers.

### Offline-First PWA (Nigerian Intermittent Connectivity)
`apps/web-platform` includes an offline PWA architecture designed for intermittent low-bandwidth environments:
- **Service Worker (`public/sw.js`)**: Cache-First strategy for static assets (`/_next/static/*`, `/icons/*`, fonts, CSS) and Network-First navigation with precached offline fallback (`/offline`).
- **IndexedDB Evidence Queue (`packages/offline-sync`)**: Local evidence submissions, rubric drafts, and learning progress queue safely into IndexedDB when offline.
- **Auto-Sync Engine (`PwaRegistrar`)**: Automatically flushes queued records upon network reconnection, computing SHA-256 signatures before cloud submission.

Keep development and staging isolated from production, including separate databases, credentials, cache/storage resources, and sandbox integrations. Use synthetic or anonymized learner data outside production. Do not promote a build until CI is green, environment-specific migration and smoke tests pass, and rollback/restore procedures have been exercised. Production deployment should require a separate human approval gate.

Database integration tests only connect when `SPARKTRACK_TEST_DATABASE_URL` is explicitly set, and require a loopback host such as `localhost`. Use a disposable local database; do not point this variable or `DATABASE_URL` in the root `.env` at staging or production. The explorer test uses a placeholder Gemini key and does not send test data to the AI service.

The current dependency audit reports no critical or high advisories. One moderate advisory remains in development-only tooling; the production dependency audit is clean. Configure branch protection to require the `Lint, Typecheck & Test` and `Build API container (validation only)` checks.

See the [security and deployment-readiness report](docs/SECURITY_AND_DEPLOYMENT_READINESS.md) for the repository findings, changes made, validation results, and follow-up steps.
