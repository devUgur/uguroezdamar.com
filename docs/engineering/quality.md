# Entwicklungsqualität und CI

## Ziel

Jeder Merge soll reproduzierbar baubar sein und die betroffenen Risiken durch passende automatisierte Prüfungen abdecken. GitHub Actions führt Guards, Lint, Typecheck, Tests und Produktions-Build mit Node 24 und pnpm 10 aus. Änderungen an Workflow und Abhängigkeiten müssen zusammen mit den lokalen Gates überprüft werden.

**Letzter Nachweis (12.10.2026):** `pnpm install --frozen-lockfile`, `pnpm audit --prod`, `pnpm guard`, `pnpm lint`, `pnpm typecheck`, `pnpm test` und `pnpm build` liefen lokal erfolgreich. GitHub Actions CI lief für PR #2 mit allen fünf Checks (Install, Lint, Typecheck, Tests, Build) erfolgreich. Der lokale Testlauf meldete 11 Dateien erfolgreich, eine übersprungen; 38 Tests erfolgreich und zwei MongoDB-Integrationstests übersprungen, weil lokal `TEST_MONGODB_URI` nicht gesetzt war. CI stellte dafür einen isolierten MongoDB-Service bereit. Der mobile Browser-Smoke lief bei 390×844 für Startseite, Blog, Projekte und Kontakt; das Hamburger-Menü lässt sich öffnen und mit Escape schließen. Axe/WCAG-Prüfung auf den vier Routen meldete nach Korrekturen null Verstöße. Eine Hosting-Preview mit den tatsächlichen Laufzeitvariablen steht noch aus. Lint weist bestehende Warnungen zu `any` und `<img>` aus.

**Nachweis 13.10.2026 (ADR 0017):** `pnpm guard`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (18 Dateien, 78 Tests gegen PGlite, kein Build davor) und `pnpm build` liefen lokal ohne `dist`-Ordner erfolgreich.

## Pflichtprüfungen

Die Zielreihenfolge für Pull Requests:

1. Frozen-Lockfile-Installation auf unterstützter Node-/pnpm-Version.
2. Architektur-Guards (`pnpm guard`).
3. Lint über App-Routen, `src`, Komponenten, Tooling und Pakete.
4. Typecheck für alle Apps und Packages.
5. Unit- und Integrationstests, einschließlich Berechtigungs-Negativtests.
6. Produktions-Build für alle deploybaren Apps.
7. E2E-, Accessibility- und Performance-Checks nach Einführung der stabilen Testumgebung.

Alle Prüfungen erhalten eindeutige Exit-Codes. Keine Erfolgsskripte, die lediglich „noch nicht konfiguriert“ ausgeben. Turbo-Tasks deklarieren korrekte Inputs, Abhängigkeiten und Outputs, sodass Cache-Treffer reproduzierbar bleiben.

## Teststrategie

| Ebene | Prüft | Beispiele |
| --- | --- | --- |
| Unit | reine Regeln und Transformationen | Zod-Validierung, Slug-Normalisierung, Rollenmatrix |
| Integration | Use Cases, Repositories, API-Routen und Grenzen | Admin-PATCH, Login/Invite, Kontakt-POST, veröffentlichte Projekte |
| Architektur | Importregeln und Build-/Exportverträge | keine Serverimporte im UI, keine Next-Imports im Server-Paket, Pakete bleiben source-first (`guard:package-boundaries`) |
| E2E | kritische Abläufe aus Sicht des Nutzers | Navigation, Kontakt, Admin-Veröffentlichung und Vorschau |

Tests verwenden isolierte Fixtures, deterministische Uhr/IDs und Stubs für externe Systeme. Sie prüfen auch abgelehnte Aktionen. Keine produktiven Konten, Schlüssel oder persönlichen Kontaktdaten.

## Lokale Entwicklung

- `pnpm dev` startet nur die Site, `pnpm dev:portal` nur das Portal, `pnpm dev:all` beide. Pakete werden nicht gebaut; Tests und Typecheck laufen direkt gegen den Quellcode ([ADR 0017](../architecture/decisions/0017-source-first-workspace-packages.md)).
- Änderungen klein halten und betroffene Checks ausführen.
- Vor einem PR `pnpm guard`, `pnpm lint`, `pnpm typecheck`, `pnpm test` und den relevanten Build ausführen.
- PR-Beschreibung nennt Problem, Verhalten, Sicherheits-/Datenfolgen und Verifikation.
- Änderungen an Umgebungsvariablen aktualisieren `tooling/cli/src/secrets-manifest.ts`; `tests/secrets-manifest.test.ts` erzwingt das. Schemaänderungen brauchen eine Migration (`pnpm db:check`).
- Keine Tests ausführen, wenn der Arbeitsauftrag es untersagt; dann verbleibende Verifikationslücke klar dokumentieren.

## Release-Gates

- Pflichtchecks sind grün; Ausnahmen sind begründet, zeitlich begrenzt und durch Verantwortliche akzeptiert.
- Datenbankänderungen und Migrationen besitzen Vorwärts-/Rückweg und werden vor Produktivlauf geprüft.
- Preview- und Produktionsumgebungen verwenden getrennte Secrets und Daten.
- Deployment wird erst nach freigegebenem Pull Request ausgelöst; Release kann auf einen bekannten Build zurückgesetzt werden.

## Pflege

Die Phase-1-Roadmap ergänzt Tests und CI als frühe Arbeit. E2E/A11y/Lighthouse folgen erst, wenn Routing und Publish-Modell stabil sind. Qualitätsziele werden anhand gemessener Resultate festgelegt, nicht anhand angenommener Scores.
