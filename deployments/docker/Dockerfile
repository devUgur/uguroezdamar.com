# syntax=docker/dockerfile:1
# One image definition for the self-hosted platform (ADR 0045, R4): agent API (Node host), portal and office.
# Build from the repository root: docker compose -f deployments/docker/compose.yaml build
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# Dependencies first: the lockfile alone decides the download, so a code change keeps this layer.
FROM base AS deps
# package.json pins pnpm (packageManager); without it corepack would take the newest major.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile

# The agent API without Cloudflare. Data (actor files, host state) goes to the volume /data; the API's database is
# Postgres from NODE_HOST_DATABASE_URL.
FROM deps AS api
ENV NODE_ENV=production NODE_HOST_MODE=cloud NODE_HOST_PORT=3103 NODE_HOST_DATA=/data
VOLUME /data
EXPOSE 3103
CMD ["node", "--experimental-transform-types", "--disable-warning=ExperimentalWarning", "apps/node-host/src/main.ts"]

# Portal migrations and admin accounts (drizzle-kit, pnpm ugur admin).
FROM deps AS tools
CMD ["pnpm", "--filter", "@ugur/server", "db:migrate"]

FROM deps AS portal
ENV NODE_ENV=production
RUN pnpm --filter @ugur/portal build
EXPOSE 3101
CMD ["pnpm", "--filter", "@ugur/portal", "exec", "next", "start", "-p", "3101"]

FROM deps AS office
ENV NODE_ENV=production
RUN pnpm --filter @ugur/office build
EXPOSE 3102
CMD ["pnpm", "--filter", "@ugur/office", "exec", "next", "start", "-p", "3102"]
