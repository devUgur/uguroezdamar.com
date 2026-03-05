# shadcn/ui – neue Komponenten im Monorepo

Neue shadcn-Komponenten landen im **shared UI-Paket** `packages/ui`. Die Apps (site, portal) nutzen `@ugur/ui` und sehen neue Komponenten nach einem Build.

## So fügst du Komponenten hinzu

### Aus dem Repo-Root (empfohlen)

```bash
# Interaktiv: Komponente(n) auswählen
pnpm ui:add

# Einzelne Komponente direkt
pnpm dlx shadcn@latest add button -c packages/ui

# Mehrere auf einmal
pnpm dlx shadcn@latest add button card dialog -c packages/ui
```

`-c packages/ui` setzt das **Arbeitsverzeichnis** auf `packages/ui`. Die CLI sucht dort `components.json` und schreibt nach `packages/ui/src/components/`.

### Aus packages/ui

```bash
cd packages/ui
pnpm dlx shadcn@latest add button
```

## Konfiguration (packages/ui)

- **components.json**  
  - `aliases.components` → `@/components` → `packages/ui/src/components`  
  - `aliases.utils` → `@/lib/utils` → `packages/ui/src/lib/utils.ts`  
  - `tailwind.css` → `../../apps/site/app/globals.css` (für ggf. neue CSS-Variablen bei neuen Komponenten)

- **tsconfig.json**  
  - `@/*` → `./src/*`, damit `@/components` und `@/lib/utils` korrekt aufgelöst werden.

## Nach dem Hinzufügen

1. **Export in packages/ui**  
   Neue Dateien liegen unter `packages/ui/src/components/` (z. B. `button.tsx`). In `packages/ui/src/index.ts` die neuen Komponenten exportieren, z. B.:

   ```ts
   export { Button } from "./components/button";
   ```

2. **Theme/CSS**  
   Falls die CLI neue Variablen in `apps/site/app/globals.css` einträgt und du die Komponente auch in **portal** nutzt, die gleichen Variablen ggf. in `apps/portal/app/globals.css` übernehmen (oder eine gemeinsame Theme-Datei nutzen).

3. **Build**  
   `pnpm build` (oder Build der Apps) baut `@ugur/ui` mit; die Apps haben bereits `@source` auf `packages/ui/src/**/*.{ts,tsx}` (z. B. portal), sodass Tailwind die neuen Klassen sieht.

## Nützliche Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `pnpm ui:add` | Interaktiv Komponenten hinzufügen (cwd = packages/ui) |
| `pnpm ui:diff` | Diff zu shadcn-Registry anzeigen |
| `pnpm dlx shadcn@latest add <name> -c packages/ui` | Eine Komponente ohne Prompt hinzufügen |

## Hinweis

Die CLI-Option **`-c`** ist **`--cwd`** (Arbeitsverzeichnis), nicht der Pfad zur Config-Datei. Die Config heißt immer `components.json` und wird im angegebenen cwd gesucht.
