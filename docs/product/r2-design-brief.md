# R2-A — Editorial Engineering

> **Stand 19.10.2026:** Der Owner hat A1 (originales Logo, Header, dreizeilige Serif-Hero, Footer und lokal draft-markierte ViralSync-Beispielkarte) visuell freigegeben. Die Nachweise liegen unter [R2-A1](evidence/r2-a1/README.md). A2 vereinheitlicht die öffentlichen Unterseiten in einem ruhigen Editorial-System; A3 umfasst die anschließende Browser- und Accessibility-Abnahme. Die Freigabe gilt nicht für eine Veröffentlichung von ViralSync oder für einen Produktions-Promote.

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
- Keine Stock-Fotos, dekorativen Verläufe oder erfundenen Produkt-Screens. Echte Produkt-Screenshots bzw. Outputs aus dokumentierten synthetischen Demo-Szenarien sind möglich, wenn Herkunft und Preview-/Veröffentlichungsfreigabe pro Asset dokumentiert sind. Ohne freigegebene Medien bleiben Projektteaser textbasiert.
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

## Einheitliche öffentliche Seiten (A2)

Alle öffentlichen Routen verwenden dieselbe Seiten-Grammatik: konsistenter `.site-container`, ein sichtbarer H1-Titel, ein optionaler kurzer Vorspann, eine zurückhaltende Mono-Eyebrow, Token-Rahmen und eine gemeinsame vertikale Rhythmik. Die bestehende warme Neutralpalette sowie Playfair Display, Inter und JetBrains Mono bleiben unverändert. Die Seite vermeidet gefüllte Kartenraster, erfundene Medien und dekorative Verläufe.

- Startseite und `/projects` verwenden `ProjectCard` als gemeinsame Projektpräsentation. Die Startseite stapelt die ausgewählten Projekte auf schmalen und mittleren Viewports und wechselt erst bei ausreichender Breite zur Zweispaltenansicht. Aktionen bleiben am Kartenende ausgerichtet; Kartentitel folgen der jeweiligen Überschriftenebene. Optionale Daten und freigegebene Medien erscheinen nur, wenn sie vorhanden sind.
- Projekt- und Blogdetails nutzen die gemeinsame `ArticleShell`-Typografie. MDX-Prosa, Listen, Links, Blockzitate und Code orientieren sich an den Theme-Tokens und bleiben in Dark Mode lesbar.
- About, Education, Contact, Blog und Legal teilen dieselbe Seiteneinleitung und Inhaltsbreite, behalten aber ihre notwendigen Routenspezifika und Interaktionen.
- Leere Kataloge bleiben kompakt und ehrlich. Legal-Platzhalter werden sichtbar nicht als gültiger Rechtstext ausgegeben; vor Release sind die Tatsachen durch den Betreiber zu bestätigen.
- Drafts sind lokal und in Deployment-Protected Vercel-Previews sichtbar, werden nicht indexiert und geben keine externen Links aus. A1-Visuelfreigabe ändert diese Inhaltsgrenze nicht.
- Die lokalen und geschützten Vercel-Previews sollen für die Drafts ViralSync und Video Lab source-reviewed 16:9-Cover zeigen. In Produktion werden ihre Seiten und Karten weiterhin durch den Draft-Filter ausgeschlossen. Die Cover-Dateien liegen unter `public/` und sind deshalb selbst öffentlich abrufbare statische Assets; es dürfen dort ausschließlich die im Import-/Live-Plan dokumentierten, synthetischen und für Preview freigegebenen Bilder liegen. Sie sind keine Freigabe, das jeweilige Projekt oder dessen private Repository-URL zu veröffentlichen.

Die app-spezifischen, featureübergreifend genutzten Präsentationsbausteine `PageIntro`, `ArticleShell` und `ProjectCard` liegen in `apps/site/src/components/public/`. Feature-Ordner bleiben voneinander unabhängig; Home und Projektkatalog konsumieren dieselbe öffentliche Projektkarte.

Rollout: A1 visuell freigegeben; A2 Komponenten und Routendarstellung implementiert; A3 Browserprüfung bei 375/768/1440 px in beiden Themes sowie Fokus, mobiles Menü und Reduced Motion dokumentieren. Erst danach kann der PR zur visuellen Review vorgelegt werden. Diese Implementierung allein bestätigt keine Browser-QA und keine Produktionsfreigabe.
