# ADR 0005: Static Export mit Webpack und @ugur/ui/client

## Status
Angenommen (2025-03-05)

## Kontext
- Die Site (`@ugur/site`) soll als Static Site (z. B. auf Render) mit `output: "export"` deployt werden.
- Unter Next.js 16 trat mit **Turbopack** der Fehler „Page /work/[slug] is missing generateStaticParams()“ auf, obwohl `generateStaticParams` in `app/work/[slug]/page.tsx` definiert war.
- Mit **Webpack** (`next build --webpack`) wurde stattdessen ein Build-Fehler durch Client-Bundling von Server-Only-Code ausgelöst: `Footer` aus `@ugur/ui` nutzt `next/headers` und wurde über den Barrel-Import in Client-Komponenten (z. B. `error.tsx`, `ContactForm.tsx`, `SiteHeader.tsx`) mitgebündelt.

## Entscheidung

### 1. Site-Build mit Webpack
- **`apps/site`:**
  - `"build": "next build --webpack"` als Standard-Build (kein Turbopack für Production).
- Static Export mit dynamischen Routen (`/work/[slug]`, `/blog/[slug]`, `/projects/[slug]`) funktioniert so zuverlässig; `generateStaticParams` wird korrekt erkannt.

### 2. Work-Route: generateStaticParams über Adapter
- **`app/work/[slug]/page.tsx`:**
  - `generateStaticParams` ruft `getSiteWorkSlugs()` aus `@/src/adapters/work` auf (analog zu Projects/Blog).
  - `getSiteWorkSlugs()` in `src/adapters/work.ts` liefert `{ slug: string }[]` basierend auf `getSiteWorkItems()` (featured Projects).
- Einheitliches Muster mit den anderen dynamischen Routen; keine direkte FS-Logik in der Page.

### 3. Client-sicherer Export im UI-Paket
- **`packages/ui`:**
  - Neuer Einstiegspunkt **`@ugur/ui/client`** (Entry `src/client.ts`), der nur client-taugliche Komponenten exportiert: `Button`, `Card`, `Container`, `Tag`, `ThemeToggle`.
  - Kein Export von Server Components (z. B. `Footer`, `Header`, die `next/headers` oder andere Server-APIs nutzen).
- **Site (und andere Apps):**
  - Alle **Client-Komponenten** (`"use client"`), die nur diese UI-Bausteine brauchen, importieren aus **`@ugur/ui/client`** statt aus `@ugur/ui`.
  - Beispiele: `app/error.tsx`, `ContactForm.tsx`, `SiteHeader.tsx`.
- Server Components und Layouts können weiterhin aus `@ugur/ui` (Barrel) importieren.

## Konsequenzen
- Static Export der Site baut erfolgreich; `apps/site/out` ist für Render (Static Site) nutzbar.
- Klare Trennung: Client-Bundle enthält keine Server-Only-Imports; zukünftige Server-Only-Komponenten im UI-Paket führen nicht zu versteckten Build-Fehlern in Client-Komponenten.
- Neue client-taugliche Komponenten im UI-Paket sollten in `src/client.ts` aufgenommen werden, wenn sie von Client-Komponenten genutzt werden sollen.
