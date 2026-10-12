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
| `packages/core` | frameworkunabhängige gemeinsame Hilfsfunktionen |
| `tests` | Vitest-Unit- und Integrationstests |
| `tooling/guards` | automatisierte Architekturregeln |
| `docs` | Architektur, Standards, Sicherheit, Produkt und Betrieb |

Site und Portal laufen serverseitig. Projekte, Profil, Karriere und Admin-Konten liegen in PostgreSQL (Neon, Drizzle), Blogartikel als MDX im Repository. Entscheidungen: [ADR 0013](docs/architecture/decisions/0013-cms-content-and-server-rendering.md) und [ADR 0016](docs/architecture/decisions/0016-postgres-neon-infisical-cli.md).

## Lokale Befehle

```sh
pnpm install
pnpm dev
pnpm guard
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

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

`.cursor/` und `.github/instructions/` enthalten Tool-/Editor-Kontext. Diese Dateien verweisen auf die zentrale technische Dokumentation und dürfen ihr nicht widersprechen.
