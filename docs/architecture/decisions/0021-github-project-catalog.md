# ADR 0021: GitHub-Projektkatalog als Importquelle

- Status: proposed
- Datum: 2026-10-19
- Beteiligte: Projektverantwortliche
- Ergänzt: [ADR 0019](0019-content-from-git.md)

## Kontext

Das Portfolio soll vorhandene GitHub-Projekte per `pnpm ugur` auffinden und für die spätere redaktionelle Bearbeitung erfassen können. Gleichzeitig legt ADR 0019 Git/MDX als alleinige Quelle veröffentlichter Projekttexte fest. Ein zweites, zur Laufzeit lesendes CMS würde erneut doppelte Inhaltswahrheit, Datenbankabhängigkeit und einen komplexen Publish-Vertrag schaffen.

GitHub-Repository-Inhalte sind nicht automatisch geeignete Portfolio-Texte. README-Dateien, Issues, Quellcode, private Metadaten und Build-Skripte dürfen weder ungeprüft publiziert noch im Importprozess ausgeführt werden.

## Entscheidungsvorschlag

1. Ein neues, internes Neon-Modell `portfolio_github_repositories` hält ausschließlich kuratierbare Quellmetadaten: stabile GitHub-Repository-ID, Owner/Name, Sichtbarkeit, Beschreibung, Website-URL, Topics, Default-Branch, Fork-/Archivstatus, Remote-Updatezeit und Discovery-/Sync-Zeitpunkte.
2. Der Katalog ist getrennt von den stillgelegten CMS-Tabellen `projects`, `profiles` und `career_entries`. Er speichert keine README-, Issue-, Datei- oder API-Rohpayloads und keine veröffentlichungsfähigen Case-Study-Texte.
3. `pnpm ugur projects discover` ist standardmäßig read-only. `--apply` darf nur auf `dev` schreiben; Produktionssynchronisierung erhält einen eigenen späteren Freigabeschritt.
4. GitHub-CLI-Authentifizierung wird aus der vorhandenen `gh`-Sitzung bezogen. Es werden ausschließlich eigene öffentliche Repositories entdeckt. Private Repositories brauchen einen expliziten, separat dokumentierten internen Ablauf und werden nie als öffentliche Links ausgegeben.
5. Wiederholte Discovery ist idempotent und überschreibt keine redaktionellen Inhaltsfelder. Fehlschläge oder unvollständige Abrufe archivieren oder löschen keine Datensätze.
6. Ein separater Import kann später einen MDX-Draft und einen reviewbaren Branch/PR vorbereiten. Nur ein bestätigter Content-PR mit `draft: false` veröffentlicht auf der Site.
7. Screenshot-/Capture-Funktionen sind ein eigener Schritt. Discovery startet, klont oder installiert keine Repositorys und ruft keine Projekt-URLs ab.

## Alternativen

- **Vollständige Portfolio-Texte in Neon:** widerspricht ADR 0019 und erzeugt zwei Content-Wahrheiten; abgelehnt.
- **GitHub live bei jedem Seitenaufruf:** koppelt Verfügbarkeit, Cache und Datenschutz der Website an GitHub; abgelehnt.
- **README automatisch als Case Study übernehmen:** Texte sind nicht freigegeben, können private oder unzutreffende Aussagen enthalten und sind MDX-/HTML-Eingaben; abgelehnt.
- **Repositories klonen und starten, um Screenshots zu erzeugen:** führt nicht vertrauenswürdigen Code aus; abgelehnt.

## Konsequenzen

- Der Portfolio-Katalog enthält nur interne Importmetadaten; die Website liest ihn nicht.
- Schema und Migration werden additiv angelegt. Die alten CMS-Tabellen bleiben vom Import unberührt und folgen weiter ihren Backup-/Restore-Gates aus PR #14.
- CLI-Ausgaben dürfen weder GitHub-Tokens noch DB-URLs oder vollständige Fehlerpayloads enthalten.
- Für öffentliche Projektlinks bleiben `apps/site/content/projects/*.mdx`, die `repositoryVisibility`-Validierung und eine Owner-Prüfung maßgeblich.
- `--stage prod`, Löschen, Veröffentlichung, private Repository-Verarbeitung und URL-Capture sind nicht Teil des ersten Discovery-Releases.

## Verifikation und Rückprüfung

Die vorgeschlagene Entscheidung wird beim Review der gestapelten CLI-/Schema-PR bestätigt. Der erste Apply wird nur auf Neon `dev` gegen öffentliche Repositories ausgeführt und auf Idempotenz, Pagination, Rate-Limit-Fehler, Umbenennung und Archivierung geprüft. Eine Revision ist nötig, wenn Redaktionstexte ohne Git-PR gepflegt werden sollen.
