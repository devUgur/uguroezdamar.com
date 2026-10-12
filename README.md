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

Die Site konfiguriert derzeit statischen Export. MongoDB, MDX-Inhalte und Laufzeitendpunkte sind noch nicht zu einem durchgängigen Veröffentlichungsmodell vereinheitlicht. Die Zielentscheidung und Abnahmekriterien stehen in der [Roadmap](PLAN.md) und der [Architekturübersicht](docs/architecture/README.md).

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

Voraussetzungen und Umgebungsvariablen stehen in den jeweiligen `.env.example`-Dateien. Keine echten Secrets in Repository, Beispieldateien oder Logs eintragen.

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
