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
- `pnpm ui:add <component>` (adds shadcn/ui components into `packages/ui`)
- `pnpm ui:diff` (shows local diff against shadcn registry for `packages/ui`)

## Conventions

- Prefer package entrypoints (`@ugur/server`, `@ugur/ui`, `@ugur/core`), not deep imports.
- Keep app-level server imports behind loaders in `apps/*/src/server/*`.
- Do not import legacy root `features/*` paths from app code.
- Keep app boundaries strict: `apps/site` must not import from `apps/portal`, and `apps/portal` must not import from `apps/site`.
- Put shared code in `packages/*`; keep app-specific code inside each app's `src/features/*`.

## Guardrails

- `pnpm guard` runs architecture guards (legacy imports, feature imports, deep imports).
- `pnpm lint`, `pnpm typecheck`, and `pnpm build` all run `pnpm guard` first.

## Shadcn in Monorepo

- Source of truth: `packages/ui/components.json`.
- New components are installed into `packages/ui/src/components`.
- Shared utility alias is `@/lib/utils` inside `packages/ui` (`packages/ui/src/lib/utils.ts`).

## Deployment

- Netlify is configured for monorepo app builds in `netlify.toml`.
- Cloudflare/R2 setup notes are in `cloudflare.md`.
