# Portfolio R3 — Ladezeit, Interaktion und Lokalisierung

**Status:** R3.1 implementiert und auf Production promotet; Performancevergleich und visuelle Detailabnahme offen · **Owner:** Ugur Özdamar · **Stand:** 21.10.2026

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
| R3.2 — zweisprachige Routen | `/en/...` und `/de/...` mit stabilen Gegenstücken, Englisch als Default bei `/`, explizite Sprachumschaltung pro Seite; Dictionary für UI, locale-spezifische Metadata, Canonicals, `hreflang`, sitemap und 404. Bestehende englische URLs bleiben per Redirect erreichbar. | Jede öffentliche Route hat eine gleichwertige Übersetzung oder ist ausdrücklich ohne Sprachwechsel gekennzeichnet; Umschalten erhält den passenden Seitenkontext; Sitemap enthält nur veröffentlichte Sprachvarianten und Projekte. |
| R3.3 — redaktionelle Übersetzung | Homepage, About, Education, Contact, Blog-UI, Projektkarten und beide Case Studies manuell lokalisieren. Datums-/Zahlenformat und Alt-Texte folgen der Sprache. | Inhaltliche Review beider Sprachen, interne Links und Meta-Titel korrekt, keine Inhalte aus Draft-MDX. Rechtstexte erst nach Betreiber-/Rechtsprüfung übersetzen und freigeben. |
| R3.4 — visuelle und barrierefreie Abnahme | Screenshots und Tastatur-/Screenreader-Prüfung bei 375, 768 und 1440 px in beiden Themes; Cursor und Navigation mit Bewegungsvorgaben prüfen. | Keine abgeschnittene Copy, stabile Mediengrößen, sichtbarer Fokus, sinnvolle Sprache des Dokuments und korrekte Alternativtexte. Ergebnisse mit Commit und URL ablegen. |
| R3.5 — Veröffentlichung | PR-Preview prüfen, CI abwarten, exakten Commit gegen Staging-Smoke prüfen, Merge per PR, danach manuell die Site-Production promoten und Smoke erneut ausführen. | Release-URL/Commit dokumentiert; Apex und `www` liefern dieselben geprüften Routen; Rollback-Referenz festgehalten. |

## R3.1 Rollout-Nachweis

- Main-Commit: `9997735b98fe841eda9e346595843b9603be96b9` (Feature-PR #31 und sicherer CLI-Releasepfad aus PR #32).
- Production-Deployment: `dpl_B5qqvyhTbQ3TvSvTHSLHtdng7J3a` (`https://uguroezdamar-d6dr4itfz-devugur1s-projects.vercel.app`), manuell promotet nach erfolgreichem Staged-Smoke.
- Site-Smoke `--commit 9997735…`: 24/24 auf Staging, `https://uguroezdamar.com` und `https://www.uguroezdamar.com`.
- Gebautes HTML enthält Same-Origin-WOFF2-Preloads für Inter und Playfair Display; im gebauten HTML/CSS wurden keine Google-Font-Hosts gefunden. Core Web Vitals wurden noch nicht im Feld verglichen.
- PR #31 CI: Lint, Migrationen, Typecheck, 87 Tests sowie Site-/Portal-Build grün. Site-/Portal-Previews grün. Das unveränderte Portal wurde nicht promotet.

## Technische Entscheidungen

- Die Schriftfamilien bleiben Inter, Playfair Display und JetBrains Mono. Assets werden im Repository unter `apps/site/app/fonts/` mit Lizenzhinweis gepflegt. `next/font/local` generiert Deployment-lokale Dateien und Preload-Tags; nicht alle Familien werden global vorab geladen.
- Der Cursor-Ring ist eine optionale dekorative Ebene. Er ersetzt weder Pointer-Feedback noch Fokusindikatoren und ist bei Touch oder reduzierter Bewegung ausgeblendet.
- Lokalisierung nutzt URL-Pfade als Quelle der Wahrheit. Die Sprachpräferenz darf beim Aufruf von `/` berücksichtigt werden, überschreibt aber keine explizite `/en`- oder `/de`-Route.
- Projektdaten bleiben MDX in Git (ADR 0019). Für mehrsprachige Fallstudien muss das Content-Schema explizite locale-spezifische Inhalte unterstützen oder pro Sprache eine Datei führen; Übersetzungen dürfen nicht aus dem jeweils anderen Text automatisch geraten werden.
- Der bisherige Projektkatalog und die Case Studies sind in Produktion sichtbar. Die öffentliche Website zeigt ViralSync/Video Lab als Portfolio-Cases; ein Case-Study-Link belegt keine Laufzeit oder öffentliche Demo des eigenständigen Video-Lab-Produkts.

## Offene Freigaben und externe Voraussetzungen

- Vor Lokalisierungs-Release müssen Übersetzungen der realen Projekttexte redaktionell bestätigt werden.
- `/privacy` und `/imprint` enthalten weiterhin erkennbare Platzhalter. Betreiberangaben und Datenschutztext müssen vor einer rechtlich vollständigen Veröffentlichung durch den Owner bestätigt werden; eine Übersetzung ist kein Ersatz dafür.
- Die Marketing-Seite und das Portal haben getrennte Deployment-/Smoke-Pfade. Dieser R3-Plan betrifft nur `apps/site`.
- Die eigenständigen ViralSync-/Video-Lab-Produktionen haben eigene Laufzeit-, Routing-, Inhalts- und Rechtsgates im [Live- und Importplan](portfolio-live-and-import-plan.md).

## Messung

Vorher/Nachher-Messungen erfolgen auf demselben Gerät, Netzwerkprofil, Browser und URL. Berichtet werden LCP, CLS, INP, übertragene Font-Bytes, Font-Requests und die konkrete Commit-/Deployment-ID. Ein lokaler Build bestätigt weder reale Netzwerklatenz noch Core Web Vitals im Feld.
