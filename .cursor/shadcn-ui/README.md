# shadcn/ui – neue Komponenten im Monorepo

Neue shadcn-Komponenten landen im **shared UI-Paket** `packages/ui`. Die Apps (site, portal) nutzen `@ugur/ui` und sehen neue Komponenten nach einem Build.

## So fügst du Komponenten hinzu

### Immer mit dem Script vom Repo-Root

**Nicht** `pnpm dlx shadcn@latest add …` direkt ausführen – dabei würde `pnpm add radix-ui` im Root laufen und pnpm verweigert das im Monorepo.

Stattdessen **immer** das Script nutzen (setzt `-c packages/ui`, damit alles in `packages/ui` passiert):

```bash
# Einzelne Komponente (z. B. Avatar)
pnpm ui:add avatar

# Interaktiv auswählen
pnpm ui:add

# Mehrere auf einmal
pnpm ui:add avatar dialog dropdown-menu
```

Die CLI läuft dann in `packages/ui`, nutzt dort die `components.json`, schreibt nach **`packages/ui/src/ui/<name>.tsx`** und installiert Abhängigkeiten in **`packages/ui`** (nicht im Root).

## Konfiguration (packages/ui)

- **components.json**  
  - `aliases.components` → `"src"` → neue Komponenten landen in `packages/ui/src/ui/` (z. B. `src/ui/avatar.tsx`).  
  - `aliases.utils` → `@/lib/utils` → `packages/ui/src/lib/utils.ts`  
  - `tailwind.css` → `../../apps/site/app/globals.css` (für ggf. neue CSS-Variablen bei neuen Komponenten)

- **Struktur**  
  - Gemeinsame Komponenten (Button, Card, Select, …) liegen direkt unter `src/`, wie `src/Select.tsx`.  
  - Per CLI hinzugefügte Komponenten landen in `src/ui/` (z. B. `src/ui/dialog.tsx`).

- **tsconfig.json**  
  - `@/*` → `./src/*`, damit `@/` und `@/lib/utils` korrekt aufgelöst werden.

## Nach dem Hinzufügen

1. **Export in packages/ui**  
   CLI-Komponenten liegen unter `packages/ui/src/ui/` (z. B. `dialog.tsx`). In `packages/ui/src/index.ts` exportieren, z. B.:

   ```ts
   export { Dialog, DialogTrigger, DialogContent } from "./ui/dialog";
   ```

2. **Theme/CSS**  
   Falls die CLI neue Variablen in `apps/site/app/globals.css` einträgt und du die Komponente auch in **portal** nutzt, die gleichen Variablen ggf. in `apps/portal/app/globals.css` übernehmen (oder eine gemeinsame Theme-Datei nutzen).

3. **Build**  
   `pnpm build` (oder Build der Apps) baut `@ugur/ui` mit; die Apps haben bereits `@source` auf `packages/ui/src/**/*.{ts,tsx}` (z. B. portal), sodass Tailwind die neuen Klassen sieht.

## Nützliche Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `pnpm ui:add` | Interaktiv Komponenten auswählen (läuft in packages/ui) |
| `pnpm ui:add avatar` | Komponente „avatar“ in packages/ui hinzufügen |
| `pnpm ui:diff` | Diff zur shadcn-Registry anzeigen |

## Hinweis

Die CLI-Option **`-c`** ist **`--cwd`** (Arbeitsverzeichnis), nicht der Pfad zur Config-Datei. Die Config heißt immer `components.json` und wird im angegebenen cwd gesucht.
