# uguroezdamar.com

Portfolio + Admin Portal monorepo powered by pnpm workspaces + Turborepo.

## Architecture

- `apps/site`: public website.
- `apps/portal`: admin dashboard and admin APIs.
- `packages/server`: canonical server modules.
- `packages/ui`, `packages/core`: shared packages.

## Commands

- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

## Conventions

- Prefer package entrypoints (`@ugur/server`, `@ugur/ui`, `@ugur/core`), not deep imports.
- Keep app-level server imports behind loaders in `apps/*/src/server/*`.
- Treat `features/*/server` as compatibility layer until fully removed.

## Deployment

- Netlify is configured for monorepo app builds in `netlify.toml`.
- Cloudflare/R2 setup notes are in `cloudflare.md`.
