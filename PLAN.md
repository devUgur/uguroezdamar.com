# Projekt-Roadmap

> **Status:** Umsetzung Release R1 · **Grundlage:** Code- und Architektur-Audit vom 12.10.2026 sowie Abgleich mit dem lokalen Repository · **Letzte Pflege:** 12.10.2026

Diese Roadmap übersetzt die Audit-Befunde in eine umsetzbare Reihenfolge. Sie ist ein Arbeitsplan, kein Nachweis, dass die beschriebenen Probleme bereits behoben oder die Qualitätsziele erreicht sind. Die Audit-Zusammenfassung und die dauerhaft geltenden Engineering-Regeln liegen unter [`docs/`](docs/README.md).

## Zielbild

Ein zuverlässiges, sicheres und glaubwürdiges Entwicklerportfolio, das echte Arbeit zeigt und dessen Inhalte sicher veröffentlicht werden können. Die bestehende pnpm-/Turborepo-Monorepo-Basis mit Next.js, TypeScript und PostgreSQL wird zunächst stabilisiert. Es gibt keine geplante Neuentwicklung und keine Microservices.

Das Zielsystem besteht aus einer öffentlichen Portfolio-/Blog-Anwendung, einem geschützten Admin-Portal, klar begrenzten gemeinsamen Paketen und einer nachvollziehbaren Inhalts- und Release-Pipeline. Welche Laufzeit- und Inhaltsquelle langfristig gilt, wird anhand der dokumentierten Entscheidungskriterien beschlossen, bevor davon abhängige Umbauten starten.

## Priorität und Reihenfolge

| Reihenfolge | Phase | Ergebnis | Eintrittsbedingung |
| --- | --- | --- | --- |
| 0 | Verifizieren & stabilisieren | reproduzierbarer Baseline-Status, bekannte Produktionsrisiken eingegrenzt | lokale Gates, Mobile-Smoke und Axe-Prüfung grün; Hosting-Preview und freigegebene Rechtstexte offen |
| 1 | Security & CI-Fundament | Admin-Zugriffe abgesichert, Qualitätsprüfungen verlässlich | Implementierung, lokale Regression und GitHub-CI grün; unabhängige Prüfung offen |
| 2 | Content & Deployment | eine definierte Publish-Wahrheit und funktionsfähige öffentliche Routen | SSR/CMS-Umstellung lokal gebaut; Preview, Slug-Migration und Kontaktzustellung offen |
| 3 | Portfolio-Erlebnis | vollständige Navigation und hochwertige, belegbare Projektseiten | Phasen 1–2 abgeschlossen |
| 4 | Production Quality | messbare Qualitätsziele und verlässliche Betriebsabläufe | Kernfunktionen stabil |

Phasen dürfen nur dann parallel laufen, wenn ihre Abhängigkeiten und Daten-/Routenverträge stabil sind. Jede Änderung wird als kleiner, überprüfbarer PR umgesetzt. Für jede Phase gibt es ein eigenes Backlog; dieser Plan ersetzt keine Aufgaben- und PR-Beschreibung.

## Phase 0 — Verifizieren & stabilisieren

**Zweck:** Audit-Aussagen gegen den aktuellen Code und die tatsächlich betriebenen Umgebungen prüfen. Der Audit-Bericht hält fest, dass historische CI-Logs nicht verfügbar waren und kein vollständiger Browser-, Security- oder Performance-Lauf durchgeführt wurde.

**Arbeitspakete**

- CI-Fehler reproduzieren und aktuelle Logs sichern; Ursache pro fehlgeschlagenem Check dokumentieren.
- Produktionsrouten und Projektlinks mit Browser-Prüfung verifizieren, insbesondere `/projects`, `/projects/viralsync`, `/work`, Blog und Kontakt.
- Admin-Rollenänderung, Invite-Aktivierung, Passwortspeicherung, Session-Validierung und Upload-Berechtigungen entlang der echten Request-Flows nachverfolgen.
- Hosting-Konfiguration, Build-Ausgabe, Kontaktzustellung und Datenbank-Verfügbarkeit für Produktion feststellen.
- Beispiel-/Platzhalterinhalte (`my-project.mdx`, `first-post.mdx`, CMS-Fallbacks) inventarisieren und entscheiden, ob sie entfernt, ersetzt oder ausdrücklich als Demo gekennzeichnet werden.

**Abnahme**

- Befunde sind mit Codepfad, Umgebung, Reproduktionsschritten und Schweregrad belegt oder ausdrücklich als unbestätigt markiert.
- Ein reproduzierbarer lokaler Baseline-Lauf für Install, Lint, Typecheck, Tests und Build ist dokumentiert; bestehende lokale Änderungen sind nicht Teil dieses Plans.
- Vor jedem Produktions-Publish ist bekannt, ob Kontaktformular und Admin-Portal tatsächlich funktionieren.

## Phase 1 — Security & CI-Fundament

**Zweck:** Sicherheitsrisiken vor weiterer Feature-Arbeit schließen und Qualitätsprüfungen zur Merge-Bedingung machen.

**Arbeitspakete**

1. Serverseitige Rollen-/Berechtigungsprüfung zentralisieren. Rollenänderungen nur für explizit autorisierte Akteure erlauben; Selbst-Hochstufung und unzulässige Owner-Änderungen durch Negativtests abdecken.
2. Passwortspeicherung auf einen geeigneten adaptiven Passwort-Hasher umstellen (Audit-Empfehlung: Argon2id). Bestehende Hashes sicher migrieren oder kontrolliert zurücksetzen; alte Hashes erst nach abgesicherter Migration entfernen.
3. Bootstrap-/Invite-Geheimnisse vom normalen Login entkoppeln. Login, Invite-Aktivierung, Session-Lebensdauer, Cookie-Flags, Rate Limits und Fehlerantworten als zusammenhängenden Ablauf prüfen.
4. Upload-Endpunkte serverseitig autorisieren und Typ, Größe, Dateinamen, Speicherziel sowie Zugriff prüfen.
5. Alle Workspace-Pakete und App-Quellbereiche linten. Platzhalter-Skripte durch echte Checks ersetzen; Tests in CI aufnehmen. Architektur-Guards bleiben als eigene, schnelle Qualitätsbarriere bestehen.
6. CI-Trigger und Deploy-Abhängigkeit festlegen: kein Produktions-Deploy bei fehlgeschlagenem Pflicht-Check.

**Abnahme**

- Rollen- und Authentifizierungs-Negativtests belegen, dass nicht autorisierte Änderungen abgelehnt werden.
- Passwortmigration ist rückwärts kompatibel oder besitzt einen dokumentierten sicheren Reset-Pfad.
- Lint, Typecheck, Unit-/Integrationstests, Guards und Build laufen reproduzierbar lokal und in CI.
- Build- und Deploy-Pipeline veröffentlicht keine unvalidierte Änderung.

## Phase 2 — Content & Deployment

**Zweck:** Eine eindeutige Wahrheit darüber herstellen, welcher Inhalt veröffentlicht ist und wie er die öffentliche Website erreicht.

**Entscheidung:** [ADR 0013](docs/architecture/decisions/0013-cms-content-and-server-rendering.md) legt das CMS für Portfolio-Daten und serverseitiges Next.js fest; die Datenbank ist seit [ADR 0016](docs/architecture/decisions/0016-postgres-neon-infisical-cli.md) PostgreSQL auf Neon. Produktion läuft bei Render ([ADR 0018](docs/architecture/decisions/0018-render-hosting.md)). Blogartikel bleiben Git-/MDX.

**Arbeitspakete nach Entscheidung**

- Projekt-, Karriere-/Profil- und Blog-Inhalte mit klaren Eigentümern und Schemata abbilden; veröffentlichte Inhalte, Entwürfe und Vorschauen eindeutig trennen.
- Datenbank-/MDX-Fallbacks entfernen, sofern sie nicht bewusst als dokumentierter Import- oder Notfallpfad gebraucht werden. Fallbacks dürfen nie unveröffentlichte oder Demo-Inhalte stillschweigend öffentlich machen.
- Publish-Ablauf mit Validierung, Vorschau, Veröffentlichung, Cache-Invalidierung/Rebuild, Fehlerbehandlung und Rollback definieren.
- Slugs kanonisieren und alte URLs gezielt weiterleiten oder mit einer echten 404 beantworten.
- Kontaktformular-Endpunkt kompatibel zur gewählten Hosting-Laufzeit betreiben; Zustellung speichern/übermitteln und Fehler sichtbar behandeln. Datenschutz, Spam-Schutz und Aufbewahrung festlegen.
- Öffentliche Demo-Datensätze und Platzhalter-Inhalte löschen oder durch freigegebene Inhalte ersetzen.

**Abnahme**

- Eine veröffentlichte Änderung wird im festgelegten Zeitfenster zuverlässig öffentlich sichtbar; Entwürfe bleiben privat.
- Build/Deploy, Vorschau und Rollback sind dokumentiert und reproduzierbar.
- Alle verlinkten Projekt- und Kontaktpfade liefern erwartete Statuscodes und Inhalte.
- Keine nicht freigegebenen Platzhalter, privaten Projektdetails oder vertraulichen Arbeitgeberinformationen erscheinen öffentlich.

## Phase 3 — Portfolio-Erlebnis

**Zweck:** Die technische Arbeit überzeugend und überprüfbar präsentieren, ohne die vorhandene Editorial-/Minimal-Richtung unnötig zu ersetzen.

**Arbeitspakete**

- Responsive Desktop- und Mobilnavigation vervollständigen; Produktion-Links, Fokuszustände, Tastaturbedienung und reduzierte Bewegung berücksichtigen.
- Einheitliches Projekt-/Case-Study-Template mit Problem, Rolle, Architektur, Entscheidungen, konkreten Beiträgen, belegbaren Ergebnissen und Grenzen erstellen.
- Veröffentlichungsfähige Case Studies für ViralSync, Video Lab und Pebblewick vorbereiten. Da die Repositories privat sind, vor Veröffentlichung Inhalte, Kennzahlen, Screenshots und Codeausschnitte ausdrücklich freigeben.
- Projekt- und Work-Routen vereinheitlichen. Inhalte als validiertes Markdown/MDX mit sicherer Komponentenliste statt als Rohtext-Block rendern.
- Startseite auf klare Positionierung, ausgewählte Projekte, Kompetenzschwerpunkte und Kontakt ausrichten; Profil, Karriere, Education und Blog konsistent verknüpfen.
- Design-Tokens und UI-Grenzen nach tatsächlichem Bedarf bereinigen. `packages/ui` soll keine Server-/Datenbanklogik oder Admin-Session kennen; Extraktionen in neue Pakete nur bei belegter Wiederverwendung.

**Abnahme**

- Navigation und Haupt-User-Flows funktionieren auf Mobilgerät und Desktop mit Tastatur und Screenreader-Grundlagen.
- Jede hervorgehobene Projektseite ist vollständig, authentisch, freigegeben und ohne Platzhalter.
- Case-Study-Routen, interne Links, Bilder und leere Zustände funktionieren konsistent.

## Phase 4 — Production Quality

**Zweck:** Release-Risiko über automatisierte Prüfungen und beobachtbaren Betrieb weiter reduzieren.

**Arbeitspakete**

- Playwright-E2E-Checks für öffentliche Kernrouten, Kontaktablauf, Admin-Login, Berechtigungen und Publish-Ablauf ergänzen.
- Accessibility-Prüfungen (z. B. axe) und Lighthouse-/Core-Web-Vitals-Budgets in CI integrieren, nachdem die Basis stabil ist.
- Sitemap, robots-Regeln, kanonische URLs, Open Graph, strukturierte Daten und Metadaten auf die tatsächlichen veröffentlichten Inhalte abstimmen.
- Fehler-/Verfügbarkeitsüberwachung und minimale Betriebsalarme einrichten; PII und Geheimnisse aus Logs ausschließen.
- Backup-/Restore-Probe, Abhängigkeitspflege, Secrets-Rotation, Incident- und Rollback-Ablauf dokumentieren.

**Abnahme**

- Pflicht-E2E- und Accessibility-Checks laufen in CI; kritische Fehler verhindern einen Release.
- Performance-Grenzen werden auf repräsentativen Seiten gemessen und eingehalten oder Abweichungen sind als akzeptierte Ausnahme dokumentiert.
- Restore und Rollback wurden praktisch geprobt; Verantwortlichkeit und Alarmweg sind klar.

## Querschnittsregeln

- Bestehende Architektur gezielt verbessern; keine Komplettneuschreibung, kein Microservice-Split und keine zusätzliche Abstraktion ohne konkreten Nutzen.
- Serverseitige Datenzugriffe bleiben server-only. UI und Verträge importieren keine Implementierungsdetails aus Datenbank oder Admin-Auth.
- Validierung erfolgt an Vertrauensgrenzen; Autorisierung wird serverseitig für jede geschützte Aktion geprüft.
- Geänderte Inhalte und Architekturverträge erhalten passende automatisierte Prüfungen. Tests werden dort ergänzt, wo Verhalten oder Risiko es verlangen.
- Keine vertraulichen Werte in Repository, Dokumentation, Fixtures, Screenshots oder Logs. Secrets liegen ausschließlich in Infisical ([docs/operations/secrets.md](docs/operations/secrets.md)).
- ADRs dokumentieren Entscheidungen, die spätere Änderungen teuer machen; sie ersetzen keine Umsetzung oder Verifikation.

## Launch-Entscheidung

Ein öffentlicher Relaunch erfolgt erst, wenn Phase 1 und 2 abgenommen sind, kritische öffentliche Routen geprüft wurden und Phase 3 keine Platzhalter mehr enthält. Der Audit-Zielwert „9/10“ wird nicht als Launch-Gate verwendet: Freigabe basiert auf konkreten Sicherheits-, Inhalts-, Funktions- und Betriebsnachweisen.

## Arbeitsstatus

| Phase | Status | Nächster konkreter Schritt |
| --- | --- | --- |
| 0 — Verifizieren & stabilisieren | lokale Gates, Mobile-Smoke und Axe-Prüfung grün | Hosting-Preview, Kontaktzustellung und Live-Deploy bleiben zu verifizieren |
| 1 — Security & CI-Fundament | umgesetzt; lokale und GitHub-CI-Nachweise grün | unabhängige Prüfung offen |
| 2 — Content & Deployment | SSR/CMS lokal umgesetzt; CMS- und Rate-Limit-Integration ergänzt; Preview und Betreiberangaben offen | Render-Inventar für beide Dienste verifizieren (Typ, Deploy-Branch, Auto-Deploy), Secret Sync aus Infisical einrichten; Preview-Commit-SHAs, isolierte DB/Accounts, Slug-Datenmigration, Kontaktaufbewahrung/-benachrichtigung sowie bestätigte Impressums-/Datenschutzangaben bleiben Release-Blocker |
| Plattform — Datenbank und Secrets | MongoDB-Cluster existiert nicht mehr. Datenschicht auf PostgreSQL/Drizzle umgestellt, Tests gegen PGlite, Secrets-Manifest und `pnpm ugur`-CLI nach viralsync-Vorbild vorhanden (ADR 0016). Infisical-Projekt verknüpft, Neon-Branches `dev` und `prod` provisioniert und migriert, Owner-Konto in `dev`; Site und Portal gegen `dev` geprüft. Konsolidiert im Draft-PR #9, CI grün. Regeln auf `AGENTS.md` reduziert, Hosting als Render festgehalten (ADR 0018), Doku-Drift per Test abgesichert | Render-Inventar und Abgleich mit `render.yaml`; Secret Sync aus Infisical; Preview-Dienst gegen `dev`; Owner-Konto in `prod`; Client-Adresse des Kontakt-Endpunkts hinter Render klären; Restore-Probe auf Neon; alte lokale `.env`-Dateien löschen; R2-Schlüssel rotieren; Inhalte neu erfassen |
| Plattform — Entwicklungsworkflow | Pakete source-first ohne `tsup`/`dist`, `pnpm dev` startet nur die Site, Tests ohne Vorab-Build, pnpm-Catalog, Guard für Paketgrenzen (ADR 0017); lokale Gates und beide Produktionsbuilds grün | GitHub-CI für `f60a1a4` grün. `Ctrl+C`-Shutdown und Browser-Hot-Reload interaktiv bestätigen |
| Plattform — Inhalte | Projekte, Profil und Werdegang als Dateien im Repository, Inhaltsseiten statisch (ADR 0019); Entwürfe für ViralSync und Video Lab angelegt, nur lokal sichtbar | Owner liefert Profil, Rolle, Beiträge, Zeiträume und Screenshots und gibt die Texte frei; danach `draft: false`. CMS-Rückbau: alte Tabellen erst nach Backup und Restore-Test in eigenem PR löschen, R2-Token widerrufen, `pnpm ugur secrets prune --apply` |
| Plattform — Hosting | Vercel (ADR 0020): zwei Projekte über `pnpm ugur hosting` eingerichtet, beide Umgebungen mit Variablen. `main` (`e8e9239`) als Produktions-Deployment gebaut, nicht freigegeben; Smoke-Lauf dagegen bestanden (19 von 19, Datenbank `prod`) | Erst Inhalte: Impressum und Datenschutz, mindestens ein veröffentlichtes Projekt, Profil. Dann Login und Kontakt von Hand prüfen, *Promote*, DNS umstellen, Render kündigen |
| 3 — Portfolio-Erlebnis | R2-A technisch umgesetzt, visuell vom Owner **nicht freigegeben** (Issue #8). R1- und R2-Branch sind lokal in `main` zusammengeführt. R2-A.1/A1 (Original-Logo, Header, Hero, Footer) umgesetzt; lokale Gates grün; Nachweise unter `docs/product/evidence/r2-a1/` | Visuelle Freigabe A1 durch den Owner; danach A2 (echte Projekte, ViralSync-Case-Study, DB-Fehler von leerem Zustand trennen) und A3 (Profil, Skills, Education). Kein Produktions-Deploy vor R1-Gates und Rotation der offengelegten Zugangsdaten |
| 4 — Production Quality | geplant | nach stabiler Kernfunktion Messwerte und E2E-Scope festlegen |

## Weiterführende Dokumentation

- [Dokumentationsindex und Dokumentationsregeln](docs/README.md)
- [Architekturübersicht und Grenzen](docs/architecture/README.md)
- [Security-Baseline](docs/security/README.md)
- [Qualitätssicherung und CI](docs/engineering/quality.md)
- [Abhängigkeiten und Laufzeiten](docs/engineering/dependency-matrix.md)
- [Content- und Portfolio-Strategie](docs/product/content-and-portfolio.md)
- [Betrieb, Release und Recovery](docs/operations/release-and-recovery.md)
- [Audit-Zusammenfassung vom 12.10.2026](docs/audits/2026-10-12-code-and-architecture-audit.md)
