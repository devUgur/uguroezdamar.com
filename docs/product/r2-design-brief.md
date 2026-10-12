# R2-A — Editorial Engineering

> **Stand 12.10.2026:** Die visuelle R2-A-Gestaltung ist vom Owner **nicht freigegeben** (Issue #8). R2-A.1 entwickelt die ursprüngliche Website kontrolliert weiter (etwa 70 % alte Identität, 30 % neue Verbesserungen). Tranche A1 (Logo, Header, Hero, Footer) liegt zur visuellen Freigabe vor: [Nachweise](evidence/r2-a1/README.md). Aussagen dieses Dokuments zu Sektionen unterhalb des Heros beschreiben den R2-A-Stand und werden in A2/A3 überarbeitet.

## Zweck und Zielgruppen

Die Startseite soll Recruiter, technische Kolleginnen und Kollegen sowie mögliche Auftraggeber schnell zu veröffentlichten Projekten und Kontakt führen. Diese Gruppen beschreiben Zielgruppen, keine bestätigten Anfragen, Kunden oder Verfügbarkeiten.

## Bestätigte Fakten und öffentliche Copy

Bestätigte Fakten für diese Iteration: Ugur Özdamar, Software-/Full-Stack-Entwickler, Dortmund. Karriere-, Profil- und Bildungsangaben erscheinen nur, wenn sie im CMS veröffentlicht sind. Es werden keine Abschlüsse, Kunden, Erfolge, Verfügbarkeiten, Kennzahlen oder Projektdetails ergänzt, die nicht belegt und freigegeben sind.

Die Startseite verwendet seit R2-A.1 (A1) diese Copy:

- Headline: “I build structured digital systems.” (aus der ursprünglichen Website übernommen)
- Metazeile: “Full-stack developer — Dortmund, Germany”
- Beschreibung: “I design and build web applications end to end: React and TypeScript interfaces, the APIs and data models behind them, and the deployment that keeps them running.”
- Aktionen: “View projects” und “Get in touch”

Die R2-A-Headline “From interface to infrastructure.” wurde vom Owner nicht freigegeben und ist ersetzt.

Der Auftritt ist in dieser Iteration englischsprachig. Eine Übersetzung wird nicht zugesagt.

## Informationsarchitektur

| Route / Abschnitt | Aufgabe |
| --- | --- |
| `/` | Positionierung, bis zu drei veröffentlichte ausgewählte Projekte, Profil/Karriere, Ausbildung, Kontakt |
| `#work` | kurze, textbasierte Auswahl veröffentlichter, hervorgehobener CMS-Projekte |
| `/projects` | kanonischer Katalog aller öffentlichen Projekte |
| `/projects/[slug]` | Projektdetail |
| `/work` | dauerhafte Weiterleitung auf `/projects` |
| `/work/[slug]` | dauerhafte Weiterleitung auf `/projects/[slug]` |
| `/about`, `/education`, `/blog`, `/contact` | bestehende Inhalts- und Kontaktseiten |
| `/imprint`, `/privacy` | rechtliche Seiten; Inhalte bleiben Release-Blocker bis Betreiberangaben bestätigt sind |

## Gestaltung und Tokens

- Bestehende neutrale Farben bleiben erhalten: Hintergrund `#F4F1EB`, Oberfläche `#EAE6DF`, Ink `#121212`; im dunklen Theme Hintergrund `#121212`, Oberfläche `#1A1A1A`, Text `#F2F2F2`.
- Playfair Display prägt Überschriften, Inter Fließtext und JetBrains Mono kleine Metadaten. Die vorhandenen selbst gehosteten Fonts bleiben bestehen.
- Fluid Typografie mit `clamp()`, ein responsives 12-Spalten-Raster ab Desktop, Seitenränder über `.site-container`, Abschnitte über `.site-section` und feine Token-Rahmen strukturieren den Inhalt.
- Keine Verläufe, dekorativen Fotos oder synthetischen Produkt-/Architekturvisualisierungen. Ohne freigegebene Medien bleiben Projektteaser textbasiert.
- Bewegung ist dekorativ; `prefers-reduced-motion` reduziert Animationen und Übergänge.

## Komponenten- und Inhaltsregeln

- Das Logo ist das SVG aus `apps/site/app/icon.svg` (zugleich Favicon); `BrandMark` bildet es inline ab und wird per Test gegen die Datei geprüft. Ein Text-Monogramm ist kein Ersatz.
- Hauptnavigation: Projects, About, Contact — identisch auf Desktop und mobil. Footer: Contact, Imprint, Privacy.
- Marken- und Seitennavigation leben unter `apps/site/src/features/navigation`; `packages/ui` enthält app-neutrale UI-Primitives und Theme-Bausteine.
- Seiten, CMS-Abfragen und redaktionelle Homepage-Abschnitte sind Server Components. Nur Navigation, Theme-Wechsel und tatsächlich interaktive Formulare benötigen Client Components.
- Die Homepage liest ausschließlich öffentliche CMS-Projekte. Gezeigt werden Titel, veröffentlichte Kurzbeschreibung, vorhandene Jahresangaben und eingetragene Technologien. Das Datenmodell enthält kein belastbares Rollenfeld; Tags werden deshalb nicht als persönliche Rolle ausgegeben.
- Ein fehlender veröffentlichter Featured-Eintrag ergibt einen klaren leeren Zustand. Ein Platzhalterprojekt, Favicon oder erfundener Screenshot ist kein Fallback.
- Interaktive Ziele brauchen Tastaturfokus, Touch-Flächen und sinnvolle Linktexte. Skip-Link, mobiles Menü, Escape-Verhalten, Routenabschluss und Theme-Umschaltung bleiben erhalten.

## R2-A-Abnahme

Die responsive Prüfung umfasst 320, 375, 768, 1024, 1440 und 1920 px in hellem und dunklem Theme. Browser-Smoke, Screenshots, Axe und Tastaturprüfung sind vor Merge zu dokumentieren; ein Axe-Ergebnis allein ersetzt keine manuelle Prüfung. Die rechtliche und betriebliche Produktionsfreigabe bleibt von R2-A getrennt.
