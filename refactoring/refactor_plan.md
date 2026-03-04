Alles klar – ich würde dein Repo in **ein „2026-typisches“ Turborepo-Monorepo** umbauen: **2 Next Apps** (Site + Portal) und **sauber kompilierte Packages** (alles aus `packages/*` geht nach `dist/`, keine TS-Quellen „random“ in Consumers). Turborepo ist dafür weiterhin Standard, inkl. `outputs`/Caching. ([Turborepo][1])

## Update (fixiert am 2026-03-04)

- Package-Scope wird **minimal** gehalten: `@ugur/ui`, `@ugur/core`, `@ugur/server`
- `Timeline` ist **kein** eigenes CRUD-Modul, sondern Read Model aus `Work + Projects`
- `MongoDB` bleibt Single Source of Truth für `Work/Projects` (kein MDX-Fallback für diese Daten)
- `apps/site` und `apps/portal` bleiben das Zielmodell für getrennte Deployments

---

## Zielbild (neu)

### 1) Neue Ordnerstruktur (Mapping von deinem aktuellen Stand)

```txt
uguroezdamar.com/
├─ apps/
│  ├─ site/                       # uguroezdamar.com
│  │  ├─ app/
│  │  │  ├─ (marketing)/...
│  │  │  ├─ sitemap.ts
│  │  │  ├─ layout.tsx
│  │  │  └─ ...
│  │  ├─ content/                 # dein content/blog + content/projects (nur site)
│  │  ├─ public/
│  │  ├─ next.config.mjs
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ portal/                     # portal.uguroezdamar.com
│  │  ├─ app/
│  │  │  ├─ admin/...
│  │  │  ├─ login/...
│  │  │  └─ ...
│  │  ├─ app/api/                 # deine bisherigen app/api/* route handlers (admin)
│  │  │  └─ admin/.../route.ts
│  │  ├─ public/
│  │  ├─ next.config.mjs
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  └─ (optional) api/             # nur wenn du später echtes Backend trennen willst
│
├─ packages/
│  ├─ ui/                         # shared/ui (Buttons, Header, Footer, shadcn wrappers)
│  │  ├─ src/...
│  │  ├─ dist/                    # build output (JS + d.ts)
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ tsup.config.ts
│  │
│  ├─ domain/                     # deine "features" als domain modules (types + validators)
│  │  ├─ src/
│  │  │  ├─ profile/...
│  │  │  ├─ projects/...
│  │  │  ├─ timeline/...
│  │  │  └─ work/...
│  │  ├─ dist/
│  │  ├─ package.json
│  │  └─ tsup.config.ts
│  │
│  ├─ db/                         # mongodb connector + repos/queries (server-only)
│  │  ├─ src/...
│  │  ├─ dist/
│  │  ├─ package.json
│  │  └─ tsup.config.ts
│  │
│  ├─ auth/                       # admin session/cookies/jwt logic (server-only)
│  │  └─ ...
│  │
│  ├─ config/                     # eslint, tsconfig, tailwind preset, etc.
│  │  ├─ eslint/...
│  │  ├─ tsconfig/...
│  │  └─ tailwind/...
│  │
│  └─ utils/                      # shared/lib (env, cookies, storage, utils)
│     └─ ...
│
├─ tooling/
│  ├─ scripts/                    # deine scripts/* (migrations, seed, setup-indexes)
│  └─ tests/                      # vitest, stubs (oder bleib root, aber tooling ist cleaner)
│
├─ docs/                          # bleibt (ggf. ergänzen: monorepo guide)
├─ .github/                       # bleibt (workflows werden auf turbo angepasst)
├─ turbo.json
├─ pnpm-workspace.yaml
├─ package.json                   # root orchestrator (pnpm + turbo)
├─ pnpm-lock.yaml
└─ ...
```

**Was wohin wandert (aus deinem aktuellen Repo):**

* `app/(marketing)` → `apps/site/app/(marketing)`
* `app/(portal)` → `apps/portal/app/` (Route Groups brauchst du dann nicht mehr)
* `app/api/**` (admin-endpoints) → `apps/portal/app/api/**`
* `content/**` → `apps/site/content/**` (Portal braucht’s i. d. R. nicht)
* `features/**` wird aufgeteilt:

  * UI-Teile → `packages/ui`
  * Types/Validators/Domain-Models → `packages/domain`
  * Mongo/Repos/Queries → `packages/db`
  * Admin-Auth/Session → `packages/auth`
* `shared/lib/**` → `packages/utils` (oder verteilt auf `auth/db/utils`)
* `shared/ui/**` → `packages/ui`
* Root `lib/animations.ts` → `packages/ui` oder `packages/utils` (je nachdem, ob nur UI)

---

## 2) Subdomain-Setup (Deployment)

Du deployest **2 Apps** separat:

* `apps/site` → `uguroezdamar.com`
* `apps/portal` → `portal.uguroezdamar.com`

Vercel kann Monorepos direkt gut, inkl. „Multiple Projects“ aus einem Repo. ([Vercel][2])
(Netlify/Cloudflare geht auch, aber Vercel ist bei Next + Monorepo am glattesten.)

---

## 3) „Alles in dist/“ für Packages (kein TS-Leak)

Das ist genau der Punkt, wo viele Monorepos schlampig werden. **Best Practice:**

* Jedes Package hat **`src/`** und **`dist/`**
* Consumers importieren **nur** aus `dist` via `exports` map
* Build mit **tsup** (schnell, ESM/CJS optional, `d.ts` out of the box) ([tsup.egoist.dev][3])

### Beispiel: `packages/ui/package.json`

```json
{
  "name": "@ugur/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "clean": "rimraf dist"
  }
}
```

### Beispiel: `packages/ui/tsup.config.ts`

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  target: "es2022"
});
```

**Wichtig:** Next Apps sollen **nicht** `@ugur/ui/src/...` importieren, sondern nur `@ugur/ui`. Dadurch bleibt „TS nur im Package“, „JS im dist“ sauber getrennt.

---

## 4) Turborepo Setup (Caching + Outputs richtig)

Turborepo lebt davon, dass du Outputs korrekt setzt (z. B. `.next/**` und `dist/**`). ([Medium][4])

### `turbo.json` (solide Grundlage)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "typecheck": {
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
```

---

## 5) pnpm workspace (Standard)

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
```

---

## 6) Root `package.json` (Orchestrator)

```json
{
  "name": "uguroezdamar-monorepo",
  "private": true,
  "packageManager": "pnpm@9",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "clean": "turbo clean && rimraf **/node_modules"
  },
  "devDependencies": {
    "turbo": "^2",
    "rimraf": "^6"
  }
}
```

---

## 7) Shared Config als Package (wirklich „professionell“)

Damit du nicht 2x ESLint/TS/Tailwind pflegst:

`packages/config/tsconfig/base.json`
`packages/config/eslint/next.js`
`packages/config/tailwind/preset.ts`

In `apps/site/tsconfig.json`:

```json
{
  "extends": "@ugur/config/tsconfig/nextjs.json",
  "compilerOptions": {
    "baseUrl": "."
  }
}
```

---

## 8) GitHub Actions CI (Monorepo-fähig)

Du willst, dass CI nur das baut/testet, was betroffen ist (Turbo kann das über Caching/Graph gut).

High-level:

* `pnpm install`
* `turbo lint test typecheck build`

Und als Outputs/Caching: Turbo Remote Cache (z. B. Vercel Remote Cache) ist oft der nächste Schritt.

(Deine `.github/instructions` kannst du behalten; die passt gut in ein Monorepo.)

---

## 9) Praktischer Migrationsplan (ohne Chaos)

1. `apps/site` erstellen, Marketing-Routes + content umziehen, Build läuft.
2. `apps/portal` erstellen, Portal-Routes + `app/api/admin/**` umziehen.
3. `packages/ui` aus `shared/ui` bauen → `dist` sauber.
4. `packages/db`, `packages/auth`, `packages/domain` extrahieren.
5. Imports bereinigen (nur noch `@ugur/*` entrypoints, keine Deep Imports ins `src/`).
6. Turbo-Pipelines und CI finalisieren.

---