# Image of the agents' workstations (ADR 0035). Built by `wrangler deploy` once wrangler.jsonc names it.
# Holds tools only: no credentials, no repository. The container runs without Internet; git, pnpm and wrangler
# reach github.com, registry.npmjs.org and api.cloudflare.com only through the Worker's gateways.
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates coreutils \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@latest-10 --activate \
  && mkdir -p /workspace

WORKDIR /workspace
# Keeps the container alive between exec calls; the Durable Object destroys it after the run.
ENTRYPOINT ["sleep", "infinity"]
