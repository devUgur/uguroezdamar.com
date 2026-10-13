# Architektur

## Architekturabsicht

Das Repository ist ein pnpm-/Turborepo-Monorepo. Die gemeinsamen Pakete werden als TypeScript-Quellcode konsumiert und von den Apps kompiliert; sie haben keinen eigenen Build ([ADR 0017](decisions/0017-source-first-workspace-packages.md)). Der derzeitige lokale Quellbaum enthält zwei Next.js-Anwendungen (`apps/site`, `apps/portal`), drei gemeinsam genutzte Pakete (`packages/core`, `packages/server`, `packages/ui`), Tests, Tooling und GitHub Actions. Die bevorzugte Weiterentwicklung ist ein modularer Monolith mit wenigen klaren Grenzen. Es gibt keinen Grund, allein wegen des Audits neue Services oder Pakete einzuführen.

```text
Besucher ──> apps/site ───────────────> @ugur/server ──> PostgreSQL (Neon)
                 │                           ▲
                 ├──> Git/MDX Blog           │
                 └──> @ugur/ui, @ugur/core   │
Admin ─────> apps/portal ────────────────────┘
                    └──> @ugur/ui, @ugur/core

CI: Guards → Lint → Typecheck → Tests → Build → Deploy (nach Freigabe)
```

Die öffentliche Site und das Admin-Portal benötigen eine serverfähige Next.js-Laufzeit. Redaktionsverwaltete Profildaten, Karriere und Projekte liegen in PostgreSQL auf Neon ([ADR 0016](decisions/0016-postgres-neon-infisical-cli.md)); Blogartikel sind versionierte MDX-Dateien. Netlify ist die kanonisch konfigurierte Produktion; eine alternative Render-Konfiguration ist dokumentiert.

## Verantwortlichkeiten

| Bereich | Verantwortung | Darf nicht übernehmen |
| --- | --- | --- |
| `apps/site` | öffentliche Routen, Präsentation, SEO und Interaktionen | Admin-Berechtigungen oder direkte Datenbankdetails in UI-Komponenten |
| `apps/portal` | geschützte Redaktionsoberfläche und HTTP-Grenzen | Autorisierung nur im Client durchsetzen |
| `packages/server` | server-only Use Cases, Validierung an Servergrenzen und Datenzugriff | Next.js Request-/Response-Typen als Domänenvertrag erzwingen |
| `packages/core` | frameworkunabhängige, tatsächlich geteilte Hilfsfunktionen | App-spezifische Geschäftsregeln sammeln |
| `packages/ui` | wiederverwendbare visuelle Komponenten | Server-/Datenbank-Paket oder Admin-Session importieren |
| `tooling/guards` | mechanisch prüfbare Import- und Architekturgrenzen | Laufzeitverhalten der Apps ersetzen |
| `tests` | Integrations- und Regressionstests für geteilte Abläufe | Produktionsgeheimnisse oder reale personenbezogene Daten verwenden |

`packages/contracts` ist derzeit nicht vorhanden. Ein separates Contracts-Paket wird erst eingeführt, wenn tatsächlich app-übergreifende öffentliche Schemas/Typen dupliziert oder unübersichtlich werden. Zod-Schemas sollen einen klaren Eigentümer haben und nicht parallel kopiert werden.

## Abhängigkeitsregeln

1. Abhängigkeiten zeigen von Apps auf gemeinsame Pakete, nicht von gemeinsamen Paketen auf Apps.
2. Präsentationskomponenten sprechen Anwendungsfunktionen/Queries an; sie greifen nicht direkt auf Datenbankverbindungen zu.
3. `packages/ui` bleibt frei von `@ugur/server`, DB-Zugriff und Admin-Cookies. Serverabhängige Layoutentscheidungen liegen in der jeweiligen App.
4. `packages/server` bleibt server-only und frameworkarm; Next.js-spezifische Cache- oder Revalidierungsmechanik liegt an einem Adapter der App-Grenze.
5. Features besitzen ihre UI, Queries und Use-Case-Anbindung. Gemeinsame Abstraktionen entstehen aus tatsächlicher Wiederverwendung.
6. Gemeinsame Pakete exportieren nur Dateien aus `src`, haben kein `build`-/`dev`-Skript und importieren keinen App-Code. `@/…` ist in jeder App ein Alias auf die eigene Wurzel.
7. Guards codifizieren Regeln, die stabil und automatisiert prüfbar sind. Ausnahmen erhalten Begründung und Ablaufdatum.

## Laufzeit- und Inhaltsentscheidung

Die frühere Static-Export-Konfiguration wurde durch die in ADR 0013 beschlossene serverseitige Auslieferung ersetzt. Die Alternativen bleiben als Entscheidungsverlauf dokumentiert.

| Option | Geeignet, wenn | Konsequenzen |
| --- | --- | --- |
| Git/MDX als Quelle und statischer Export | Inhalte werden selten geändert und PR/Build ist der gewünschte Freigabeweg | MongoDB-Projekt-Publishing aus der Public Site entfernen oder klar auf statische Build-Eingaben abbilden; Kontakt an externen/serverfähigen Dienst anbinden |
| CMS/MongoDB mit serverfähiger Site | Inhalte müssen im Portal direkt bearbeitet und gezielt veröffentlicht werden | Hosting mit Server-Runtime; Cache-/Revalidation-, Backup-, Preview- und Zugriffsmodell festlegen |

Die angenommene Entscheidung ist in [ADR 0013](decisions/0013-cms-content-and-server-rendering.md) festgehalten (Datenbank seit [ADR 0016](decisions/0016-postgres-neon-infisical-cli.md) PostgreSQL statt MongoDB): CMS für redaktionell verwaltete Profile, Karriere und Projekte; Blogbeiträge verbleiben als MDX in Git. Die Site liefert CMS-Routen serverseitig aus. Details stehen in [`../product/content-and-portfolio.md`](../product/content-and-portfolio.md).

## Datenfluss und Fehlverhalten

- Eingaben werden am HTTP-/Import-/Datenbankrand validiert; interne Typen bleiben daraus abgeleitet.
- Öffentliche Queries geben ausschließlich veröffentlichte und freigegebene Inhalte zurück.
- Datenbankausfälle dürfen keine privaten, unveröffentlichten oder veralteten Demo-Inhalte als Erfolg tarnen. Fallback-Verhalten ist explizit und beobachtbar.
- Fehler werden mit Korrelationsinformationen protokolliert, ohne Secrets, Passwörter oder unnötige personenbezogene Inhalte.
- Publish und Cache-/Build-Invalidierung bilden einen nachvollziehbaren, wiederholbaren Ablauf mit Fehlerzustand.

## Architekturentscheidungen

Für wesentliche Entscheidungen ADRs im Ordner `docs/architecture/decisions/` anlegen. Minimales Format:

```markdown
# ADR-NNNN: Kurzer Entscheidungstitel

- Status: proposed | accepted | rejected | superseded
- Datum: YYYY-MM-DD
- Beteiligte: Rolle/Team

## Kontext
## Entscheidung
## Alternativen
## Konsequenzen
## Verifikation und Rückprüfung
```

Die Content-/Laufzeitentscheidung liegt in ADR 0013. Weitere ADRs halten neue, langfristig wirksame Entscheidungen fest; sie ersetzen weder Migration noch Release-Verifikation.
