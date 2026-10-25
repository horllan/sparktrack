# ---- Stage 1: Pruned monorepo ----
FROM node:20-alpine AS pruner
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
RUN mkdir -p "$PNPM_HOME" && pnpm config set global-bin-dir "$PNPM_HOME" && pnpm add -g turbo
COPY . .
RUN turbo prune @sparktrack-app/api-core --docker

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
RUN pnpm turbo run build --filter=@sparktrack-app/api-core

# ---- Stage 4: Production runner ----
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
RUN addgroup --system --gid 1001 sparktrack && \
    adduser --system --uid 1001 sparktrack

COPY --from=builder --chown=sparktrack:sparktrack /app/ .

USER sparktrack
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "apps/api-core/dist/main.js"]
