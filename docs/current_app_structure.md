Projekt: uguroezdamar.com — Aktuelle Ordnerstruktur

Hinweis: npm-/pnpm-Module und Paketcaches sind ausgelassen.

/
├─ eslint.config.mjs
├─ next-env.d.ts
├─ next.config.mjs
├─ package.json
├─ pnpm-lock.yaml
├─ postcss.config.mjs
├─ proxy.ts
├─ README.md
├─ tailwind.config.ts
├─ tsconfig.json
├─ vitest.config.ts
├─ app/
│  ├─ error.tsx
│  ├─ globals.css
│  ├─ layout.tsx
│  ├─ not-found.tsx
│  ├─ sitemap.ts
│  ├─ (legal)/
│  │  ├─ imprint/
│  │  │  └─ page.tsx
│  │  └─ privacy/
│  │     └─ page.tsx
│  ├─ (marketing)/
│  │  └─ page.tsx
│  ├─ about/
│  │  └─ page.tsx
│  ├─ blog/
│  │  ├─ page.tsx
│  │  └─ [slug]/
│  │     └─ page.tsx
│  ├─ contact/
│  │  └─ page.tsx
│  ├─ education/
│  │  └─ page.tsx
│  ├─ projects/
│  │  ├─ page.tsx
│  │  └─ [slug]/
│  │     └─ page.tsx
│  ├─ work/
│  │  └─ page.tsx
│  ├─ (portal)/
│  │  ├─ admin/
│  │  │  ├─ page.tsx
│  │  │  └─ dashboard/
│  │  │     ├─ layout.tsx
│  │  │     ├─ page.tsx
│  │  │     ├─ admins/
│  │  │     │  └─ page.tsx
│  │  │     ├─ blog/
│  │  │     │  └─ page.tsx
│  │  │     ├─ leads/
│  │  │     │  └─ page.tsx
│  │  │     └─ projects/
│  │  │        └─ page.tsx
│  │  └─ login/
│  │     └─ page.tsx
│  └─ api/
│     ├─ admin/
│     │  ├─ admins/
│     │  │  └─ invite/
│     │  │     └─ route.ts
│     │  ├─ leads/
│     │  │  ├─ route.ts
│     │  │  └─ export/
│     │  │     └─ route.ts
│     │  ├─ login/
│     │  │  └─ route.ts
│     │  └─ logout/
│     │     └─ route.ts
│     ├─ health/
│     │  └─ route.ts
│     └─ revalidate/
│        └─ route.ts
├─ content/
│  ├─ blog/
│  │  └─ first-post.mdx
│  └─ projects/
│     └─ my-project.mdx
├─ docs/
│  ├─ folder_structure.md
│  └─ improvement.md
├─ features/
│  ├─ about/
│  │  └─ About.tsx
│  ├─ admin/
│  │  ├─ index.ts
│  │  ├─ server/
│  │  │  └─ logic.ts
│  │  └─ ui/
│  │     ├─ InviteAdminForm.tsx
│  │     └─ LoginForm.tsx
│  ├─ blog/
│  │  ├─ index.ts
│  │  ├─ server/
│  │  │  ├─ mdx.ts
│  │  │  └─ queries.ts
│  │  └─ ui/
│  │     ├─ MdxContent.tsx
│  │     ├─ PostCard.tsx
│  │     └─ Toc.tsx
│  ├─ contact/
│  │  ├─ index.ts
│  │  ├─ server/
│  │  │  ├─ actions.ts
│  │  │  ├─ repo.ts
│  │  │  └─ validators.ts
│  │  └─ ui/
│  │     └─ ContactForm.tsx
│  ├─ home/
│  │  ├─ index.ts
│  │  └─ ui/
│  │     ├─ About.tsx
│  │     ├─ Contact.tsx
│  │     ├─ Education.tsx
│  │     ├─ Hero.tsx
│  │     ├─ Mockups.tsx
│  │     └─ Work.tsx
│  └─ projects/
│     ├─ index.ts
│     ├─ server/
│     │  └─ queries.ts
│     └─ ui/
│        ├─ ProjectCard.tsx
│        ├─ ProjectGrid.tsx
│        └─ ProjectHero.tsx
├─ lib/
│  └─ animations.ts
├─ scripts/
│  ├─ seed-admin.mjs
│  └─ setup-indexes.mjs
├─ shared/
│  ├─ lib/
│  │  ├─ animations.ts
│  │  ├─ cookies.ts
│  │  ├─ env.ts
│  │  ├─ mongodb.ts
│  │  └─ utils.ts
│  └─ ui/
│     ├─ Button.tsx
│     ├─ Card.tsx
│     ├─ Container.tsx
│     ├─ Footer.tsx
│     ├─ Header.tsx
│     ├─ Logo.tsx
│     ├─ ScrollProgress.tsx
│     ├─ Section.tsx
│     ├─ Tag.tsx
│     ├─ ThemeProvider.tsx
│     ├─ ThemeToggle.tsx
│     ├─ Topbar.tsx
│     ├─ icons/
│     │  ├─ GitHubIcon.tsx
│     │  └─ LinkedInIcon.tsx
│     └─ Topbar.tsx
├─ ui/ (alternative/shared UI folder — check duplicates)
├─ tests/
│  ├─ admin-session.test.ts
│  └─ _stubs/
│     └─ server-only.js

Wichtige Konfigurationsdateien
- `package.json` (Scripts: `dev`, `test`, `build`, `start`, `lint`, `typecheck`)
- `tsconfig.json`
- `next.config.mjs`
- `tailwind.config.ts`
- `eslint.config.mjs`
- `vitest.config.ts`

Anmerkungen
- Entferne bei Bedarf weitere interne Caches: `.pnpm-store` / `.cache` / `.next` sind nicht aufgelistet.
- Einige UI-Komponenten können doppelt existieren (`shared/ui` vs `ui/`), bitte prüfen.

Datei erstellt: `docs/current_app_structure.md`
