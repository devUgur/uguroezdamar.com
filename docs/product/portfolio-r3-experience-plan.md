# Portfolio R3 — Ladezeit, Interaktion und Lokalisierung

**Status:** R3.1–R3.4 umgesetzt und auf Production promotet; manuelle Assistenzgeräte-Abnahme und Felddatenvergleich offen · **Owner:** Ugur Özdamar · **Stand:** 21.10.2026

Dieser Plan ergänzt [R2 Editorial Engineering](r2-design-brief.md) und den operativen [Portfolio-/Live-Plan](portfolio-live-and-import-plan.md). Die Portfolio-Case-Studies für ViralSync und Video Lab sind bereits auf der Portfolio-Production veröffentlicht. Dieser Plan beschreibt die nächste Qualitätsschicht; er ändert keine Freigabe für die eigenständigen ViralSync- oder Video-Lab-Produkte.

## Ziele und Gestaltungsgrundsätze

- Die erste Ansicht zeigt Text ohne externe Font-Verbindung und mit möglichst wenig Layout-Verschiebung.
- Bewegung unterstützt Orientierung, bleibt sparsam und respektiert `prefers-reduced-motion`, Touch-Eingaben und Tastaturbedienung.
- Deutsch und Englisch erhalten gleichwertige, indexierbare URLs und vollständig übersetzte öffentliche Inhalte; ein UI-Schalter allein gilt nicht als Lokalisierung.
- Case Studies zeigen nur belegte Fakten und freigegebene Medien. Drafts bleiben aus Produktion, Sitemap und Suchmaschinen ausgeschlossen.
- Qualität wird auf echten Produktions-/Preview-Routen und an realen Messwerten beurteilt, nicht aus einem erfolgreichen Build abgeleitet.

## Phasen, Abhängigkeiten und Abnahme

| Phase | Umfang | Abnahme |
| --- | --- | --- |
| R3.1 — Schrift und Bewegungsbudget | Lokale WOFF2-Assets über `next/font/local`; nur LCP-relevante Schnitte vorladen. Maus-Ring nur auf Hover-/Fine-Pointer-Geräten, native Maus bleibt sichtbar, keine Schleife im Leerlauf, reduzierte Bewegung wird respektiert. | Build enthält lokale Font-Assets und passende Preloads; kein Font-Provider-Request; visuelle Prüfung auf Desktop, Touch, Keyboard und Reduced Motion. LCP/CLS vorher und nachher mit demselben Messaufbau vergleichen. |
| R3.2 — zweisprachige Routen | Bestehende englische URLs bleiben unverändert; Deutsch liegt unter `/de/...`. Separate statische Root-Layouts liefern `lang="en"` bzw. `lang="de"`; Sprachumschaltung erhält den äquivalenten Seitenkontext. | Jede öffentliche Route hat eine echte Übersetzung oder führt bei nicht übersetzten Artikeln auf die Sprachübersicht zurück; keine englische Seite wird als deutsche Alternative ausgegeben. |
| R3.3 — redaktionelle Übersetzung | Homepage, About, Education, Contact, Blog-UI, Projektkarten und beide Case Studies manuell lokalisieren. Blogbeiträge haben ein getrenntes `content/blog/de/`; Sprachvarianten müssen redaktionell vorhanden sein. Zeiträume und Alt-Texte folgen der Sprache. | Inhaltliche Review beider Sprachen, interne Links und Meta-Titel korrekt, keine Inhalte aus Draft-MDX. Rechtstexte bleiben deutlich als unvollständig gekennzeichnet und benötigen Betreiber-/Rechtsprüfung. |
| R3.4 — visuelle und barrierefreie Abnahme | Screenshots und Tastatur-/Accessibility-Tree-Prüfung bei 375, 768 und 1440 px in beiden Themes; Cursor, Navigation und reduzierte Bewegung prüfen. | Automatisierte Route-/Axe-Prüfung, Fokus-/Skip-Link-, Mobile-Menü-, Reduced-Motion- und responsive Prüfungen sind dokumentiert. Kein horizontaler Overflow oder Axe-Verstoß. Ein dekorativer Pfeil erzeugt eine nicht anwendbare Kontrast-Review. Physischer Screenreader-/Touch-Geräte-Durchlauf bleibt als manuelle Restprüfung offen. |
| R3.5 — Veröffentlichung | PR-Preview prüfen, CI abwarten, exakten Commit gegen Staging-Smoke prüfen, Merge per PR, danach manuell die Site-Production promoten und Smoke erneut ausführen. | Erfüllt für Main-SHA `d9430a8f83e5a1a61124cff2be497c1843ae996d`: Apex und `www` liefern denselben geprüften Commit; Staging, Apex und www jeweils 88/88. Deployment-ID und URL sind dokumentiert. |

## R3.1 Rollout-Nachweis

- Main-Commit: `9997735b98fe841eda9e346595843b9603be96b9` (Feature-PR #31 und sicherer CLI-Releasepfad aus PR #32).
- Production-Deployment: `dpl_B5qqvyhTbQ3TvSvTHSLHtdng7J3a` (`https://uguroezdamar-d6dr4itfz-devugur1s-projects.vercel.app`), manuell promotet nach erfolgreichem Staged-Smoke.
- Site-Smoke `--commit 9997735…`: 24/24 auf Staging, `https://uguroezdamar.com` und `https://www.uguroezdamar.com`.
- Gebautes HTML enthält Same-Origin-WOFF2-Preloads für Inter und Playfair Display; im gebauten HTML/CSS wurden keine Google-Font-Hosts gefunden. Core Web Vitals wurden noch nicht im Feld verglichen.
- PR #31 CI: Lint, Migrationen, Typecheck, 87 Tests sowie Site-/Portal-Build grün. Site-/Portal-Previews grün. Das unveränderte Portal wurde nicht promotet.

## R3.2–R3.5 Rollout und Abnahme

- PR #34 liefert deutsche Route-/Content-Fassungen; PR #36 korrigiert die Titel-Linkziele der deutschen Projektkarten und ergänzt eine Regression im Smoke.
- R3.3-Korrektur: Production-Deployment `dpl_hPBZ8coY9LBBhZ1x3TJHA7d4hSQE` auf Main-SHA `5d53b5fb404ad92894b48e1ad178c4e27d0b516b`; Apex und `www` bestanden jeweils 88/88.
- R3.4 Accessibility-Fix: PR #38 lokalisiert den Theme-Schalter (`Toggle theme` / `Darstellung wechseln`). Feature-SHA `764981d09e7feb53190538a5246e7c664a672b03`; `pnpm check` (88 Tests) und `pnpm build` waren grün.
- Aktueller Production-Stand: Main-SHA `d9430a8f83e5a1a61124cff2be497c1843ae996d`, Deployment `dpl_DN1BHE9L81mdAri1Yjbz6E6zMmGj` (`https://uguroezdamar-1ezetniqu-devugur1s-projects.vercel.app`). Nach Promotion bestehen der Staged-Smoke, Apex und `www` jeweils 88/88 mit Commit-Prüfung.
- Accessibility: 20 öffentliche Routen in Light und 12 zentrale Routen in Dark wurden automatisiert geprüft; Axe meldete null Verstöße. Auf Home/Deutsch markiert Axe jeweils eine manuelle Kontrastprüfung für einen dekorativen Pfeil ohne Text. Skip-Link und sichtbarer Fokus funktionieren; Escape schließt das deutsche mobile Menü; der Cursor-Halo ist bei `prefers-reduced-motion` ausgeblendet. Deutschsprachiger Theme-Schalter wurde live im Accessibility Tree als „Darstellung wechseln“ bestätigt.
- Responsive-Check für `/`, `/projects`, `/de/projects` und `/de` bei 375, 768 und 1440 px: kein horizontaler Überlauf. Screenshots beider Themes und Größen liegen lokal unter `C:\Users\uoezd\.codex\visualizations\2026\10\21\portfolio-r3-a11y\` und sind keine versionierten Release-Artefakte.
- Browser-Lab ohne Netzwerk-/CPU-Drosselung: Home EN LCP 152–208 ms, Home DE 164–228 ms, Katalog EN 152–272 ms, Katalog DE 160–184 ms; CLS jeweils 0. TTFB-Stichproben: Home EN 11.8–14.9 ms, Home DE 12.4–14.4 ms, Katalog EN 13.5–41.3 ms, Katalog DE 12.8–17.8 ms. INP wurde mangels Interaktion nicht erhoben. Diese headless Einzelmaschinen-Lab-Werte sind weder Feld-Core-Web-Vitals noch ein gedrosselter Lighthouse-Vergleich.

## Technische Entscheidungen

- Die Schriftfamilien bleiben Inter, Playfair Display und JetBrains Mono. Assets werden im Repository unter `apps/site/app/fonts/` mit Lizenzhinweis gepflegt. `next/font/local` generiert Deployment-lokale Dateien und Preload-Tags; nicht alle Familien werden global vorab geladen.
- Der Cursor-Ring ist eine optionale dekorative Ebene. Er ersetzt weder Pointer-Feedback noch Fokusindikatoren und ist bei Touch oder reduzierter Bewegung ausgeblendet.
- Lokalisierung nutzt URL-Pfade als Quelle der Wahrheit. Die Sprachpräferenz darf beim Aufruf von `/` berücksichtigt werden, überschreibt aber keine explizite `/en`- oder `/de`-Route.
- Projektdaten bleiben MDX in Git (ADR 0019). Für mehrsprachige Fallstudien muss das Content-Schema explizite locale-spezifische Inhalte unterstützen oder pro Sprache eine Datei führen; Übersetzungen dürfen nicht aus dem jeweils anderen Text automatisch geraten werden.
- Der bisherige Projektkatalog und die Case Studies sind in Produktion sichtbar. Die öffentliche Website zeigt ViralSync/Video Lab als Portfolio-Cases; ein Case-Study-Link belegt keine Laufzeit oder öffentliche Demo des eigenständigen Video-Lab-Produkts.
- Die deutsche Site nutzt `apps/site/app/(de)/layout.tsx` als statisches Root-Layout und `/de`-Routen; der englische Bestand nutzt `apps/site/app/(en)/layout.tsx` und behält seine URLs. Der Sprachpfad ist die Quelle der Wahrheit und wird nicht per Cookie oder Browserheader umgedeutet.
- Wegen der zwei Root-Layouts nutzt die app-eigene 404-Seite Next.js `experimental.globalNotFound`; sie leitet `lang` anhand des expliziten URL-Präfixes ab, lädt dieselben lokalen Schriften und ist `noindex`. Beim Next.js-Upgrade muss diese experimentelle Konfiguration erneut gegen die dann aktuelle Routing-API geprüft werden.
- Deutsche Case Studies liegen parallel in `apps/site/content/projects/de/<slug>.mdx`; dieselbe Schema-Validierung und Draft-Filterung gelten für beide Sprachen. Neue Blogübersetzungen liegen in `apps/site/content/blog/de/` und werden nur dann als `hreflang`-Paar ausgezeichnet, wenn beide Fassungen existieren.
- Die Profildaten liegen pro Sprache separat (`apps/site/content/profile.ts` und `profile.de.ts`). Ein englischer Profiltext wird nicht stillschweigend auf deutschen Seiten verwendet; fehlende Übersetzungen bleiben ausgeblendet.
- Sitemap-Einträge umfassen nur veröffentlichte Projekte und existierende Blogbeiträge. Locale-Paare enthalten `en`/`de`-Alternates; Canonical und Sprache des Dokuments sind je Route festgelegt.

## Offene Freigaben und externe Voraussetzungen

- Vor Lokalisierungs-Release müssen Übersetzungen der realen Projekttexte redaktionell bestätigt werden.
- `/privacy` und `/imprint` enthalten weiterhin erkennbare Platzhalter. Betreiberangaben und Datenschutztext müssen vor einer rechtlich vollständigen Veröffentlichung durch den Owner bestätigt werden; eine Übersetzung ist kein Ersatz dafür.
- Die Marketing-Seite und das Portal haben getrennte Deployment-/Smoke-Pfade. Dieser R3-Plan betrifft nur `apps/site`.
- Die eigenständigen ViralSync-/Video-Lab-Produktionen haben eigene Laufzeit-, Routing-, Inhalts- und Rechtsgates im [Live- und Importplan](portfolio-live-and-import-plan.md).

## Messung

Vorher/Nachher-Messungen erfolgen auf demselben Gerät, Netzwerkprofil, Browser und URL. Berichtet werden LCP, CLS, INP, übertragene Font-Bytes, Font-Requests und die konkrete Commit-/Deployment-ID. Ein lokaler Build bestätigt weder reale Netzwerklatenz noch Core Web Vitals im Feld.

### Produktions-Schnappschuss 21.10.2026

- Der HTML-Response der Startseite war 48.429 Bytes im einmaligen `Invoke-WebRequest`-Abruf. Eine getrennte einzelne `curl`-Messung meldete 86 ms TTFB; diese Einzelmessungen sind keine Web-Vitals und kein reproduzierbarer Lab-Vergleich.
- Das gebaute HTML lädt vier same-origin WOFF2-Schnitte vor (Inter 400/700 und Playfair Display 400/700), insgesamt 93.100 Bytes. Die Font-Dateien stammen aus dem Deployment; im HTML wurden keine externen Font-Anbieter gefunden.
- Die aktuellen LCP-/CLS-Stichproben stehen im R3.4-Rollout oben. Sie sind nicht gedrosselt und nicht mit dem früheren Einzel-TTFB-Schnappschuss vergleichbar. INP und reale Felddaten fehlen; PSI war zuvor wegen Tagesquote `0` mit HTTP 429 nicht verfügbar.
- Nächster Schritt: einmal einen reproduzierbaren Lighthouse-Lauf auf Staging und Production mit gleichem Gerät-/Netzwerkprofil ausführen und, wenn reale CrUX-/Search-Console-Daten verfügbar sind, als getrennte 28-Tage-Percentile dokumentieren. Danach Optimierung nur anhand eines belegten Engpasses. Keine zusätzliche Analytics-Telemetrie ohne Produkt-/Datenschutzentscheidung.
