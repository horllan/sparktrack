# Workflow: Local Setup
1. `copy .env.local.example .env` and fill Supabase + Gemini values.
2. `docker compose up -d`
3. `pnpm install`
4. `pnpm db:migrate`
5. `pnpm build` then `pnpm dev`
6. API docs: http://localhost:4000/docs

