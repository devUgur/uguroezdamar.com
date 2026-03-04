# Wrapper Cleanup Criteria

This document defines when legacy `features/*/server` wrappers can be safely removed.

## Goal

Delete wrapper files only after all runtime imports have moved to package entrypoints (primarily `@ugur/server`) through app-local server loaders.

## Required checks

Run from repository root:

1. No portal usage of legacy feature server paths:

```bash
grep -R "features/.*/server" -n apps/portal
```

2. No site usage of legacy feature server paths:

```bash
grep -R "features/.*/server" -n apps/site
```

3. No app runtime usage of direct shared Mongo import:

```bash
grep -R "shared/lib/mongodb" -n apps packages
```

4. Guards and gates are green:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Removal order

1. Remove wrappers for domains with zero import hits.
2. Re-run lint/typecheck/build.
3. Commit in small slices by domain (`profile`, `timeline`, etc.).

## Scope note

Hits in docs, scripts, or historical notes are not runtime blockers; app and package runtime code is the blocker.
