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

**Package roles in a nutshell:** `apps/site` = public portfolio; `apps/portal` = internal content and admin; `packages/server` = domain logic, validation, persistence; `packages/ui` = shared presentation primitives; `packages/core` = low-level shared utilities.

### System overview (60 seconds)

- **What is what:** `site` = public portfolio (marketing, blog, projects, work, contact). `portal` = internal CMS and admin (projects, career, blog, profile, team). Both use `packages/server` for domain logic and `packages/ui` for shared components.
- **Where content lives:** File-based content: MDX in `apps/site/content/` (projects, blog) for static export and fallback. Database: MongoDB for projects (optional), career, profile, contact requests, admins/team. See [ADR 0006](.cursor/adr/0006-domain-glossary-and-boundaries.md) for the full content source-of-truth table.
- **What is canonical:** Architecture and coding rules = ESLint (`eslint.config.mjs`) + ADRs (`.cursor/adr/`). Domain terms and boundaries = [ADR 0006](.cursor/adr/0006-domain-glossary-and-boundaries.md). Rename rationale = [ADR 0007](.cursor/adr/0007-renames-selected-work-and-admin-team.md). Tooling and AI context = `.cursor/`, `.github/instructions` (do not override the rules above).

### Layer Responsibilities

| Layer | Responsibility | Contents |
| :--- | :--- | :--- |
| **Apps** (`apps/*`) | Routing, Page Data, Caching | Next.js Pages, API Routes, Server Actions. **Feature queries/actions** (`apps/*/src/features/*/queries.ts`, `actions.ts`) = page data loaders / BFF: they compose data for pages from `@ugur/server` and/or file-based content (e.g. MDX). In `apps/portal`, `src/adapters` is still used; see [ADR 0009](.cursor/adr/0009-feature-local-queries-and-actions.md). |
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

## Governance and rules (documentation compass)

- **Read first:** This README and [ADR 0006](.cursor/adr/0006-domain-glossary-and-boundaries.md) (domain glossary, boundaries, content source-of-truth).
- **Binding:** ESLint (`eslint.config.mjs`) and ADRs (`.cursor/adr/`) define architecture and coding rules.
- **Tool-/AI-specific:** `.cursor/`, `.github/instructions` = editor and CI prompts; they do not override the binding rules.
- **Historical/context:** [optimization review](.cursor/optimization-review.md) and other `.cursor/` docs = context for decisions, not operative requirements.

## Shadcn in Monorepo

- Source of truth: `packages/ui/components.json`.
- New components are installed into `packages/ui/src/components`.
- Shared utility alias is `@/lib/utils` inside `packages/ui` (`packages/ui/src/lib/utils.ts`).

## Deployment

- Netlify is configured for monorepo app builds in `netlify.toml`.
- Cloudflare/R2 setup notes are in `cloudflare.md`.
