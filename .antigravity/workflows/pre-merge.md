# Workflow: Pre-merge Verification
1. `pnpm lint && pnpm typecheck && pnpm test`
2. Run the `child-safety-review` skill on the diff.
3. If migrations changed: `docker compose down -v && docker compose up -d postgres && pnpm db:migrate`.
4. If guardrail or scoring changed: run the `run-13yo-explorer-e2e-test` skill.

