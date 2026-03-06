# ADR 0010: SSG Selected Work – Fallback-Projekt nicht anzeigen

## Status
Angenommen (2025-03-05)

## Kontext
- Die Site nutzt SSG (Static Site Generation); „Selected Work“ kommt aus MDX unter `apps/site/content/projects/` oder aus MongoDB, wenn `MONGODB_URI` gesetzt ist.
- Es existiert eine einzige Platzhalter-MDX-Datei `my-project.mdx` mit `featured: true`, um Builds ohne echte Projekte nicht scheitern zu lassen.
- In Production wurde dadurch nur dieser Fallback („A fallback project to ensure static builds do not fail.“) in „02 — Selected Work“ angezeigt – fachlich falsch und verwirrend.

## Entscheidung

1. **Fallback aus Selected Work ausblenden**
   - In `getSiteWorkItems()` (MDX-Pfad) werden Projekte mit `slug === "my-project"` nach dem Filter `featured === true` herausgefiltert.
   - Der Fallback bleibt im Repo und wird weiterhin von `getSiteProjects()` geladen (z. B. für Build-Stabilität), erscheint aber nie in der Sektion „Selected Work“.

2. **Fallback-MDX anpassen**
   - In `apps/site/content/projects/my-project.mdx` wird `featured: false` gesetzt, damit die Absicht (nur Build-Fallback, keine Anzeige) klar ist.

3. **Leerer Zustand**
   - Wenn keine echten Featured-Projekte existieren, zeigt die UI bereits „Selected Work is currently in progress. Coming soon.“ (WorkClient) – keine weitere Änderung.

## Konsequenzen
- In Production erscheint kein falscher Fallback-Text mehr in „Selected Work“.
- Sobald echte Projekt-MDX-Dateien mit `featured: true` hinzugefügt werden, erscheinen sie wie erwartet; der Build bleibt auch ohne sie stabil.
