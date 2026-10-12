# Code- und Architektur-Audit — 12.10.2026

## Einordnung

Dies ist eine normalisierte Zusammenfassung des vom Nutzer bereitgestellten Audits vom 12.10.2026, ergänzt um einen begrenzten Abgleich mit dem lokalen Repository an diesem Datum. Es handelt sich nicht um ein vollständiges aktuelles Produktionsaudit. Die ursprüngliche Prüfung beschreibt öffentliche Seitenbeobachtungen und statische Codeanalyse; historische CI-Logs, Browser-/Geräteprüfung, ausgeführte Security-Tests und Lighthouse-Messungen lagen nicht vor.

Produktionsbeobachtungen aus dem bereitgestellten Audit sind daher **zu reproduzieren**, bevor daraus ein aktueller Status behauptet wird. Die privaten Projekt-Repositories und Medien benötigen vor Veröffentlichung eine Freigabe.

## Audit-Befunde

| Schwere | Befund aus Audit | Lokaler Abgleich | Ziel |
| --- | --- | --- | --- |
| P0 | Admin kann sich möglicherweise selbst zur Rolle `admin` hochstufen; Owner-Prüfung allein reicht nicht | Route muss vor Fix vollständig geprüft werden; Audit nennt `apps/portal/app/api/admins/[id]/route.ts` | zentrale deny-by-default-Policy und Negativtests |
| P0 | SHA-256-basierte Passwortableitung ist kein geeigneter Passwortspeicher; Invite-Pfad nutzt möglicherweise globales `ADMIN_API_KEY` | `packages/server/src/admin/logic.ts` und Invite/Login-Flows gezielt nachverfolgen | adaptiver Password-Hasher, sichere Migration, getrennte Bootstrap-/Login-Flows |
| P0/P1 | Static Export kollidiert mit Erwartungen an Laufzeit-POST und direkt bearbeitbare CMS-Inhalte | `apps/site/next.config.mjs` setzt `output: "export"`; `apps/site/app/api/contact/route.ts` existiert | Hosting- und Inhaltsmodell als ADR entscheiden |
| P1 | MongoDB, Projekt-MDX, Blog-MDX und Profil-Fallbacks bilden konkurrierende Inhaltsquellen | `apps/site/src/features/projects/queries.ts`, `home/queries.ts` und Blog-Queries vorhanden | klare Quelle je Inhaltsbereich, keine stillen Fallbacks |
| P1 | `packages/ui` soll keine Server-/Session-Logik enthalten | `packages/ui/package.json` hat eine Abhängigkeit auf `@ugur/server`; genaue Imports noch zu bereinigen | UI-Paket entkoppeln und Import-Guard pflegen |
| P1 | Projekte/Work werden teils als Rohtext dargestellt; Navigation und mobile Menüs unvollständig | Routen und Komponenten vor Änderung gegen aktuellen Stand prüfen | einheitliches MDX/Case-Study-Rendering, responsive und bedienbare Navigation |
| P1 | Qualitätssicherung unzureichend in CI eingebunden | `tests/` enthält Vitest-Dateien und Root `pnpm test`; `.github/workflows/ci.yml` führt keinen Testbefehl aus. App-/Paket-Skripte enthalten Platzhalter, Lint umfasst teils nur `app/` | bestehende Tests in CI aufnehmen und alle Quellbereiche prüfen |
| Hoch | öffentliche Demo-Projekt- und Hello-World-Inhalte, fehlerhafte Projektlinks, Work-Seite ohne Inhalte | Audit nennt Live-Beobachtungen; lokale MDX-Dateien `my-project.mdx` und `first-post.mdx` existieren | Live-Routen prüfen, Inhalte freigeben/ersetzen/entfernen |
| Prüfen | erfolgreiche Kontaktzustellung nicht belegt | Implementierung speichert Kontaktanfrage über Serverpaket; echte Zustellung und Produktionslaufzeit sind nicht belegt | End-to-End-Zustellung und Fehlerzustände nachweisen |

## Bereits im lokalen Repository vorhandene gute Ansätze

- pnpm-/Turborepo-Monorepo mit getrennten Apps und gemeinsamen Paketen.
- TypeScript, Zod-Schemas, mehrere Vitest-Tests und Architektur-Guards.
- GitHub Actions für Lint, Typecheck und Build.
- Feature-Ordner und serverseitige Queries in der Site.

Diese Ansätze sollten stabilisiert und durchgesetzt werden. Das Audit empfiehlt keine Komplettneuschreibung.

## Wichtige Einschränkungen

- Der Audit-Text verweist auf 5 fehlgeschlagene CI-Läufe bis 16.03.2026, genaue Logs waren nicht abrufbar. Im lokalen Workflow lassen sich die aktuellen Remote-Läufe daraus nicht verifizieren.
- Der Audit-Text nennt keine automatisierten Tests; das lokale Repository enthält jedoch Tests. Der belegte Mangel ist, dass CI sie nicht ausführt und App-/Paket-Testskripte teils Platzhalter sind.
- Statische Auslieferung und serverseitige Request-Handler müssen anhand der gewählten Deploy-Plattform zusammen bewertet werden. Konkrete Produktionsfunktion ist noch nachzuweisen.
- Audit-Scores (z. B. 4/10, 2/10 Security) sind qualitative Einschätzungen, keine gemessenen Metriken und keine Release-Gates.
- Das Audit hat weder einen echten Browser-/Mobile-Lauf noch Lighthouse/Core-Web-Vitals-/Accessibility-Messungen dokumentiert.

## Verknüpfte Umsetzung

Prioritäten und Abnahmekriterien stehen in [`../../PLAN.md`](../../PLAN.md). Architekturelle Regeln, Sicherheit, Qualität, Inhalte und Betrieb werden in den jeweiligen Dokumenten im [`Dokumentationsindex`](../README.md) gepflegt. Ein Befund wird erst als erledigt markiert, wenn ein Code-Änderungsnachweis und passende Verifikation vorliegen.

## Umsetzungsstand nach dem Audit

Stand 12.10.2026 wurden in der lokalen Arbeitskopie folgende Maßnahmen begonnen oder umgesetzt:

- Admin-Passwörter verwenden Argon2id; Legacy-SHA-256-Hashes werden beim erfolgreichen Login aktualisiert. Invite-Aktivierung ist an ein einmaliges, nicht abgelaufenes Token gebunden.
- Rollenänderungen und Session-Auflösung prüfen Berechtigungsstatus serverseitig. Regressionstests und unabhängige Security-Prüfung sind noch offen.
- Der Projektbild-Upload verlangt eine Admin-Session, beschränkt die Größe und prüft erlaubte Bildsignaturen vor dem Speichern. Route-Regressionstests bleiben offen.
- ADR 0013 legt MongoDB/CMS für Portfolio-Daten sowie serverseitiges Next.js fest. Demo-Projekt- und Blogdateien wurden entfernt; CMS-Projekte werden nur veröffentlicht, wenn sie `published` und nicht geheim sind.
- CI führt den vorhandenen Testbefehl aus. Root-Lint, Architektur-Guards und Typecheck waren lokal erfolgreich. Tests, vollständiger Produktions-Build und Netlify-Preview-Verifikation sind noch offen.
- Noch nicht nachgewiesen: Upload-Autorisierung/-Validierung, Kontaktzustellung, produktive MongoDB-Konfiguration, Slug-Datenmigration und echte Inhalte/Freigaben.

Diese Liste beschreibt Änderungen in der lokalen Arbeitskopie und ist kein Nachweis für einen Merge oder ein Produktions-Deployment.
