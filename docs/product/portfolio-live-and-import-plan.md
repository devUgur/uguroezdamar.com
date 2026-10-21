# Portfolio, GitHub-Import und Live-Release

**Stand:** 21.10.2026
**Zweck:** Umsetzung des einheitlichen Portfolio-Designs, eines sicheren Projekt-Import-/Medien-Workflows und der getrennten Live-Releases von uguroezdamar.com und viralsync.io.
**Status:** Plan aus Audit und aktuellem Repository-Abgleich; noch keine Produktionsfreigabe.

## Aktueller Ausführungsstand

Stand 19.10.2026: PR #23 (`codex/github-project-catalog`) enthält Discovery, sichere Einzelprüfung und den Schutz gegen Cache-Kollisionen zwischen Preview und Produktion. Auf dem zuletzt geprüften Stand sind CI, Site- und Portal-Preview grün. Die read-only Discovery fand neun eigene öffentliche Repositories; Metadaten wurden für alle neun einzeln geprüft. Dabei wurde nichts gespeichert. Die Beschreibungen deuten auf zwei Produkt-/Entwicklerwerkzeuge und mehrere Business-Websites hin; das belegt weder Rolle/Beitrag noch Kundenbeziehung oder Veröffentlichungsrechte. Diese Angaben werden deshalb nicht automatisch zu Case Studies.

Der nächste Cloud-Schritt ist blockiert: Für dieses Repository ist aktuell keine passende, bestätigte Infisical-Projektverknüpfung auswählbar. Die lokale Verknüpfung wurde nach Abbruch des Relinks wiederhergestellt. Es gab keine Neon-Migration und keinen Datenbank-Sync. Vor dem Fortsetzen muss ein dediziertes Infisical-Projekt vom Typ Secrets Management vorhanden und bestätigt sein. Die Produktionsumgebungen stehen weiterhin auf SHA `f60a1a4`; weder Merge nach `main` noch Produktions-Promote ist erfolgt.

## Ziel des Vorhabens

- Alle öffentlichen Portfolio-Routen folgen einer gemeinsamen, ruhigen Editorial-Gestaltung.
- Projekte lassen sich mit `pnpm ugur` aus GitHub entdecken, nach Neon synchronisieren und als reviewbare Inhaltsentwürfe vorbereiten.
- Freigegebene echte Produktbilder und Screenshots machen Case Studies anschaulich, ohne Kundendaten oder private Repository-Inhalte zu zeigen.
- Portfolio und ViralSync werden getrennt, anhand exakter Commits und ihrer jeweiligen Release-Gates geprüft und ausgeliefert.
- Drafts erhalten eine sichere Vorschau. Öffentliche Seiten, Sitemap und Suchmaschinen zeigen nur ausdrücklich veröffentlichte Inhalte.

## Verifizierter Ausgangspunkt

- Portfolio-Inhalte werden laut [ADR 0019](../architecture/decisions/0019-content-from-git.md) aus Git/MDX erzeugt. `draft: true` ist lokal; öffentlich benötigt der aktuelle Vertrag bestätigte Inhalte und `draft: false`.
- Die bisherigen CMS-Tabellen `projects`, `profiles` und `career_entries` sind stillgelegt. [PR #14](https://github.com/devUgur/uguroezdamar.com/pull/14) plant ihre spätere Entfernung mit Backup-/Restore-Gates. Sie werden nicht als unbesehen einsatzfähige Importtabellen reaktiviert.
- Der CLI-Einstieg liegt in `tooling/cli/src/main.ts`; Befehle folgen `commands/`, Integrationen `lib/`. Neon-Zugriff der Anwendung gehört in `packages/server` über `getDb()`.
- [PR #21](https://github.com/devUgur/uguroezdamar.com/pull/21) ist Draft und hat grüne CI sowie eine erfolgreiche Site-Preview. Der laufende Design-Branch `codex/unified-public-design` baut darauf auf; seine A2-Änderungen benötigen noch die visuelle Abnahme nach den gezielten Korrekturen.
- Das lokale ViralSync-Repository `C:\Projects\viralsync.io` steht auf `dev`, ist vier Commits hinter `origin/dev` und hat sieben nicht committete Änderungen. Daran wird nicht gearbeitet, bis diese Änderungen in einem separaten Worktree gesichtet und erhalten sind.
- ViralSync besitzt bereits `pnpm vs showcase check|capture`, das die echte App mit synthetischen Testdaten aufnimmt. Marketing, Docs, App/API und Produktion haben getrennte Freigaben; Privacy, Terms und Imprint sind laut `docs/LAUNCH.md` weiterhin Drafts.

## Inhalts- und Datenentscheidung

### Empfohlener Weg: Git bleibt Publish-Quelle, Neon wird Importkatalog

Die Datenbank speichert GitHub-Repository-Identität, Sichtbarkeit, Importstatus, Quellrevision, Inhalts-Fingerprint, erzeugte PR-Referenz und Medien-Prüfstatus. Sie speichert keine zweite Kopie redaktioneller Case-Study-Texte als veröffentlichungsfähige Wahrheit. Die Website bleibt ohne Neon-Abhängigkeit für Portfolio-Seiten verfügbar.

Ein Import erzeugt einen lokalen MDX-Draft bzw. einen Branch-/Pull-Request-Vorschlag. Die CLI übernimmt nur erlaubte Repository-Metadaten und überschreibt bei wiederholtem Sync keine manuell redigierten Felder wie Rolle, Beiträge, Alt-Texte, Zeitraum oder Freigabestatus. `pnpm ugur projects draft <owner>/<repo> --slug <slug>` zeigt standardmäßig einen Dry-Run; `--apply` legt genau eine neue lokale MDX-Datei mit `draft: true` an und überschreibt nichts. Die Datei speichert GitHub-Repository, exakte Quellrevision, README-Pfad/-Blob-SHA (falls vorhanden) und Importzeitpunkt. README-Inhalte werden als nicht vertrauenswürdige Evidenz markiert, begrenzt angezeigt, weder interpretiert noch ausgeführt und nicht in MDX kopiert. Titel und Beschreibung stammen aus öffentlicher Repository-Metadaten; Rolle, Beiträge, Zeitraum, Kategorie, Status, Technologien, Ergebnisse, Kundenbezug, Screenshots und Alt-Texte bleiben leer bzw. ungefüllt, bis der Owner sie bestätigt. Veröffentlicht wird nach inhaltlicher Prüfung über den vorhandenen Git-/PR-/Vercel-Prozess.

Damit erfüllt der Katalog den Wunsch, Projekte mit einem CLI-Aufruf zu erfassen und in Neon abzulegen, während es für veröffentlichte Portfolio-Texte eine einzige Quelle gibt.

### Alternative, falls redaktionelle Bearbeitung direkt in der Datenbank zwingend ist

Ein DB-CMS ist eine eigenständige Architekturänderung: ADR 0019 muss ersetzt werden; Schema, Autorisierung, Audit-Log, Editoren, Preview-Signierung, Medienzugriff, Cache-Invalidierung, Migration und Rollback müssen neu entworfen werden. Git/MDX und veröffentlichte DB-Texte dürfen nicht parallel dieselben Inhalte steuern. Diese Alternative wird nicht stillschweigend mit dem Importkatalog vermischt.

## Veröffentlichungszustände

1. **Discovered:** GitHub-Metadaten sind intern in Neon gespeichert; noch nicht als Portfolio-Projekt sichtbar.
2. **Draft:** Der Import hat einen redigierbaren MDX-Vorschlag erzeugt. Lokale Ansicht und geschützte Vercel-Preview erlauben Review; keine öffentliche Sitemap, Metadaten oder externen Projektlinks.
3. **Approved:** Owner hat Projektnarrativ, Rolle, Beiträge, Zeiträume, Ziele, Screenshots und Alt-Texte für diesen Eintrag geprüft.
4. **Published:** `draft: false` wird per PR mit grüner CI gemergt; nur freigegebene Datensätze erscheinen öffentlich.
5. **Archived:** Projekt bleibt versioniert, wird aus hervorgehobenen Flächen entfernt und folgt einer dokumentierten URL-/Indexierungsregel.

Eine allgemeine Bitte, Projekte live zu schalten, ergänzt keine fehlenden Projektdaten. Draft-Vorschauen auf einem Produktionsdeployment benötigen echte Zugangskontrolle und geschützte Assets; `noindex` oder ein schwer zu erratender Link sind allein kein Zugriffsschutz.

## Phasen und Abnahme

| Phase | Ergebnis | Arbeit | Abnahme / Gate |
| --- | --- | --- | --- |
| 0. Einheitliches Portfolio-Design | A2-Seiten bilden ein konsistentes System | gemeinsame Seitenköpfe, Projektkarten, Artikeltypografie, Kontaktformular, About/Education/Legal-Rahmen; Startseite bis Tablet nicht schmal; Dark Mode tokenbasiert | Route-Review, 375/768/1440 px, hell/dunkel, Tastatur/Fokus, Reduced Motion; Design-PR und exact-SHA-Previews grün |
| 1. Quellenvertrag | ADR 0021; additive `portfolio_github_repositories`-Tabelle im Schema getrennt von stillgelegten CMS-Tabellen | Migration und Upsert-Tests sind lokal geprüft. Offen: Migration auf Neon `dev` und Restore-/Migrationsprüfung; keine Produktionsdatenänderung und kein doppelt geführter Publikationstext |
| 2. GitHub-Discovery/Import-CLI | `pnpm ugur projects discover` mit read-only Dry-Run und `--apply` nur für `dev`; `projects inspect <owner>/<repo>` für gezielte, rein lesende Prüfung | Discovery und Einzelprüfung sind lokal und in CI geprüft. Offen: Migration auf `dev`, Sync idempotent belegen und Rate-Limit-/Fehlerverhalten dokumentieren. Werte und Tokens erscheinen nie in Logs. `inspect` liest nur öffentliche Metadaten und einen auf 1.200 Zeichen begrenzten README-Auszug des authentifizierten Owners, persistiert nichts und führt keinen Repo-Code aus. |
| 3. Inhaltsentwurf und Vorschau | geprüfte Entwürfe ohne öffentliche Leaks | `projects draft` erstellt per Dry-Run oder lokalem `--apply` einen schema-validen Stub mit Quellrevision; README-Inhalte werden nie in MDX übernommen. Persönliche Aussagen, Beiträge und Projektergebnisse erfordern Owner-Bestätigung; Draft-Assets bleiben außerhalb von `public/`. | Draft nicht in Production, Sitemap oder Suchindizes; jede Tatsachenbehauptung ist auf überprüfbare Quelle zurückführbar; Preview- und Asset-Zugriffsschutz vor/nach Deploy belegt |
| 4. Screenshot-/Medienfluss | echte, freigegebene und responsive Produktbilder | zuerst vorhandenes `pnpm vs showcase capture` für ViralSync mit synthetischen Daten nutzen; für externe Demos separate `pnpm ugur projects capture`-Prüfung entwerfen; Vorschau nur über explizite HTTPS-Allowlist, ohne Cookies/Tokens, mit SSRF-, Redirect-, Timeout- und Größenbegrenzung; Candidate-Dateien manuell prüfen und optimiert versionieren | keine privaten Screens, Kundendaten oder Admin-Routen; sichtbarer Text, Bildrechte, Zuschnitt und Alt-Text bestätigt; Next/Image lädt feste Formate/Größen |
| 5. Öffentliche Projektfreigabe | belegbare Case Studies | aktuelle Drafts einzeln prüfen; fehlende Rolle/Beiträge/Zeiträume/Fakten durch Owner liefern oder weglassen; nur freigegebene externe URLs; `draft: false` im PR | Owner akzeptiert konkrete Darstellung; Projektseite, Home-Karte, externe Ziele, Schema, Sitemap und Metadaten geprüft |
| 6. Portfolio-Release | Site und Portal auf festem Stand live | CI und Vercel Preview prüfen; `pnpm ugur smoke` für Site und Portal am exakten SHA; Login/Invite/Kontakt/IP-Rate-Limit manuell prüfen; Produktionsvariablen getrennt setzen; manuelles Vercel-Promote; erst nach Host-Prüfung DNS ändern | vorheriger Deployment-SHA bekannt; Health/Smoke grün; Domain-Routen und echte Kontaktzustellung geprüft; Instant Rollback verfügbar |
| 7. ViralSync-Release | App, API, Marketing und Docs nach eigenem Releaseplan | zuerst unveränderte lokale Änderungen erhalten; sauberer Worktree auf aktuellen Branch; exakte CI und dokumentierter API-Readiness-/Containment-Gate; `pnpm vs showcase` nur mit synthetischen Daten; Marketing/Docs-Release erst nach Bedingungen aus `docs/LAUNCH.md` | getrennte GO je Ziel; Privacy/Terms/Imprint und Registrierungs-/API-Gates erfüllt; exakte SHA und Rollback-IDs dokumentiert |

## GitHub-CLI-Vertrag

Implementierte Befehle und nächste geplante Schritte:

```text
pnpm ugur projects discover                                 # eigener gh-Account, nur lesen / Dry-Run
pnpm ugur projects discover --apply --stage dev             # expliziter Katalog-Sync, nur dev
pnpm ugur projects inspect <owner>/<repo>                   # Metadaten + begrenzte README-Evidenz, keine Speicherung
pnpm ugur projects draft <owner>/<repo> --slug <slug>        # Dry-Run; --apply legt genau einen lokalen Draft an
pnpm ugur projects check [<slug>]                            # geplant
pnpm ugur projects capture <slug> --url <freigegebene-demo-url> --apply # geplant
pnpm ugur projects status [--stage dev|prod]                 # geplant
```

`publish` darf keinen stillen Deploy auslösen: es bereitet einen reviewbaren MDX-Diff oder PR vor. Öffentliche GitHub-Authentifizierung wird aus der bereits angemeldeten `gh`-CLI gelesen; keine Tokens als Argument, Prozessumgebung oder Terminalausgabe. Nur öffentliche Repositories werden standardmäßig aufgelistet; private Repository-Metadaten werden intern gehalten und nie verlinkt. Fehlende Berechtigungen oder API-Fehler brechen den Vorgang sichtbar ab.

Für DB-Zugriff kommt ein neues Repository unter `packages/server/src/portfolio-catalog/` hinzu. Neue additive Tabellen erhalten stabile Quell-IDs, Fremdschlüssel, eindeutige Idempotenz-Constraints und keine rohen API-Payloads. Datenlöschung/Archivierung passiert nicht automatisch durch einen fehlgeschlagenen oder unvollständigen GitHub-Abruf.

## Medien- und Capture-Grenzen

- `pnpm vs showcase capture` ist für ViralSync-Marketingbilder mit isolierten synthetischen Daten bestimmt; es ist kein Capture aus Kunden- oder Produktionskonten.
- Die Portfolio-CLI darf keine beliebigen GitHub-Repositories klonen, installieren oder starten. Fremde Build-Skripte sind ausführbarer Code.
- Ein URL-Capture akzeptiert nur explizit freigegebene öffentliche HTTPS-Ursprünge; jeder Redirect wird erneut geprüft. Loopback, private Netze, Link-Local, Credentials und Query-Tokens sind ausgeschlossen.
- Captures landen zunächst außerhalb von `apps/site/public/`. Erst nach visueller und inhaltlicher Sichtung werden freigegebene Bilder mit Prüfsumme, Quellnachweis, Maßeinheit und Alt-Text übernommen.
- Ein Draft-Flag schützt keine statische Asset-Datei, die bereits unter `public/` liegt.

## Release-Freigaben und Stop-Kriterien

Die Owner-Anweisung umfasst das Ziel, Releases live zu bringen. Jeder tatsächliche Release bleibt trotzdem an den exakten SHA und die in den jeweiligen Repositories dokumentierten Gates gebunden. Keine direkte Änderung von `main`, kein Produktions-Promote aus einem Preview-Stand und keine Umstellung von Domains vor Smoke und Rollback-Vorbereitung.

Stop, wenn einer dieser Punkte zutrifft:

- Draft-Text oder Draft-Asset ist öffentlich oder nicht authentifiziert erreichbar.
- Projektfakten, Bildrechte, Datenschutzangaben oder Rechtsinhalte sind ungeprüft.
- GitHub-Import würde private Daten, README-Inhalte, Tokens, fremde Skripte oder nicht freigegebene Links publizieren.
- Migration ist nicht auf `dev` validiert oder Backup/Restore für die Zielumgebung nicht belegt.
- CI, Deployment-SHA, Site-/Portal-Smoke, Auth, Kontakt oder Datenbank-Readiness weichen ab.
- ViralSync-Produktionsregistrierung, API-Readiness oder Legal-Gates verletzen `docs/LAUNCH.md`.
- Ein verifizierter vorheriger Deployment-Stand als Rollback-Ziel fehlt.

## Nächste konkrete Schritte

1. Eine dedizierte Infisical-Verknüpfung für dieses Produkt bestätigen; danach Migration und idempotenten Katalog-Sync ausschließlich auf Neon `dev` ausführen.
2. Die neun gefundenen öffentlichen Repositories nach belegbaren Produkt-/Website-Bezügen priorisieren und pro Kandidat Rolle, Beitrag und Veröffentlichungsrechte bestätigen; keine Repo-Datei ist automatisch eine freigegebene Case Study.
3. Den Draft-Befehl mit einem ausdrücklich ausgewählten Kandidaten lokal ausführen, Inhalt redaktionell prüfen und fehlende Fakten vom Owner bestätigen lassen; noch keine automatische Kandidatenauswahl, kein Screenshot-Capture und keine Veröffentlichung.
4. Medien aus synthetischen ViralSync-Daten erfassen und freigegebene Portfolio-Bilder versionieren; externe URL-Captures erst nach SSRF-/Redirect-/Allowlist-Gates implementieren.
5. A2-Design-PR und Inhalte visuell, rechtlich und redaktionell abnehmen; ViralSync-Änderungen separat in einem erhaltenen Worktree prüfen.
6. Site/Portal erst nach exaktem SHA, CI, Preview-Smoke, Datenbank/Auth/Kontaktprüfung, Produktionskonfiguration und expliziter Produktionsfreigabe promoten. ViralSync folgt ausschließlich seinen eigenen LAUNCH-Gates.
