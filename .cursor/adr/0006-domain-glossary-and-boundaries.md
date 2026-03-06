# ADR 0006: Domain Glossary, Boundary Rules, and Content Source-of-Truth

## Status
Angenommen (2025-03-05)

## Domain glossary

Single source of meaning for terms used across routes, features, server modules, and admin.

| Term | Meaning | Route (site) | Admin (portal) | Server module | Feature (site) |
|------|---------|--------------|----------------|---------------|----------------|
| **project** | A technical or professional piece of work (code, product, case). Can be file-based (MDX) or DB. | `/projects`, `/projects/[slug]` | `(app)/admin/projects` | `packages/server` projects | `features/projects` |
| **work** | Curated subset of projects shown as “selected work” (e.g. homepage, `/work`). Same data as projects with `featured: true`. | `/work`, `/work/[slug]` | (edit via projects, mark featured) | same as projects | `features/selected-work` (ex work-items) |
| **work-item** | One entry in the selected-work list; in code often the same type as project (e.g. `ProjectRecord`). | — | — | — | (use “selected work” in UX) |
| **blog** | Articles / posts. File-based (MDX) or DB. | `/blog`, `/blog/[slug]` | `(app)/admin/blog` | blog (if any) | `features/blog` |
| **career** | Timeline of jobs / roles / education. | (if exposed) | `(app)/admin/career` | career | — |
| **profile** | Public or admin-editable profile (bio, links). | — | profile / account | profile | — |
| **marketing** | Route group for public marketing pages (about, contact, imprint, privacy). | `(marketing)/*` | — | — | `features/marketing` |
| **contact** | Contact form and contact requests. | `/contact`, `api/contact` | (requests in admin) | contact | `features/contact` |
| **admin** | Portal area for back-office. **Admins** = users who can log into the portal (team members). | — | `(app)/admin/*`, APIs `api/admins`, `api/auth/*` | admin | — |

### Content model (chosen)

- **Variante B–style:** `work` = selected professional work (featured projects); `projects` = all projects (personal + technical); `career` = timeline; `blog` = articles. Selected work is a view over projects, not a separate content type.

---

## Boundary rules

- **Apps may use packages.** Apps must not import app-internal code from the other app (`apps/site` ⇄ `apps/portal`).
- **`packages/server`** must not depend on Next.js or other app-framework APIs. It stays runtime-agnostic (Node + MongoDB/R2, validators, repos).
- **Features do not import other features’ internals.** Cross-feature data is composed in adapters/loaders or shared server.
- **Adapters/loaders** (e.g. `apps/site/src/adapters/*`) are the place where page data is composed (BFF / page data loaders). They call `@ugur/server` and/or file-based loaders (MDX).
- **`packages/ui`** contains no domain logic; only primitives, layout, theme, feedback, branding.

---

## Content source-of-truth

| Content | Source | Editable in portal? | When used |
|---------|--------|---------------------|-----------|
| **Projects (site)** | MDX under `apps/site/content/projects/*` and/or MongoDB | Yes (portal edits DB; MDX is fallback when no DB) | Build-time (static) or request-time (API) depending on deploy |
| **Blog (site)** | MDX under `apps/site/content/blog/*` (and optionally DB) | If blog admin exists | Build-time (static export) |
| **Career** | MongoDB | Yes (portal career UI) | Request-time |
| **Profile** | MongoDB | Yes (portal profile UI) | Request-time |
| **Contact requests** | MongoDB | View/manage in admin | Request-time (API route) |
| **Admins / team** | MongoDB (sessions, invites, roles) | Invites, roles in portal | Request-time |

- **File-based:** MDX in `apps/site/content/` for static export and fallback.
- **Database-driven:** Projects (optional), career, profile, contact requests, admins.
- **Build-time vs request-time:** Site uses static export (`output: "export"`); contact form and any future API calls are request-time. Portal is full SSR/API.
