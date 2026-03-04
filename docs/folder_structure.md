# Folder Structure (Target State)

## Runtime apps

- `apps/site`: public website routes + site content.
- `apps/portal`: admin dashboard + admin API routes.

Both apps own their framework config (`next.config.mjs`, `postcss.config.mjs`, `next-env.d.ts`).

## Shared packages

- `packages/server`: canonical server logic (repo, validators, business services).
- `packages/ui`: shared UI package.
- `packages/core`: shared core helpers.

Use package entrypoints only (`@ugur/server`, `@ugur/ui`, `@ugur/core`).

## Migration leftovers

- `features/*/server` and parts of `shared/*` still exist as compatibility layer.
- New code should not add dependencies on those legacy server paths.

## Guard rails

- Root guards: `guard:legacy-imports`, `guard:no-deep-imports`.
- ESLint restrictions in portal block legacy/deep server imports.

## Practical rule

If a server concern is reused or app-independent, move it to `packages/server` and consume through app-local loaders in `apps/*/src/server/*`.