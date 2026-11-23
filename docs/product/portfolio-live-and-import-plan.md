# Portfolio, GitHub-Import und Live-Release

**Stand:** 21.10.2026
**Zweck:** Umsetzung des einheitlichen Portfolio-Designs, eines sicheren Projekt-Import-/Medien-Workflows und der getrennten Live-Releases von uguroezdamar.com und viralsync.io.
**Status:** Portfolio-Site `3bc31aa` und Portal `f92be7d` laufen auf Vercel Production. PR #29 veröffentlichte ViralSync und Video Lab als Portfolio-Case-Studies. Das Site-Deployment `dpl_2eqo7YyeoscLwwZxirzPgY5ZFxru` wurde nach CI, Preview und vollständigem Staged-Smoke manuell promotet; Production besteht 24/24 Site- und 6/6 Portal-Prüfungen. Video Lab hat weiterhin keinen öffentlichen App-Link. ViralSync Marketing und Docs sind eigene Deployments mit separaten Produktions-Gates.

## Aktueller Ausführungsstand

Stand 21.10.2026: PRs #21, #22, #23 und #29 sind in `main` gemergt. Main-Commit `f92be7d` enthält Discovery, sichere Einzelprüfung, Draft-Generator mit Quellnachweis, Schutz gegen Cache-Kollisionen zwischen Preview und Produktion sowie die synthetischen Covers. PR #29 ergänzt die geprüften Case Studies, Canonicals und route-genauen Smoke-Prüfungen. Der frühere Commit `f92be7d` hatte grüne CI und bestand 19/19 allgemeine Smoke-Prüfungen; diese deckten die Projekt-Detailrouten noch nicht ab. Nach PR #29 ist Site-SHA `3bc31aa` manuell promotet und besteht den erweiterten Produktions-Smoke 24/24. Das unveränderte Portal besteht 6/6 auf `f92be7d`.

Die Infisical-Anmeldung für dieses Portfolio ist inzwischen erfolgreich abgeschlossen und der lokale CLI-Kontext dem Portfolio-Projekt zugeordnet; ViralSync bleibt in einem separaten CLI-Profil. `pnpm dev` startete die Site mit den Dev-Secrets erfolgreich. `pnpm ugur secrets audit` konnte Dev und Prod lesen; erforderliche Secrets sind vorhanden. Die Audit-Ausgabe meldet nur noch retired Variablen (`REVALIDATE_SECRET`, zusätzlich in Prod `SITE_URL`) und optionale, nicht gesetzte Variablen. Diese Werte wurden nicht gelöscht.

Die ausstehenden Migrationen wurden am 21.10.2026 auf Neon `dev` angewendet. Anschließend wurden neun eigene öffentliche Repositories synchronisiert und derselbe Sync erfolgreich wiederholt; die Implementierung nutzt einen Upsert auf die eindeutige GitHub-Repository-ID und löscht fehlende Datensätze nicht. Fehler-/Ratenlimitpfade sind noch separat zu prüfen. Vercel meldet Site-SHA `3bc31aa` und Portal-SHA `f92be7d`. Das Site-Deployment `dpl_2eqo7YyeoscLwwZxirzPgY5ZFxru` wurde nach bestandenem Staged-Smoke 24/24 manuell promotet; Site-Smoke auf `uguroezdamar.com` besteht ebenfalls 24/24, Portal-Smoke auf `portal.uguroezdamar.com` 6/6. Die geprüften DNS-Aliases laufen über Cloudflare DNS direkt zu Vercel. Der erweiterte Smoke prüft Projektkarten, Sitemap-Routen, Canonicals, Detailseiten, Cover-Assets und den ViralSync-Ziel-Link.

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

## Source-reviewed Preview-Cover für private Projekte

Die Änderungen ergänzen die lokalen Ansichten und durch Vercel Deployment Protection geschützten PR-Previews um 16:9-Cover für die bestehenden, weiterhin auf `draft: true` gesetzten Einträge ViralSync und Video Lab. Beide Bilder stammen aus ausdrücklich synthetischen Beispiel-Szenarien und wurden für die Portfolio-Vorschau zugeschnitten und als WebP optimiert:

| Portfolio-Draft | Interner Quellnachweis | Behandlung |
| --- | --- | --- |
| ViralSync | `viralsync.io` → `sites/marketing/public/product/calendar-month-light.png` (Healthy Life showcase calendar) | 16:9-Ausschnitt; synthetische Demo-Posts |
| Video Lab | `video-lab` → `artifacts/golden-recipe-influencer/contact-sheet.png` (golden-recipe synthetic scenario) | 16:9-Kontaktbogen aus den sechs vorhandenen Szenenabschnitten |

Portfolio-Kopien liegen unter `apps/site/public/projects/<slug>/`; validierte MDX-Alt-Texte beschreiben die sichtbaren Bilder und optionale sichtbare Bildunterschriften kennzeichnen die synthetischen Szenarien. Der persönliche E2E-Chat-Screenshot wurde nicht verwendet. Quellpfade und Repository-Namen bleiben ausschließlich in dieser internen Dokumentation und erscheinen nicht im gerenderten Portfolio. Die Cover-Dateien liegen unter `public/` und sind als statische Assets direkt abrufbar. Produktion filtert weiterhin die Draft-Seiten und -Karten heraus; daher dürfen in diesem Ordner nur die dokumentierten, synthetischen und für Preview freigegebenen Bilder liegen. Keine vertraulichen oder kundenbezogenen Medien dürfen dort abgelegt werden.

Die Aufnahme dieser zwei Sample-Bilder erlaubt ihre Sichtung lokal und im geschützten PR-Preview. Vor `draft: false` muss der Owner pro Projekt den vollständigen Text, die sichtbaren Demo-Marken und -Texte, Bildausschnitt, Alt-Text und alle externen Ziele ausdrücklich für Veröffentlichung freigeben. Cover-Aufnahme ist keine Projekt- oder Produktionsfreigabe. Deployment Protection des Vercel-PR-Previews ist Voraussetzung für die redaktionelle Draft-Prüfung; ein `noindex`-Tag oder unbekannte URL ersetzt den Zugangsschutz nicht.

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
| 1. Quellenvertrag | ADR 0021; additive `portfolio_github_repositories`-Tabelle getrennt von den stillgelegten CMS-Tabellen | Migration und Offline-Schema-Check sind lokal sauber; Migration auf Neon `dev` angewendet. Restore-/Migrationsprüfung und Fehlerpfade bleiben offen; keine Produktionsdatenänderung und kein doppelt geführter Publikationstext |
| 2. GitHub-Discovery/Import-CLI | `pnpm ugur projects discover` listet öffentliche Repositories, `--apply` synchronisiert nur nach Neon `dev`; `projects inspect <owner>/<repo>` bleibt gezielte read-only Prüfung | Neun öffentliche Repositories wurden nach Dev synchronisiert und der Upsert erneut ausgeführt. Fehler-/Rate-Limit-Verhalten bleibt zu verifizieren. Der öffentliche Discovery-Pfad enthält keine privaten Repositories. `inspect` ist auf öffentliche Metadaten und einen begrenzten README-Auszug des authentifizierten Owners beschränkt, persistiert nichts und führt keinen Repo-Code aus. ViralSync/Video Lab liegen als kuratierte, manuell geprüfte MDX-Drafts vor; ihre privaten Repositorys sind nicht Teil dieses automatischen Imports. |
| 3. Inhaltsentwurf und Vorschau | geprüfte Entwürfe ohne öffentliche Projektseiten | `projects draft` erstellt per Dry-Run oder lokalem `--apply` einen schema-validen Stub mit Quellrevision; README-Inhalte werden nie in MDX übernommen. Persönliche Aussagen, Beiträge und Projektergebnisse erfordern Owner-Bestätigung. Für ViralSync und Video Lab sind ausschließlich die dokumentierten synthetischen Preview-Cover unter `public/` freigegeben; weitere Draft-Medien bleiben außerhalb des öffentlichen Asset-Verzeichnisses. | Draft-Seiten/-Karten nicht in Production oder Sitemap; Draft-Seiten nicht indexierbar; Preview-Review nur mit Vercel Deployment Protection; statische Cover sind synthetische, direkt abrufbare Assets; jede Tatsachenbehauptung ist auf überprüfbare Quelle zurückzuführen |
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

- Draft-Text ist öffentlich oder ein Draft-Asset mit vertraulichen, kundenbezogenen oder nicht für öffentliche Abrufe freigegebenen Inhalten ist erreichbar. Die beiden dokumentierten synthetischen Preview-Cover sind die begrenzte Ausnahme; sie enthalten keine Projektquellpfade oder privaten Repository-Links.
- Projektfakten, Bildrechte, Datenschutzangaben oder Rechtsinhalte sind ungeprüft.
- GitHub-Import würde private Daten, README-Inhalte, Tokens, fremde Skripte oder nicht freigegebene Links publizieren.
- Migration ist nicht auf `dev` validiert oder Backup/Restore für die Zielumgebung nicht belegt.
- CI, Deployment-SHA, Site-/Portal-Smoke, Auth, Kontakt oder Datenbank-Readiness weichen ab.
- ViralSync-Produktionsregistrierung, API-Readiness oder Legal-Gates verletzen `docs/LAUNCH.md`.
- Ein verifizierter vorheriger Deployment-Stand als Rollback-Ziel fehlt.

## Nächste konkrete Schritte

1. Neon-Dev-Migration und wiederholter Katalog-Sync sind erledigt. Als Nächstes lesenden Katalogstatus ergänzen/prüfen und Fehler-, Rate-Limit- sowie Teilabrufverhalten des Imports abschließen.
2. Die neun gefundenen öffentlichen Repositories nach belegbaren Produkt-/Website-Bezügen priorisieren und pro Kandidat Rolle, Beitrag und Veröffentlichungsrechte bestätigen; keine Repo-Datei ist automatisch eine freigegebene Case Study.
3. ViralSync und Video Lab sind redigierte öffentliche Case Studies (`draft: false`). ViralSync verweist auf die bestehende Website; Video Lab bleibt als nicht gehostetes Projekt ohne Demo-Link gekennzeichnet. Beide synthetischen Covers sind in `public/` abrufbar und als solche dokumentiert.
4. Portfolio-Release R2 ist abgeschlossen: PR #29, Main-SHA `3bc31aa`, grüne CI, geschützte Site-Preview 24/24, Staged-Production-Smoke 24/24, Vercel-Promotion und öffentlicher Production-Smoke 24/24. Das Portal wurde getrennt auf seinem unveränderten SHA mit 6/6 geprüft. Die Verifikation ist dadurch routegenau statt nur ein allgemeiner Preflight.
5. Apex, `www` und `portal` sind bereits über Cloudflare-DNS auf Vercel gerichtet; Zertifikate und öffentliche Host-Smokes sind grün. Echter Kontaktversand, Portal-Login/Einladung, Datenschutz-/Rechtstexte, Betreiberangaben und Datenbank-Restore-Probe bleiben separate manuelle Release-Gates.
6. ViralSync Marketing und Docs sind ein getrennter Release. Der vorhandene Dev-Preflight prüft nur Worker-Bindings; die Produktionsrouten sind damit nicht belegt. Die aktuelle Produktionslücke ist in `docs/LAUNCH.md` dokumentiert. Vor einem gezielten Pages-Release müssen das dort festgehaltene Release-A-/Legal-Gate und der exact-SHA-Nachweis der Registrierungs-Containment-Policy erfüllt sein. Keine API-/Datenbank-Migration oder Registrierung wird über den Portfolio-Release ausgelöst.
