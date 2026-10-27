# ---- Stage 1: Prune monorepo ----
FROM node:20-alpine AS pruner
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
RUN mkdir -p "$PNPM_HOME" && pnpm config set global-bin-dir "$PNPM_HOME" && pnpm add -g turbo
COPY . .
RUN turbo prune @sparktrack-app/web-platform --docker

# ---- Stage 2: Install dependencies ----
FROM node:20-alpine AS installer
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile --prod=false

# ---- Stage 3: Build ----
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=@sparktrack-app/web-platform

# ---- Stage 4: Production / Staging runner ----
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web-platform/public ./apps/web-platform/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-platform/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-platform/.next/static ./apps/web-platform/.next/static

USER nextjs
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "apps/web-platform/server.js"]

