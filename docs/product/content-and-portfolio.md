# Content- und Portfolio-Strategie

## Produktziel

Die Website soll anhand echter Arbeit zeigen, wie Ugur Özdamar Software konzipiert, baut und betreibt. Sie soll Projekte und berufliche Erfahrung greifbar machen, Kontakt ermöglichen und über alle Geräte glaubwürdig funktionieren.

## Zielseiten

| Route | Aufgabe |
| --- | --- |
| `/` | klare Positionierung, ausgewählte Projekte, Profil und Kontakt |
| `/projects` | kanonische, kuratierte Projektübersicht und Case Studies (ADR 0015) |
| `/projects/[slug]` | technische Case Study mit Problem, Rolle, Architektur, Entscheidungen und Ergebnis |
| `/work` | Weiterleitung (308/Redirect) auf `/projects`; kein konkurrierendes Inhaltsmodell |
| `/about`, `/education` | konsistente Biografie und Laufbahn |
| `/blog` | echte technische Artikel; leere Zustände statt Hello-World-Platzhalter |
| `/contact` | zugängliche Kontaktoption mit nachweisbarer Zustellung |
| `/imprint`, `/privacy` | rechtlich gepflegte Informationen passend zum tatsächlichen Betrieb |

**Release-Blocker:** Vor einem öffentlichen Relaunch müssen die verantwortliche Person/Firma, ladungsfähige Anschrift, Kontaktweg, tatsächliche Hosting-/Datenverarbeitung, verwendete Dienste und Aufbewahrungsfristen vom Betreiber bestätigt und in passende Rechtstexte überführt werden. Diese Tatsachen werden nicht aus dem Code oder aus Annahmen erfunden.

Der Kontaktendpunkt speichert aktuell Name, E-Mail-Adresse, Nachricht und Zeitstempel in PostgreSQL ohne automatische Löschfrist. Für das Rate-Limit wird ein HMAC-basierter, zeitlich begrenzter IP-Schlüssel verwendet, der nach ungefähr 70 Minuten per TTL entfernt wird. Beide Datenflüsse sowie die bestätigte Aufbewahrungsregel müssen in der Datenschutzerklärung zutreffend abgebildet werden.

Die kanonische URL für alle Projekte ist `/projects`. Die Route `/work` leitet auf `/projects` weiter, um bestehende Links bruchlos aufzunehmen (ADR 0015). Es gibt keine zwei konkurrierenden Projektwahrheiten.

## R2-A: Startseite und redaktionelle Darstellung

Der aktuelle Homepage-Fluss lautet: bestätigte Positionierung und Standort → bis zu drei veröffentlichte Featured-Projekte → veröffentlichte Profil-/Karrieredaten → veröffentlichte Bildungseinträge → Kontaktseite. Seit A1 lautet die freigegebene Headline „I build structured digital systems.“; die erklärende Copy bleibt auf Full-Stack-Softwareentwicklung bezogen. Zielgruppen wie Recruiter oder Auftraggeber sind Designannahmen und keine Aussage über vorhandene Kunden, Angebote oder Verfügbarkeit.

`/projects` ist die einzige öffentliche Projektübersicht. Die Startseite verlinkt auf diesen Katalog und zeigt nur veröffentlichte Featured-Datensätze. Sie gibt vorhandene Titel, Kurzbeschreibungen, Jahreswerte und Technologien aus. Das aktuelle Projektschema enthält kein persönliches Rollenfeld; Tags dürfen nicht als persönliche Rolle umetikettiert werden. Nicht freigegebene Screenshots, synthetische Browser-/Terminal-Mockups und Favicon-Fallbacks werden nicht gezeigt. Ohne Featured-Datensatz zeigt die Startseite einen klaren leeren Zustand.

Die Startseitenabschnitte sind Server Components. App-spezifische Navigation und Branding liegen in `apps/site/src/features/navigation`, generische UI- und Theme-Primitives in `packages/ui`. Das Styling bewahrt die bestehenden warmen neutralen Themes und Fonts und nutzt Fluid-Typografie, responsive 12-Spalten-Komposition, sichtbare Fokuszustände und Reduced-Motion-Regeln. Die Nav führt zu Projects, About, Education, Blog und Contact; Imprint und Privacy sind im Footer erreichbar. Die englische Copy dieser Iteration ist keine Zusage einer Übersetzung.

Die vorangegangene R2-A-Abnahme lieferte lokale Lint-, Typecheck-, Build- und Browser-Nachweise für den damaligen Stand; sie belegt nicht automatisch diesen späteren A2-Änderungsstand. A1 ist visuell vom Owner freigegeben; die Nachweise stehen unter [R2-A1](evidence/r2-a1/README.md). A2 benötigt eigene Browser-/Accessibility-Evaluation vor Merge. Die Datenquelle für Projekte, Profil, Werdegang und Blog ist Git/MDX; es gibt keine veröffentlichte CMS-Inhaltsquelle. Die Produktions- und Rechtsfreigabe bleibt separat.

## Inhaltsschema und Publish-Zustände

Jeder verwaltete Inhalt braucht mindestens: stabilen Slug, Titel, Kurzbeschreibung, Inhalt/Blöcke, Status, Veröffentlichungszeitpunkt, Aktualisierungszeitpunkt und Metadaten. Projekte erhalten zusätzlich Tags, Rolle/Beitrag, Tech-Stack, freigegebene Links und Medien mit Alt-Text. Pflichtfelder werden zentral validiert.

Zustände: `draft` (privat), `preview` (authentifiziert bzw. signiert und zeitlich begrenzt), `published` (öffentlich), optional `archived` (nicht indexiert). Der öffentliche Query-Pfad filtert auf `published`; fehlende DB-Verbindung aktiviert niemals versehentlich alle Datensätze.

## Single Source of Truth

Die Portfolio-Inhalte haben eine eindeutige Quelle:

- **Projekte, Profil, Werdegang:** Dateien im Repository sind die Quelle ([ADR 0019](../architecture/decisions/0019-content-from-git.md)): `apps/site/content/projects/<slug>.mdx` und `apps/site/content/profile.ts`. Änderungen laufen durch Pull Request und Deployment. Ein Projekt mit `draft: true` ist nur lokal sichtbar; externe Projektlinks werden in Draft-Vorschauen nicht ausgegeben.
- **Blog:** MDX in Git ist die Quelle. Änderungen laufen durch Review und Deploy.

Keine stillen Fallbacks zwischen Datenquellen. Ein ungültiger Inhalt lässt Build und Tests scheitern. Ein vorhandenes, leeres Inhaltsverzeichnis ergibt eine leere Sammlung; fehlende Verzeichnisse und sonstige Dateisystemfehler bleiben sichtbare Fehler. Abschnitte ohne Inhalt entfallen auf der Startseite, statt einen Platzhalter zu zeigen.

Die Site nutzt serverseitiges Next.js statt `output: "export"`. Hosting und Laufzeitkonfiguration sind in [ADR 0020](../architecture/decisions/0020-vercel-hosting.md) sowie den Betriebsdokumenten festgelegt.

## Case-Study-Vorlage

1. **Kurzfassung:** Was ist das Produkt und für wen?
2. **Ausgangslage:** Welches Problem wurde gelöst?
3. **Rolle:** Was wurde persönlich entworfen, implementiert oder betrieben?
4. **Systementwurf:** Diagramm, Datenfluss, wichtige Grenzen.
5. **Entscheidungen:** mindestens eine Herausforderung, Alternativen und Konsequenzen.
6. **Ergebnis:** belegbare technische oder Produktwirkung; keine erfundenen Kennzahlen.
7. **Learnings und Grenzen:** Was funktioniert, was blieb offen?
8. **Nachweise:** freigegebene Screenshots, Demo, Doku oder öffentlicher Quellcode.

ViralSync, Video Lab und Pebblewick können Kandidaten sein. Ihre Repositories sind privat; vor öffentlicher Darstellung sind Screenshots, technische Details, Kennzahlen und Markenmaterial auf Freigabe zu prüfen. Keine vertraulichen Arbeitgeberdetails veröffentlichen.

## Redaktionelle und UX-Qualität

- Jeder öffentliche Link zeigt auf eine existierende Route oder eine bewusst definierte Weiterleitung.
- Platzhalter, Demo-Projekte und Hello-World-Artikel gehören nicht in den Produktionskatalog.
- Bilder haben aussagekräftige Alt-Texte und sind für die Auslieferung optimiert.
- Projekt- und Blogtexte sind reviewte, Git-versionierte MDX-Dateien; nur solche werden als MDX ausgeführt. Inhalte aus anderen Quellen dürfen nicht durch diese Pipeline laufen.
- Design bleibt editorial und zurückhaltend; Fokus liegt auf realen Produkten, gut lesbarer Typografie und präziser Sprache.
- Navigation ist responsiv und tastaturbedienbar; Bewegung respektiert `prefers-reduced-motion`.
- Deutsch/Englisch wird nur zugesagt, wenn beide Fassungen aktuell und in der Navigation auffindbar sind.

## Veröffentlichung

Draft → Vorschau → Inhalts-/Linkprüfung → Freigabe → Publish → Cache-/Build-Aktualisierung → Routenprüfung. Jeder Schritt zeigt Erfolg oder Fehler; Publish gilt erst als abgeschlossen, wenn die öffentliche Revision erreichbar ist. Rollback auf vorherige Revision bleibt möglich.
