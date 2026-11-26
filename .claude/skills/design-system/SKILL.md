---
name: design-system
description: Gestaltungsregeln von uguroezdamar.com. Verwenden, bevor Oberflächen in apps/site, apps/portal oder packages/ui gebaut, umgestaltet oder geprüft werden – auch zusammen mit frontend-design, shadcn oder web-design-guidelines.
---

# Design-System uguroezdamar.com

Dieses Projekt hat ein freigegebenes Design. Allgemeine Design-Skills liefern Handwerk, nicht die Richtung.

## Rangfolge

1. `AGENTS.md` (Abschnitt „UI und Styling“)
2. [`docs/product/r2-design-brief.md`](../../../docs/product/r2-design-brief.md), das freigegebene Briefing (R2-A „Editorial Engineering“)
3. Tokens in `apps/site/app/globals.css`
4. erst danach `frontend-design`, `shadcn`, `vercel-composition-patterns`, `web-design-guidelines`

Der warme, helle Hintergrund mit Serif-Headlines (Playfair Display, Inter, JetBrains Mono) ist eine bewusste, vom Owner freigegebene Entscheidung. `frontend-design` nennt solche Looks „Standard“; hier gilt das Briefing, so wie `frontend-design` es selbst vorsieht. Nicht ändern, nicht „verbessern“.

## Regeln

- Nur Tailwind und die zentralen Tokens. Keine Inline-Styles, keine Einzelwerte, wo ein Token existiert, kein zweites Styling-System.
- shadcn-Komponenten kommen nur per `pnpm ui:add <name>` nach `packages/ui`. Primitives werden umhüllt, nicht umgebaut; ihre Zugänglichkeit bleibt erhalten.
- App-spezifisches Branding und Navigation gehören in die App, nicht nach `packages/ui`.
- Das Logo ist `apps/site/app/icon.svg`. Nicht nachbauen, nicht ersetzen.
- Keine erfundenen Inhalte, Kennzahlen, Kunden oder Screenshots. Fehlt Inhalt, bleibt die Sektion klein oder entfällt.
- Komponenten: eine Aufgabe, explizite Props, kein `any`, Richtwert höchstens 200 Zeilen.

## Ablauf

1. Briefing und betroffene Tokens lesen, bevor Code entsteht.
2. Bauen mit den vorhandenen Bausteinen aus `packages/ui` (`primitives/`, `layout/`, `feedback/`, `theme/`).
3. Prüfen: `web-design-guidelines` auf die geänderten Dateien anwenden, dann im Browser hell und dunkel, mobil und Desktop ansehen.
4. Grüne Checks sind keine visuelle Freigabe. Neue Gestaltung zeigt man dem Owner, bevor sie als freigegeben gilt.
