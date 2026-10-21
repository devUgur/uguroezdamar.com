# Projekt-Roadmap

> **Status:** Portfolio-Projektseiten Release-Kandidat in Umsetzung · **Grundlage:** Code- und Architektur-Audit vom 12.10.2026 sowie nachfolgende Architekturentscheidungen · **Letzte Pflege:** 21.10.2026

Diese Roadmap übersetzt die Audit-Befunde in eine umsetzbare Reihenfolge. Sie ist ein Arbeitsplan, kein Nachweis, dass die beschriebenen Probleme bereits behoben oder die Qualitätsziele erreicht sind. Die Audit-Zusammenfassung und die dauerhaft geltenden Engineering-Regeln liegen unter [`docs/`](docs/README.md).

## Zielbild

Ein zuverlässiges, sicheres und glaubwürdiges Entwicklerportfolio, das echte Arbeit zeigt und dessen Inhalte sicher veröffentlicht werden können. Die bestehende pnpm-/Turborepo-Monorepo-Basis mit Next.js, TypeScript und PostgreSQL wird zunächst stabilisiert. Es gibt keine geplante Neuentwicklung und keine Microservices.

Das Zielsystem besteht aus einer öffentlichen Portfolio-/Blog-Anwendung, einem geschützten Admin-Portal, klar begrenzten gemeinsamen Paketen und einer nachvollziehbaren Inhalts- und Release-Pipeline. Gültige Architekturentscheidungen legen Git/MDX als Quelle für Portfolio-Inhalte fest (ADR 0019) und Vercel als Hosting für Site und Portal (ADR 0020).

## Priorität und Reihenfolge

| Reihenfolge | Phase | Ergebnis | Eintrittsbedingung |
| --- | --- | --- | --- |
| 0 | Verifizieren & stabilisieren | reproduzierbarer Baseline-Status, bekannte Produktionsrisiken eingegrenzt | lokale Gates, Mobile-Smoke und Axe-Prüfung grün; Hosting-Preview und freigegebene Rechtstexte offen |
| 1 | Security & CI-Fundament | Admin-Zugriffe abgesichert, Qualitätsprüfungen verlässlich | Implementierung, lokale Regression und GitHub-CI grün; unabhängige Prüfung offen |
| 2 | Content & Deployment | eine definierte Publish-Wahrheit und funktionsfähige öffentliche Routen | SSR/CMS-Umstellung lokal gebaut; Preview, Slug-Migration und Kontaktzustellung offen |
| 3 | Portfolio-Erlebnis | vollständige Navigation und hochwertige, belegbare Projektseiten | Phasen 1–2 abgeschlossen |
| 4 | Production Quality | messbare Qualitätsziele und verlässliche Betriebsabläufe | Kernfunktionen stabil |

Phasen dürfen nur dann parallel laufen, wenn ihre Abhängigkeiten und Daten-/Routenverträge stabil sind. Jede Änderung wird als kleiner, überprüfbarer PR umgesetzt. Für jede Phase gibt es ein eigenes Backlog; dieser Plan ersetzt keine Aufgaben- und PR-Beschreibung.

Der ausführbare Detailplan für Portfolio-Design, GitHub-Projektimport, Medien/Drafts sowie getrennte Site-/ViralSync-Releases steht in [Portfolio, GitHub-Import und Live-Release](docs/product/portfolio-live-and-import-plan.md). Dieser Detailplan hält auch die konkreten Preview-, Datenbank- und Produktionsgates fest.

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

**Entscheidung:** Portfolio-Projekte, Profil und Werdegang liegen als Git/MDX bzw. TypeScript vor (ADR 0019); Blogartikel bleiben MDX in Git. PostgreSQL auf Neon dient den verbleibenden dynamischen Funktionen (ADR 0016). Site und Portal laufen als getrennte Vercel-Projekte (ADR 0020). Die früheren CMS-/Render-Annahmen aus ADR 0013 und ADR 0018 sind ersetzt.

**Arbeitspakete nach Entscheidung**

- Projekt- und Profiländerungen über Schema-validierte Dateien und Pull Requests pflegen; unverifizierte Projekte als lokale Drafts halten.
- Sicherstellen, dass fehlende Inhalte, leere Inhaltsverzeichnisse und Dateisystemfehler unterscheidbar bleiben; keine stillen Datenquellen-Fallbacks.
- Vercel-Preview je Pull Request prüfen und den manuellen Produktions-Promote als getrennte Freigabe dokumentieren.
- Slugs kanonisieren und alte URLs gezielt weiterleiten oder mit einer echten 404 beantworten.
- Kontaktformular-Endpunkt kompatibel zur gewählten Hosting-Laufzeit betreiben; Zustellung speichern/übermitteln und Fehler sichtbar behandeln. Datenschutz, Spam-Schutz und Aufbewahrung festlegen.
- Öffentliche Demo-Datensätze und Platzhalter-Inhalte löschen oder durch freigegebene Inhalte ersetzen.

**Abnahme**

- Eine Inhaltsänderung ist durch Schema und Pull Request reviewbar; Drafts sind weder in Produktionsbuilds noch in der Sitemap.
- Build/Preview, manuelle Produktionsfreigabe und Rollback sind dokumentiert und reproduzierbar.
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
| 0 — Verifizieren & stabilisieren | Site und Portal bestehen den historischen 19-Punkte-Smoke auf Production-Aliases und öffentlichen Domains; Apex, `www` und `portal` liefern Vercel aus. Der erweiterte Smoke hat jetzt konkrete Projekt-Routen; der derzeitige Production-SHA enthält die beiden Projektseiten noch nicht. | Den erweiterten Smoke nach Merge und Promote gegen den exakten Production-SHA vollständig bestehen lassen; Kontaktzustellung, Owner-Login und Datenbank-Restore-Probe bleiben manuell |
| 1 — Security & CI-Fundament | umgesetzt; lokale und GitHub-CI-Nachweise grün | unabhängige Prüfung offen |
| 2 — Content & Deployment | Portfolio-Inhalte sind Git/MDX (ADR 0019); Site und Portal aus Main-Commit `f92be7d` laufen auf Vercel. Apex, `www` und `portal` lösen über Cloudflare-DNS auf Vercel auf. Die Case Studies sind im Release-Kandidaten ausgefüllt und auf `draft: false` gesetzt; Produktion zeigt sie erst nach Merge und Promotion. | Geschützte Vercel-Preview auf Text, Demo-Kennzeichnung, Karten, Bilder, Mobile und Canonicals prüfen; danach exakten Main-SHA promoten und den erweiterten Production-Smoke ausführen. Video Lab besitzt weiterhin keine öffentliche App-Demo |
| Plattform — Datenbank und Secrets | PostgreSQL/Drizzle auf Neon mit Infisical (ADR 0016); `doctor --stage prod` findet alle Pflicht-Secrets. Vercel erwartet für Site und Portal passende Variablennamen in Preview und Production. Audits melden nur ausgemusterte Namen und optionale Admin-Overrides. | Datenbank-Restore-Probe offen. Ausgemusterte Portfolio-Schlüssel nach Dry-Run und Bestätigung der Stilllegung je Stage entfernen; danach beide Audits wiederholen. Keine Produktions-Secrets übertragen oder ausgeben |
| Plattform — Entwicklungsworkflow | Pakete source-first ohne `tsup`/`dist`, pnpm-Catalog und Guard für Paketgrenzen (ADR 0017). `pnpm dev` startete die Site erfolgreich mit injizierten Dev-Secrets; Infisical-Profil `uguroezdamar` ist an dieses Repository gebunden | Dev-Portal separat starten und Entwicklungsworkflow dokumentieren; keine Secrets in Dateien übernehmen |
| Plattform — Inhalte | Projekte, Profil und Werdegang sind Dateien im Repository (ADR 0019); PR #23 ergänzte Neon-Importkatalog und Draft-Generator. Der Owner hat die öffentliche Aufnahme von ViralSync und Video Lab angefordert; Case-Study-Rollen und Beiträge sind belegt formuliert, private Repositories werden nicht verlinkt, synthetische Cover sind beschriftet. | Protected-Preview auf endgültige Copy und visuelle Darstellung prüfen. Danach nur die beiden freigegebenen Einträge veröffentlichen; nicht gehostete Produkte erhalten keinen erfundenen Live-Link |
| Plattform — Hosting | Vercel (ADR 0020): getrennte Site-/Portal-Projekte; manuelle Production-Promotion; Profil- und Kontogrenzen dokumentiert. Am 21.10. sind Apex, `www` und `portal` auf Vercel verifiziert; Zertifikate und Domain-Smoke sind grün. | Bei späteren Änderungen DNS-only beibehalten und Domain-Smoke nach Deployments ausführen. Kein Cloudflare-Proxy vor Vercel |
| 3 — Portfolio-Erlebnis | A1 am 19.10.2026 visuell vom Owner freigegeben; A2 nutzt einheitliche Projektkarten und Detailseiten. ViralSync und Video Lab sind im Release-Kandidaten veröffentlicht und mit expliziten Statusangaben versehen. Das bisherige Production-Deployment enthält sie noch nicht; Video Lab hat keine öffentliche App-Demo. | Kandidaten-Preview auf Mobil-/Desktopansicht prüfen; nach Promotion müssen beide Karten, Detailseiten, Canonicals, Cover und Sitemap im CLI-Smoke bestehen. Für eine spätere Video-Lab-App separate Hosting-/Runtime-/Secret-/Datenstrategie erstellen |
| Portfolio — GitHub-Katalog | PR #23 ist in `main` gemergt; Discovery, sichere Einzelprüfung, privater Neon-Metadatenkatalog und lokaler Draft-Generator sind implementiert. Main `f92be7d` hat grüne CI, beide Production-Smokes bestanden und ist promotet. | Neon-Dev-Migration angewendet; neun öffentliche Repositories zweimal synchronisiert. Upsert über eindeutige GitHub-ID; fehlende Datensätze werden nicht gelöscht. Fehler-/Rate-Limit-Pfade weiter prüfen. Öffentliche Case Studies bleiben an Fakten- und Owner-Freigabe gebunden. |
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
