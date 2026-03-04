# Cloudflare Setup (Monorepo)

This repository is a Turborepo with two Next.js apps:

- `apps/site` → public website (`uguroezdamar.com`)
- `apps/portal` → admin portal (`portal.uguroezdamar.com`)

## Deploy targets

Use separate Cloudflare Pages projects (or equivalent):

- Project `site`
  - Root directory: `apps/site`
  - Build command: `pnpm --filter @ugur/site build`
- Project `portal`
  - Root directory: `apps/portal`
  - Build command: `pnpm --filter @ugur/portal build`

## R2 environment variables

Set these in the deploy target that needs uploads/previews (currently portal APIs):

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_ENDPOINT` (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
- `R2_REGION` (`auto`)
- `R2_FORCE_PATH_STYLE` (`true`)
- `R2_PUBLIC_BASE_URL` (public asset domain, if used)

## Security note

If credentials are ever exposed, rotate immediately:

1. Delete compromised R2 API token.
2. Create a new token with minimum required permissions.
3. Update environment variables in all affected deploy targets.

## Verification checklist

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- Deploy `apps/site` and `apps/portal` independently.
