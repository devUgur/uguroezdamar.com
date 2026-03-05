# Render Static Site – @ugur/site

Damit der Publish-Ordner `apps/site/out` existiert, muss der **Build** die Site mit Static Export bauen.

Der Site-Build nutzt **Webpack** (`next build --webpack`), damit Static Export mit dynamischen Routen (`/work/[slug]`, `/blog/[slug]`, `/projects/[slug]`) zuverlässig funktioniert. Client-Komponenten, die nur UI ohne Server-APIs brauchen, importieren aus `@ugur/ui/client`, damit kein Server-Only-Code (z. B. Footer mit `next/headers`) in den Client-Bundle gelangt.

## Empfohlene Einstellungen (Dashboard)

- **Root Directory:** leer lassen (Repo-Root).
- **Build Command:**  
  `pnpm install && pnpm run build:site`
- **Publish Directory:**  
  `apps/site/out`

`build:site` baut nur die Site und ihre Abhängigkeiten (core, server, ui) und erzeugt dabei `apps/site/out`.

## Wenn du stattdessen den vollen Monorepo-Build nutzt

- **Build Command:**  
  `pnpm install && pnpm run build`
- **Publish Directory:**  
  `apps/site/out`

Dann bauen alle Apps (site + portal); die Site erzeugt weiterhin `apps/site/out`.

## Wichtig

- **Publish Directory** ist relativ zur **Repo-Root**, nicht zum Root Directory.
- Wenn du **Root Directory** auf `apps/site` setzt, läuft der Build in diesem Ordner. Dann muss der Build-Befehl von der Repo-Root aus laufen (z. B. `cd ../.. && pnpm install && pnpm run build:site`), und **Publish Directory** = `apps/site/out` (weiterhin relativ zur Repo-Root). Oder du lässt Root Directory leer und nutzt die obigen Einstellungen.

## Blueprint (render.yaml)

Siehe `render.yaml` im Repo-Root für eine Beispiel-Blueprint-Definition der Static Site.
