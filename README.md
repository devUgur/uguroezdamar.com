# uguroezdamar.com

Portfolio und Admin-Portal als pnpm-/Turborepo-Monorepo.

**Einstieg:** [Projekt-Roadmap](PLAN.md) · [Dokumentationsindex](docs/README.md) · [Architekturentscheidungen](docs/architecture/decisions/)

## Repository-Überblick

| Pfad | Zweck |
| --- | --- |
| `apps/site` | öffentliches Portfolio, Projekte, Blog und Kontakt |
| `apps/portal` | geschütztes CMS/Admin-Portal |
| `packages/server` | serverseitige Use Cases, Validierung und Datenzugriff |
| `packages/ui` | gemeinsame UI-Komponenten |
| `tooling/cli` | `pnpm ugur`: Dev-Start, Secrets, Datenbank, Admin-Konten |
| `packages/core` | frameworkunabhängige gemeinsame Hilfsfunktionen |
| `tests` | Vitest-Unit- und Integrationstests |
| `tooling/guards` | automatisierte Architekturregeln |
| `docs` | Architektur, Standards, Sicherheit, Produkt und Betrieb |

Projekte, Profil und Werdegang sind Dateien unter `apps/site/content/`, Blogartikel MDX; die Inhaltsseiten werden beim Build erzeugt ([ADR 0019](docs/architecture/decisions/0019-content-from-git.md)). PostgreSQL (Neon, Drizzle) hält Kontaktanfragen und Admin-Konten ([ADR 0016](docs/architecture/decisions/0016-postgres-neon-infisical-cli.md)).

## Lokale Befehle

```sh
pnpm install
pnpm dev          # Site auf :3100
pnpm dev:portal   # Portal auf :3101
pnpm dev:all      # beide
pnpm guard
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Die Pakete unter `packages/` werden als TypeScript-Quellcode eingebunden und nicht gebaut ([ADR 0017](docs/architecture/decisions/0017-source-first-workspace-packages.md)).

Es gibt keine `.env`-Dateien: Alle Variablen liegen in Infisical und werden von `pnpm dev` injiziert. Einmalig `pnpm ugur setup` ausführen; Details in [docs/operations/secrets.md](docs/operations/secrets.md).

## Verbindliche Referenzen

- [Roadmap mit Phasen und Abnahme](PLAN.md)
- [Dokumentationsregeln und Index](docs/README.md)
- [Architektur und ADRs](docs/architecture/README.md)
- [Qualität und CI](docs/engineering/quality.md)
- [Security-Baseline](docs/security/README.md)
- [Content- und Portfolio-Strategie](docs/product/content-and-portfolio.md)
- [Release und Recovery](docs/operations/release-and-recovery.md)
- [Audit-Zusammenfassung](docs/audits/2026-10-12-code-and-architecture-audit.md)

- [Secrets und Entwicklungsumgebung](docs/operations/secrets.md)

Die Arbeitsregeln für Menschen und Agenten stehen in [`AGENTS.md`](AGENTS.md). `CLAUDE.md`, `.github/copilot-instructions.md` und `.trae/rules/project.md` verweisen nur dorthin.
