# syntax=docker/dockerfile:1.7
# Build from the repository root:  docker build -f apps/server/Dockerfile .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
# Prisma's schema engine (migrations) needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /repo

# ---- install + build --------------------------------------------------------
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @puzzle/server...
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @puzzle/server build
# Self-contained production folder (prod dependencies only).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @puzzle/server deploy --legacy --prod /out \
 && cp -r apps/server/dist /out/dist

# ---- runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=4000 UPLOAD_DIR=/app/uploads
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 10001 app && useradd --uid 10001 --gid app --no-create-home --home-dir /app app \
 && mkdir -p /app/uploads && chown app:app /app/uploads
COPY --from=build --chown=app:app /out /app
USER app
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then start the game server.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/index.js"]
