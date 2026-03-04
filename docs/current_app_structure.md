# uguroezdamar.com — Current Structure

This repository is now a monorepo-first setup.

```txt
/
├─ apps/
│  ├─ site/            # public website app
│  │  ├─ app/
│  │  ├─ content/
│  │  ├─ src/
│  │  └─ next.config.mjs
│  └─ portal/          # admin portal app
│     ├─ app/
│     ├─ src/
│     └─ next.config.mjs
├─ packages/
│  ├─ core/            # shared core helpers
│  ├─ ui/              # shared UI package
│  └─ server/          # canonical server modules
├─ features/           # legacy compatibility layer (still present)
├─ shared/             # legacy shared layer (still present)
├─ scripts/
├─ tests/
├─ tooling/
├─ docs/
├─ eslint.config.mjs
├─ netlify.toml
├─ cloudflare.md
├─ turbo.json
└─ package.json
```

## Notes

- Root `app/` and root `content/` were removed.
- Next/PostCSS configs are app-local in `apps/site` and `apps/portal`.
- Runtime business logic should live in `packages/server`.
