# Content- und Portfolio-Strategie

## Produktziel

Die Website soll anhand echter Arbeit zeigen, wie Ugur Özdamar Software konzipiert, baut und betreibt. Sie soll Projekte und berufliche Erfahrung greifbar machen, Kontakt ermöglichen und über alle Geräte glaubwürdig funktionieren.

## Zielseiten

| Route | Aufgabe |
| --- | --- |
| `/` | klare Positionierung, ausgewählte Projekte, Profil und Kontakt |
| `/projects` | vollständige, kuratierte Projektübersicht |
| `/projects/[slug]` | technische Case Study mit Problem, Rolle, Architektur, Entscheidungen und Ergebnis |
| `/work` (falls beibehalten) | entweder klare alternative Übersicht oder gezielte Weiterleitung; kein konkurrierendes Inhaltsmodell |
| `/about`, `/education` | konsistente Biografie und Laufbahn |
| `/blog` | echte technische Artikel; leere Zustände statt Hello-World-Platzhalter |
| `/contact` | zugängliche Kontaktoption mit nachweisbarer Zustellung |
| `/imprint`, `/privacy` | rechtlich gepflegte Informationen passend zum tatsächlichen Betrieb |

**Release-Blocker (12.10.2026):** Beide Seiten enthalten noch Platzhalter und sind nicht zur Veröffentlichung freigegeben. Vor dem Live-Release müssen die verantwortliche Person/Firma, ladungsfähige Anschrift, Kontaktweg, tatsächliche Hosting-/Datenverarbeitung, verwendete Dienste und Aufbewahrungsfristen vom Betreiber bestätigt und in passende Rechtstexte überführt werden. Diese Tatsachen werden nicht aus dem Code oder aus Annahmen erfunden.

Ob alle vorhandenen Routen erhalten bleiben, wird anhand Analytics/Links und Redirect-Bedarf entschieden. Es dürfen keine zwei konkurrierenden Projektwahrheiten entstehen.

## Inhaltsschema und Publish-Zustände

Jeder verwaltete Inhalt braucht mindestens: stabilen Slug, Titel, Kurzbeschreibung, Inhalt/Blöcke, Status, Veröffentlichungszeitpunkt, Aktualisierungszeitpunkt und Metadaten. Projekte erhalten zusätzlich Tags, Rolle/Beitrag, Tech-Stack, freigegebene Links und Medien mit Alt-Text. Pflichtfelder werden zentral validiert.

Zustände: `draft` (privat), `preview` (authentifiziert bzw. signiert und zeitlich begrenzt), `published` (öffentlich), optional `archived` (nicht indexiert). Der öffentliche Query-Pfad filtert auf `published`; fehlende DB-Verbindung aktiviert niemals versehentlich alle Datensätze.

## Single Source of Truth

Audit und lokaler Code zeigten gemischte Quellen: MongoDB für Projekte/Profil/Karriere, lokale MDX-Dateien für Blog und Projekt-Fallbacks sowie statischer Export für die Site. [ADR 0013](../architecture/decisions/0013-cms-content-and-server-rendering.md) legt nun eine Quelle je Inhaltsbereich fest:

- **Projekte, Profil, Karriere:** MongoDB/CMS ist die Quelle. Das Portal ist redaktioneller Schreibpfad; Entwürfe und als geheim markierte Projekte werden öffentlich nicht abgefragt.
- **Blog:** MDX in Git ist die Quelle. Änderungen laufen durch Review und Deploy; das Portal darf diese Einträge nicht unabhängig überschreiben.

Keine stillen Fallbacks zwischen Datenquellen. Projekt-MDX-Fallbacks und Demo-Inhalte sind aus dem öffentlichen Pfad entfernt. Eine CMS-Veröffentlichung ist auf der dynamisch gerenderten Site mit der nächsten Anfrage sichtbar.

Die Site nutzt serverseitiges Next.js statt `output: "export"`. Produktion benötigt `MONGODB_URI` zur Laufzeit. Netlify ist das kanonische Ziel; das Render-Blueprint ist eine Alternative mit eigener Konfiguration.

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
- CMS-Projekttexte sind nicht vertrauenswürdiger Inhalt und werden als Markdown ohne rohes HTML oder MDX-Ausdrücke gerendert. MDX-Ausführung ist ausschließlich für reviewte, Git-versionierte Blogdateien erlaubt.
- Design bleibt editorial und zurückhaltend; Fokus liegt auf realen Produkten, gut lesbarer Typografie und präziser Sprache.
- Navigation ist responsiv und tastaturbedienbar; Bewegung respektiert `prefers-reduced-motion`.
- Deutsch/Englisch wird nur zugesagt, wenn beide Fassungen aktuell und in der Navigation auffindbar sind.

## Veröffentlichung

Draft → Vorschau → Inhalts-/Linkprüfung → Freigabe → Publish → Cache-/Build-Aktualisierung → Routenprüfung. Jeder Schritt zeigt Erfolg oder Fehler; Publish gilt erst als abgeschlossen, wenn die öffentliche Revision erreichbar ist. Rollback auf vorherige Revision bleibt möglich.
