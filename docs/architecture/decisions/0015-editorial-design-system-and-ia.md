# ADR 0015: Editorial-Designsystem, Informationsarchitektur und kanonische Projekthierarchie

- Status: accepted (Architektur und IA); visuelle Gestaltung durch Nachtrag R2-A.1 korrigiert
- Datum: 2026-10-12
- Beteiligte: Projektverantwortliche

## Kontext

Nach der R1.1-Codehärtung im weiterhin offenen Draft-PR #2 zeigte die öffentliche Website inhaltliche und visuelle Schwächen. R1-Produktionsblocker bleiben davon getrennt:
1. Eine zu allgemeine Positionierung („I build structured digital systems.“).
2. Überschneidende Routen und Bezeichnungen zwischen `/work` („Selected Work“) und `/projects` („All Projects“), die zu doppelten Komponenten und inkonsistenter Navigation führten.
3. App-spezifische UI-Elemente (`Header`, `Footer`, `Logo` mit persönlichem Branding) in `packages/ui` statt in `apps/site`.
4. Eine komplexe, client-seitige Startseiten-Galerie (`WorkClient`), die auf instabilem Array-Index-State basierte und auf `/favicon.ico` als Fallback zurückgriff.

## Entscheidung

1. **Kanonische Informationsarchitektur (IA):**
   - `/projects` ist der kanonische öffentliche Projekt- und Case-Study-Katalog.
   - Die Startseite bindet „Selected Work“ als kuratierte Sektion ein (`#work`).
   - Die Route `/work` leitet per Redirect dauerhaft auf `/projects` weiter; `/work/[slug]` leitet bereits auf `/projects/[slug]` weiter.
   - Die Hauptnavigation verlinkt **Projects** (`/projects`), **About** (`/about`), **Education** (`/education`), **Writing** (`/blog`) und **Contact** (`/contact`). Impressum und Datenschutz stehen zusätzlich im Footer.

2. **Editorial Engineering Designsystem:**
   - **Farbpalette:** Warmes Creme `#F4F1EB` (HSL `40 29% 94%`) als Hintergrund im Hellmodus, tiefes Anthrazit/Ink `#121212` für Schrift und Dunkelmodus; kontrollierte neutrale Akzente.
   - **Typografie:** Drei harmonische Schnitte via Fontsource: Playfair Display (markante Serifentitel), Inter (hochlesbare Sans-Serif-Fließtexte), JetBrains Mono (Metadaten, Labels, Tech-Badges).
   - **Fluid Typography:** Skalierung via `clamp()` für Display-, Titel- und Fließtextgrößen zur optimalen Darstellung von 320 px bis 1920 px.
   - **Grid & Rhythmus:** 12-spaltiges responsives Raster mit konsistentem vertikalen Rhythmus und feinen Haarlinien (`hairline-t`, `hairline-b`).

3. **Architekturgrenzen und Server Components:**
   - App-spezifische Navigation und Branding (`SiteHeader`, `SiteFooter`, `SiteLogo`) werden in `apps/site/src/features/navigation` verortet.
   - `packages/ui` bleibt auf generische Primitives (Buttons, Cards, Tags, Theme, Icons, Primitives) fokussiert.
   - Die Projektpräsentation auf der Startseite wird vorrangig in React Server Components (RSC) gerendert. Interaktive Steuerung nutzt stabile Keys (Slugs) anstelle von Array-Indizes.
   - Der problematische `/favicon.ico`-Bild-Fallback wird entfernt. Homepage-Teaser bleiben textbasiert, bis freigegebene Projektmedien vorliegen; fehlende Medien werden nicht als Produkt- oder Architekturvisualisierung simuliert.

4. **Authentische persönliche Positionierung:**
   - Die Copy bleibt bei bestätigten Angaben: Name, Software-/Full-Stack-Entwicklung und Standort Dortmund. Profil-, Karriere- und Bildungsdetails erscheinen nur nach CMS-Veröffentlichung.
   - Keine erfundenen Abschlüsse, Zertifikate oder Erfolgsmetriken.

## Alternativen

- Beibehaltung getrennter `/work`- und `/projects`-Seiten: Abgelehnt, da redundante Datenmodelle und Verwirrung für Besucher.
- Umstieg auf Tailwind-Vollframeworks oder SaaS-Templates: Abgelehnt, da die bestehende minimalistische Editorial-Identität erhalten und geschärft werden soll.

## Konsequenzen

- Klare Trennung von wiederverwendbaren UI-Primitives und anwendungsspezifischem Layout.
- Weniger Client-JavaScript auf der Startseite; Auswirkungen auf LCP/CLS werden erst nach Messung beurteilt.
- Navigation und Fokus-/Menüverhalten sind implementiert. Die Responsive-Matrix (320–1920 px), Browser-Smoke, Axe und die Escape-Prüfung des mobilen Menüs sind für den leeren lokalen Preview-Datenbestand dokumentiert; veröffentlichte CMS-Inhalte benötigen eine separate Inhaltsabnahme.

## Nachtrag R2-A.1 (2026-10-12)

Der Owner hat die visuelle R2-A-Gestaltung nicht freigegeben (Issue #8). Architekturgrenzen, kanonische Projekthierarchie und Server-Component-Entscheidungen bleiben gültig. Geändert wird:

- **Kontextpunkt 1 entfällt:** „I build structured digital systems.“ ist die bevorzugte Headline und Teil der Markenidentität; sie wird um eine konkrete Beschreibung ergänzt statt ersetzt.
- **Logo:** `apps/site/app/icon.svg` ist das kanonische Brand Asset. `apps/site/src/features/navigation/ui/BrandMark.tsx` bildet es inline ab; `tests/brand-mark.test.tsx` verhindert Abweichungen. Das Text-Monogramm „UÖ“ ist entfernt.
- **Hauptnavigation:** Projects, About, Contact. Education und Writing bleiben als Routen bestehen, stehen aber nicht in der Hauptnavigation, solange dort keine veröffentlichten Inhalte vorliegen.
- **Shell:** Header, Hero und Footer folgen der ursprünglichen Website (transparenter Header, dreizeilige Serifen-Headline mit linkem Schwerpunkt, einzeiliger Footer). Das 12-Spalten-Raster ist für den Hero nicht mehr maßgeblich.
- Die visuelle Freigabe erfolgt tranchenweise (A1 Shell, A2 Projekte, A3 Profil); grüne Gates ersetzen sie nicht.
