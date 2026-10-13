# ADR 0017: Workspace-Pakete als TypeScript-Quellcode, schlanker Dev-Start

- Status: accepted
- Datum: 2026-10-13
- Beteiligte: Projektverantwortliche

## Kontext

1. `pnpm dev` startete beide Next.js-Apps und drei `tsup --watch`-Prozesse. Jeder davon baute ESM, CommonJS und Typdeklarationen; allein die Deklarationen von `@ugur/ui` brauchten rund 40 Sekunden.
2. Die Build-Artefakte wurden kaum genutzt: Die Apps lösten `@ugur/*` über `paths` in ihrer `tsconfig.json` bereits auf `src` auf. Nur Vitest las `dist`, weshalb `pnpm test` zuerst bauen musste. Es gab damit zwei Auflösungswege für dieselben Pakete.
3. `"@/*"` zeigte in den Apps zuerst auf die Repository-Wurzel und erst danach auf die App. Das Portal importierte eigenen Code als `@/apps/portal/…`.
4. `packages/ui` enthielt Shell-Komponenten, die nur das Portal nutzte (`Topbar`, `Footer`) oder niemand mehr (`Header`, `Logo`). Mehrere Pakete importierten Abhängigkeiten, die nur das Root-`package.json` deklarierte.

## Entscheidung

1. **Source-first:** `@ugur/core`, `@ugur/server` und `@ugur/ui` exportieren ihre `src`-Dateien direkt (`"exports": { ".": "./src/index.ts" }`). Es gibt kein `tsup`, kein `dist` und kein `build`-/`dev`-Skript in den Paketen. Die Apps kompilieren die Pakete selbst (`transpilePackages`).
2. **Ein Auflösungsweg:** TypeScript, Next.js und Vitest folgen demselben `exports`-Vertrag. Die `paths`-Einträge für `@ugur/*` und die Vitest-Aliase auf `dist` sind entfernt.
3. **App-lokaler Alias:** `"@/*"` bedeutet in jeder App `./*`. Vitest bildet das über ein kleines Plugin in `vitest.config.ts` nach, das `@/` relativ zur importierenden App auflöst.
4. **Dev-Start:** `pnpm dev` startet nur die Site (Port 3100), `pnpm dev:portal` nur das Portal (3101), `pnpm dev:all` beide. Die CLI prüft vorher die Ports, meldet die Zeit bis zur Erreichbarkeit jeder App und beendet beim Abbruch den gesamten Prozessbaum. Secrets kommen weiterhin ausschließlich aus Infisical.
5. **Aufgaben getrennt:** `dev` startet Apps, `build` erzeugt Produktionsartefakte, `typecheck` prüft Typen. In `turbo.json` hängen `build` und `typecheck` über einen `transit`-Knoten von den Paketen ab, damit der Cache Änderungen am Paket-Quellcode bemerkt, ohne dass dort etwas gebaut wird.
6. **Paketgrenzen:** `Topbar` und `Footer` liegen in `apps/portal/src/features/shell`; `Header` und `Logo` sind gelöscht. Jedes Workspace deklariert, was es importiert. Gemeinsam genutzte Versionen stehen einmal im pnpm-Catalog (`pnpm-workspace.yaml`).
7. **Absicherung:** `pnpm guard:package-boundaries` verbietet `@ugur/server` in `packages/ui`, Framework-Importe in `packages/core`, App-Importe in allen Paketen sowie Exporte außerhalb von `src` und `build`-/`dev`-Skripte in den Paketen.

## Alternativen

- **Kompilierte Pakete behalten, nur den Dev-Start filtern:** entfernt die Watcher, lässt aber zwei Auflösungswege und den Build vor jedem Testlauf bestehen. Abgelehnt.
- **Pakete mit `tsc` bauen und Projekt-Referenzen nutzen:** lohnt sich, wenn App-Builds zu langsam werden oder ein Paket außerhalb eines Bundlers läuft. Beides trifft derzeit nicht zu.
- **Turborepo ersetzen oder die Pakete in die Apps auflösen:** kein Nutzen; die Struktur aus zwei Apps und drei Paketen bleibt passend.

## Konsequenzen

- Änderungen in `packages/*` wirken im laufenden Dev-Server sofort, ohne Zwischenbuild.
- `pnpm test` und `pnpm typecheck` brauchen keinen vorherigen Build; ein frischer Checkout läuft nach `pnpm install`.
- Typfehler in einem Paket erscheinen auch im Typecheck der Apps, die es nutzen.
- Paket-Quellcode darf keine `paths`-Aliase verwenden, nur relative Importe und Paketnamen.
- Die Pakete lassen sich nicht direkt mit Node ausführen (Importe ohne Dateiendung). Skripte der CLI importieren sie deshalb nicht; wer das braucht, führt einen Build für genau dieses Paket wieder ein.
- Turborepo kann für die Pakete keinen eigenen Build-Cache halten; die App-Builds kompilieren sie mit.

## Verifikation und Rückprüfung

Stand 13.10.2026, Windows 11, ohne vorhandene `dist`-Ordner: `pnpm guard`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (18 Dateien, 78 Tests) und `pnpm build` für Site und Portal erfolgreich.

| Messung (je ein Lauf) | Ergebnis |
| --- | --- |
| `pnpm dev`, kalter Start ohne `.next`, bis Port 3100 erreichbar | 6,4 s, ein Next-Prozess, kein Watcher |
| `pnpm dev:all`, bis beide Ports erreichbar | 5,7 s |
| erster Aufruf von `/` nach kaltem Start | 14,0 s (Kompilierung der Route) |
| zweiter Aufruf von `/` | 0,4 s |
| Änderung in `packages/ui`, danach `/imprint` | neu kompiliert in 0,3 s, Änderung in der Antwort enthalten |

Nicht geprüft: das Beenden per `Ctrl+C` in einem interaktiven Terminal und Hot Reload im Browser (geprüft wurde die neu ausgelieferte Seite).

Erneut prüfen, wenn ein Paket außerhalb von Next.js oder Vitest gebraucht wird oder die App-Builds spürbar langsamer werden.
