<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Arbeitsregeln für uguroezdamar.com

Diese Datei ist die einzige Regelquelle für Menschen und Agenten. Editor-spezifische Dateien (`CLAUDE.md`, `.github/copilot-instructions.md`, `.trae/rules/`) verweisen nur hierher. Hintergründe stehen in [`docs/`](docs/README.md); bei Widerspruch gilt die dort verlinkte, gültige ADR.

## Wo die Wahrheit liegt

| Verantwortung | Verbindliche Quelle |
| --- | --- |
| Code und Versionen | GitHub: Arbeit auf `dev`, Releases per Pull Request `dev` → `main`, kein direkter Push auf `main` |
| Architekturentscheidungen | [`docs/architecture/`](docs/architecture/README.md) und gültige ADRs |
| Fortschritt | [`PLAN.md`](PLAN.md) und die verlinkten GitHub-Issues |
| Datenbankschema | `packages/server/src/db/schema.ts` und die Migrationen in `packages/server/drizzle/` |
| Daten | Neon PostgreSQL, Branches `dev` und `prod` |
| Secret-Werte | Infisical (eu), nie Dateien; Ausnahme `apps/api`: GitHub-Actions-Secrets, beim Deploy als Worker-Secrets gesetzt (ADR 0024) |
| Variablennamen | `tooling/cli/src/secrets-manifest.ts` |
| Deployment | Vercel, zwei Projekte aus diesem Repository ([`docs/operations/preview.md`](docs/operations/preview.md), ADR 0020); `apps/api` als Cloudflare Worker ([ADR 0024](docs/architecture/decisions/0024-agent-platform-on-cloudflare.md)); `apps/office` als Cloudflare Worker per OpenNext, `office-dev.` und `office.uguroezdamar.com` ([ADR 0039](docs/architecture/decisions/0039-office-as-own-app-on-workers.md)) |
| Gestaltung | [`docs/product/r2-design-brief.md`](docs/product/r2-design-brief.md), Tokens in `apps/site/app/globals.css` |

## Befehle

```bash
pnpm ugur setup     # einmalig: Infisical und Neon im Browser anmelden
pnpm dev            # Site :3100 mit dev-Secrets
pnpm dev:portal     # Portal :3101 und lokale Agenten-API :3103 (Node-Host, ohne Cloudflare)
pnpm dev:office     # Portal :3101, Office :3102 und Node-Host :3103 (Anmeldung über das Portal)
                    # UGUR_API=dev: statt des Node-Hosts api-dev auf Cloudflare (teilt das Kontingent mit Produktion)
pnpm dev:all        # beide
pnpm dev:clean      # blockierte Ports freigeben und dev starten
pnpm kill:ports     # blockierte Ports (3100, 3101 etc.) beenden
pnpm check          # Lint, Migrationscheck, Typecheck, Tests
pnpm test:pg        # API-Tests auf Postgres (PGlite) statt SQLite (ADR 0045)
pnpm build          # Produktionsbuild beider Apps
pnpm ugur smoke --site <url> --portal <url>   # Deployment über HTTP prüfen
pnpm ugur hosting status                      # Vercel-Projekte gegen das Repository prüfen
pnpm ugur cf login | whoami                   # Cloudflare: eigenes Wrangler-Profil für diesen Checkout, Konto wird geprüft
pnpm ugur --help    # Secrets, Datenbank, Admin-Konten
```

Details: [`docs/operations/secrets.md`](docs/operations/secrets.md).

## Skills und Framework-Doku

- Projekt-Skills liegen in [`.claude/skills/`](.claude/skills/README.md) und sind versioniert. Dort steht auch, woher jeder Skill stammt und was lokal geändert ist. Eigene: `design-system` (vor jeder UI-Arbeit), `release` (vor jedem Push). Diese Datei hat Vorrang vor jedem Skill.
- Next.js bringt versionsgleiche Doku für Agenten mit: `apps/site/node_modules/next/dist/docs/`. Bei Framework-Fragen zuerst dort nachlesen.
- Neue Skills nur nach Prüfung und mit festem Commit-Stand; nichts automatisch nachladen.

## Struktur

- `apps/site` – öffentliche Website. `apps/portal` – Admin-Portal. `apps/office` – das Office: 3D-Büro, Mitarbeiter und Chats der Agenten, ohne Datenbank, nur über `apps/api`, Anmeldung über das Portal (ADR 0039). Alle drei Next.js App Router.
- `apps/api` – Agenten-Backend von Portal und Office (Chat im Office). Der Kern spricht nur mit Ports (`src/platform/ports.ts`); Cloudflare-Code steht ausschließlich in `src/cloudflare/` (ADR 0040, Wächter in `pnpm guard`), die Adapter des Node-Hosts in `src/node/` (ADR 0045). Cloudflare Worker mit eigener D1-Datenbank und eigenen Secrets (ADR 0024). Es importiert keine anderen Workspace-Pakete; Agenten ändern dieses Repository nur nach Freigabe des Owners, per Commit auf `dev` oder `agent/…` und per Pull Request, nie auf `main`.
- `apps/node-host` – dieselbe Agenten-API als Node-24-Prozess ohne Cloudflare (ADR 0045, R1): Server, WebSocket und Start; Daten in `apps/node-host/.data/` (nicht in Git).
- `packages/server` – Datenzugriff, Validierung, Auth-Logik. `packages/ui` – app-neutrale Bausteine. `packages/core` – reine Hilfsfunktionen.
- Die Pakete werden als TypeScript-Quellcode eingebunden: kein Build, kein `dist`, Exporte nur aus `src` (ADR 0017). `@/…` ist in jeder App der Alias auf die eigene Wurzel.
- `tooling/cli` – die `pnpm ugur`-CLI. `tests/` – Vitest, Repository-Tests gegen In-Memory-Postgres.
- In den Apps: `app/` enthält nur Routing, `src/features/<feature>/` den Rest (`ui/`, `queries.ts`, `actions.ts`, `types.ts`, `index.ts`). Ein Feature importiert kein anderes Feature. App-spezifisches Branding und Navigation gehören in die App, nicht nach `packages/ui`.

## Regeln

**Rendering**
- Server Components sind Standard; `"use client"` nur bei echter Interaktion.
- Braucht es die Datenbank, läuft es im Server-Layer. Braucht es öffentliches HTTP, ist es ein Route Handler. Formulare rufen nicht per `fetch` die eigene API auf, wenn eine Server Action reicht.

**Daten**
- Datenbankzugriff nur in `packages/server` über `getDb()`. Apps sind Adapter: Seite → Query/Action der App → Repository im Paket → Postgres.
- Jede Schemaänderung bekommt eine Migration (`pnpm db:generate`); angewendete Migrationen werden nicht editiert.
- Eine neue D1-Migration in `apps/api/migrations` zieht das Postgres-Schema nach: `pnpm --filter @ugur/node-host pg:schema` (ADR 0045). Ein Test meldet ein veraltetes Schema.
- IDs aus URLs vor der Abfrage mit `isUuid()` prüfen. Mehrschrittige Schreibvorgänge laufen in einer Transaktion.
- Ein Datenbankfehler ist kein leeres Ergebnis: Ursache loggen (`describeDbError`), nicht verschlucken.

**Secrets und Konfiguration**
- Keine `.env`-Dateien. Eine neue Variable wird zuerst im Manifest deklariert, dann mit `pnpm ugur secrets set` gesetzt.
- Nie Werte ausgeben, committen, in Issues, Logs oder Screenshots übernehmen. Die CLI zeigt nur Namen; das gilt auch für eigene Skripte.

**UI und Styling**
- Nur Tailwind und die zentralen Tokens; keine Inline-Styles, kein zweites Styling-System, keine Einzelwerte, wo ein Token existiert.
- shadcn-Komponenten kommen per `pnpm ui:add` nach `packages/ui`; Primitives werden umhüllt, nicht umgebaut, und ihre Zugänglichkeit bleibt erhalten.
- Komponenten haben eine Aufgabe, explizite Props und kein `any`. Richtwert: höchstens 200 Zeilen. Keine Geschäftslogik in `layout.tsx`.
- Das Logo ist `apps/site/app/icon.svg`. Es wird nicht nachgebaut oder ersetzt.

**Inhalte und SEO**
- Projekte liegen als MDX in `apps/site/content/projects/`, Profil und Werdegang in `apps/site/content/profile.ts`; Blogartikel sind ebenfalls MDX. Git ist die einzige Quelle (ADR 0019); geparst wird nur im Server-Layer über `apps/site/src/content/`.
- Ein Projekt mit `draft: true` erscheint nur lokal. Private Repositories werden nie verlinkt, und Texte dazu gehen erst nach Freigabe des Owners auf `draft: false`.
- Keine erfundenen Projekte, Kunden, Abschlüsse, Kennzahlen oder Screenshots. Fehlen Inhalte, wird die Sektion klein gehalten oder ausgeblendet.
- Metadata-API, `next/image`, selbst gehostete Fonts, Sitemap.

**Arbeitsweise**
- Gearbeitet wird direkt auf `dev`, ohne Feature-Branches: kleine, nachvollziehbare Commits. `dev` hat eine eigene Umgebung (Agenten-API: `api-dev.uguroezdamar.com`, Site und Portal: Vercel-Preview). `main` ist Produktion und ändert sich nur per Pull Request von `dev` mit grüner CI.
- Veröffentlichen, Mergen und Ausliefern sind drei Entscheidungen. Vor einem Push nennen, wie viele Commits er enthält und ob er ein Deployment auslösen kann.
- Kein Produktions-Deploy ohne Freigabe des Owners. Grüne Checks sind keine visuelle Freigabe.
- Änderungen an Deployment, Datenmodell, Auth, Publishing oder Paketgrenzen aktualisieren die betroffene Doku im selben Pull Request. Überholte ADRs bleiben erhalten und werden als ersetzt markiert.
- Keine neue Bibliothek, Schicht oder kein neues Paket ohne belegten Nutzen.
