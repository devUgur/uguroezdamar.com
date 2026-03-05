# ADR 0002: Project model – apps array, repo URLs, per-app images

## Status
Angenommen (2025-03-05)

## Kontext
- Ein Projekt kann aus mehreren Apps bestehen (Web, Mobile, Desktop, CLI), jeweils mit eigenem Repo und eigenen Screenshots.
- Es soll eine zentrale Projekt-Repo-URL geben plus pro App eine optionale Repo-URL.
- Bilder pro App sollen per Upload gespeichert werden, ohne manuelle URL-Eingabe in der UI.

## Entscheidung

### Server (packages/server)
- **Validators:** Neues Feld `repoUrl` (optional, Projekt-Ebene) und neues Array `apps` mit `ProjectAppSchema`: `{ kind, repoUrl?, images[] }`.
- **Assets:** `buildProjectAssetKey(slug, fileName, subPath?)` – optionaler `subPath` z. B. für `"web"`/`"mobile"`; `collectProjectAssetUrls` berücksichtigt `project.apps[].images`.

### API
- **POST /api/projects/uploads:** FormData unterstützt optional `kind`; Upload-Pfad dann `project-assets/{slug}/{kind}/{file}`.

### Portal Form
- **FormState:** `repoUrl`, `apps: Partial<Record<ProjectKind, { repoUrl, images }>>`.
- **UI:** Eine Projekt-Repo-URL; pro ausgewählter Plattform (Kind) eine Sektion mit Repo-URL und „Images“: nur Upload-Button + Thumbnails (kein URL-Feld); Bilder werden sofort nach Upload in State gespeichert.

## Konsequenzen
- Bestehende Projekte ohne `apps` bleiben kompatibel; `images`/`links` weiter unterstützt.
- Site/Adapter können später `project.apps` und `project.repoUrl` für Anzeige nutzen (optional).
