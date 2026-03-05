# uguroezdamar.com

Portfolio + Admin Portal monorepo powered by pnpm workspaces + Turborepo.

## Architecture Map

```text
  [ apps/site ]       [ apps/portal ]
        |                   |
        +---------+---------+
                  |
        [ packages/server ] <--- (Domain, Repo, Validators)
                  |
        +---------+---------+
        |                   |
  [ MongoDB ]        [ Cloudflare R2 ]

  [ packages/ui ]   <--- (Design System, Primitives)
        |
  [ packages/core ] <--- (Shared Utils)
```

### Layer Responsibilities

| Layer | Responsibility | Contents |
| :--- | :--- | :--- |
| **Apps** (`apps/*`) | Routing, Adapters, Caching | Next.js Pages, API Routes, Server Actions, Site-specific mappings |
| **Features** (`src/features/*`) | Domain UI & Local Logic | React Components, local types, local state |
| **Shared UI** (`packages/ui`) | UI Primitives (Design System) | Buttons, Inputs, Cards (Shadcn), Layout |
| **Domain Layer** (`packages/server`) | **Single Source of Truth** | Repositories, Validators, Use-cases, DB logic |
| **Core Utilities** (`packages/core`) | Low-level helpers | `cn()`, string helpers, shared constants |

### The "9/10" Rules
1. **Domain Logic ALWAYS in `packages/server`**: Repos, Zod schemas, and complex business logic belong here.
2. **Apps are Thin Adapters**: `apps/*/src/server` should only wrap `@ugur/server` calls or handle app-specific concerns like MDX file loading.
3. **No Deep Imports**: Always import from the package root (e.g., `@ugur/server`).
4. **UI stays UI**: `packages/ui` contains primitives. Feature-specific composites stay in `apps/*/src/features`.

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
