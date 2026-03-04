# uguroezdamar.com

Portfolio + Admin Portal repository in migration to a minimal Turborepo monorepo.

## Current Direction

- Architecture: `apps/site` + `apps/portal` + shared `packages/*`
- Package strategy: compile shared packages to `dist/` and consume via package entrypoints only
- Data strategy: MongoDB as source of truth for Projects/Work
- Timeline strategy: derived read model from Work + Projects (`buildTimeline()`), no dedicated CRUD entity

## Workspace Layout

```txt
apps/
	site/
	portal/

packages/
	ui/
	core/
	server/
```

Legacy app code still exists at the repository root and will be migrated in phases.

## Commands

### Monorepo commands

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

### Legacy fallback commands (during migration)

- `pnpm dev:legacy`
- `pnpm build:legacy`
- `pnpm lint:legacy`
- `pnpm typecheck:legacy`
- `pnpm test:legacy`

## Migration Notes

1. Move marketing routes + content into `apps/site`.
2. Move portal routes + admin APIs into `apps/portal`.
3. Extract reusable modules into `@ugur/ui`, `@ugur/core`, `@ugur/server`.
4. Replace deep imports with package entrypoint imports.
5. Remove root legacy app once both apps are production-ready.
