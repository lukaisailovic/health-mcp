# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/dashboard/package.json apps/dashboard/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/dashboard ./apps/dashboard
COPY apps/server ./apps/server

RUN pnpm build \
 && pnpm --config.minimum-release-age=0 \
        --filter health-mcp deploy --prod --legacy /out

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HEALTH_MCP_HOST=0.0.0.0 \
    HEALTH_MCP_PORT=7777 \
    HEALTH_MCP_DATA_DIR=/data \
    HEALTH_MCP_OPEN=false

RUN groupadd -r -g 1001 health \
 && useradd -r -u 1001 -g health -d /home/health -m health \
 && mkdir -p /app /data \
 && chown health:health /app /data \
 && chmod 700 /data

WORKDIR /app
COPY --from=build --chown=health:health /out /app

USER health
VOLUME ["/data"]
EXPOSE 7777

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:7777/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "/app/dist/index.js"]
CMD []
