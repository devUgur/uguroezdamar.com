Du kannst das so denken: **„Domain“ ist dein Daten-/Business-Kern**, „Features“ ist nur eine **Organisationsform** (UI + Use-Cases). In einem Monorepo musst du *nicht* zwingend einen `features/` Ordner in der Next-App haben – aber du brauchst weiterhin **eine klare Schichtung**, sonst wird’s chaotisch.

## Final Decisions (fixiert am 2026-03-04)

- Zielarchitektur: Monorepo mit `apps/site` + `apps/portal`
- Package-Schnitt: `@ugur/ui`, `@ugur/core`, `@ugur/server`
- Timeline: **Option 1** → reiner Merge aus `Work + Projects` (Read Model)
- Eigene Timeline-Entity: aktuell **nein** (nur bei späteren echten Milestones)
- Datenstrategie: `MongoDB` als Source of Truth für `Work/Projects`

### 1) Timeline: weg, drinlassen, oder neu benennen?

Wenn „Timeline“ inhaltlich nur „Work + Projects chronologisch“ ist, dann ist `timeline` als eigenes Domain-Modul oft Overkill.

Ich würde 2026-typisch so machen:

* `@ugur/domain` enthält **nur**:

  * **Entities/Types** (`Project`, `WorkEntry`)
  * **Value Objects** (z. B. `Slug`, `DateRange`)
  * **Zod-Validatoren / Schemas**
  * **Sortierung/Mapping** (z. B. `toTimelineItems()` als reine Funktion)

Dann brauchst du kein `timeline` als eigene Entity. Timeline ist eher eine **View / Read Model**.

Beispiel:

* `Project` hat `dateFrom`, optional `dateTo`
* `WorkEntry` hat `dateFrom`, optional `dateTo`
* `timeline` ist eine Funktion: `mergeAndSort(workEntries, projects)`

Das ist sauberer als ein drittes CRUD-Modul.

**Wann Timeline trotzdem sinnvoll ist:**
Wenn du Timeline als **eigenes Content-Objekt** pflegst (z. B. “2019: Umzug”, “2021: Zertifikat”), das weder Work noch Project ist. Dann ist `TimelineItem` ein eigenes Entity. Sonst: weg.

---

### 2) „Wenn Site keine Features mehr hat… benutzen wir dann keine Features?“

Doch – du benutzt Features weiterhin, nur **nicht zwingend als Ordnername** in `apps/site`.

In Next.js Apps (`apps/site`, `apps/portal`) empfehle ich eher:

* `app/` bleibt **routing-only** (Pages, Layouts, Route Handlers)
* Alles „App-spezifische UI“ (Sections, Page-Components) kommt in `src/` oder `components/`
* Alles „Shared UI“ kommt aus `@ugur/ui`
* Alles „Business Types/Validation“ kommt aus `@ugur/domain`
* Alles „Data Access“ kommt aus `@ugur/db` (server-only)

Heißt: Deine „Features“ leben entweder

* als **Packages** (`@ugur/domain`, `@ugur/db`, `@ugur/ui`)
* oder als **App-local Features** in `apps/site/src/features/*` (nur wenn’s wirklich site-only ist)

Du musst Features nicht abschaffen – du verschiebst nur die **Grenzen**.

---

### 3) Was importiert man in `apps/site` konkret?

**Minimaler Import-Plan (sauber & wartbar):**

#### In `apps/site` (Marketing/Portfolio)

* `@ugur/ui`
  Header, Footer, Container, Buttons, Cards, shadcn wrappers
* `@ugur/domain`
  Types + Schemas + Helper (z. B. `sortProjects()`)
* `@ugur/db` (nur in Server Components / Route Handlers)
  z. B. `getProjects()`, `getWorkEntries()` – und das liefert dir schon **Domain-Objekte**

Dann bleibt `apps/site` sehr Next-bezogen:

* Routing
* Pages + Layouts
* Page-Sections/Composition
* SEO/Metadata

#### In `apps/portal` (Admin)

* `@ugur/ui` (shared)
* `@ugur/domain` (shared)
* `@ugur/db` (server-only, CRUD)
* optional `@ugur/auth` (Admin Session)

---

### 4) Empfohlene Ordnerstruktur in `apps/site` (ohne „features“-Zwang)

So ist’s Next-typisch, ohne dass es „zu frameworky“ wird:

```txt
apps/site/
├─ app/
│  ├─ (marketing)/
│  ├─ layout.tsx
│  └─ ...
├─ src/
│  ├─ components/          # site-only UI (Sections, page-specific components)
│  ├─ server/              # server-only orchestration (queries / loaders)
│  │  ├─ projects.ts        # calls @ugur/db and returns ready-to-render data
│  │  └─ work.ts
│  ├─ styles/
│  └─ lib/                 # site-only helpers
└─ content/
```

**Wichtig:** `@ugur/db` nie in Client Components importieren. Nur:

* Server Components
* Route Handlers
* Server Actions

---

### 5) Wo lebt dann „Work“ und „Projects“ Logik?

Ich würde das so splitten:

#### `packages/domain`

```txt
packages/domain/src/
├─ projects/
│  ├─ types.ts
│  ├─ schema.ts
│  └─ index.ts
├─ work/
│  ├─ types.ts
│  ├─ schema.ts
│  └─ index.ts
├─ timeline/
│  ├─ buildTimeline.ts      # reine Funktion (optional)
│  └─ types.ts              # union type Project|WorkEntry -> TimelineItem
└─ index.ts
```

**timeline** hier ist kein CRUD-Feature, sondern nur „Read Model / Mapping“.

#### `packages/db`

```txt
packages/db/src/
├─ projects/
│  ├─ repo.ts               # db queries
│  └─ index.ts              # exports getProjects/createProject/updateProject
├─ work/
│  ├─ repo.ts
│  └─ index.ts
└─ mongodb.ts
```

Portal nutzt CRUD voll, Site nutzt meist nur read-only Calls.

---

### 6) Wann ist ein `apps/site/src/features/*` trotzdem sinnvoll?

Wenn du z. B. sehr große Sections hast, die 100% site-only sind:

* `src/features/home/*`
* `src/features/blog/*`

Dann ist „features“ innerhalb der App wieder ok — aber es ist **App-local**, nicht mehr repo-global.

---

### Meine Empfehlung für dich (konkret)

* `Timeline` als eigenes Domain-Modul: **nur**, wenn du Timeline-Items pflegen willst, die *nicht* Work/Project sind.
* Ansonsten: `timeline` nur als **Funktion** in `@ugur/domain` (`buildTimeline()`), kein eigenes CRUD.
* In `apps/site`: kein großer `features/` Zwang. Nutze `src/components` + `src/server` (oder `src/features` wenn du es magst).
* Import-Regel:

  * UI shared → `@ugur/ui`
  * Types/Validation/Sortierung → `@ugur/domain`
  * DB → `@ugur/db` (server-only)

Wenn du mir sagst, ob Timeline bei dir **eigenständige Einträge** hat (z. B. Zertifikate/Meilensteine), oder wirklich nur “Work+Projects chronologisch”, dann kann ich dir die endgültige `packages/domain` Struktur exakt passend festnageln (ohne Rückfragen im Setup).

Für **dein** Projekt (Portfolio + Admin-Portal auf Subdomain, ein Maintainer, MongoDB, Next App Router) würde ich es **ähnlich, aber etwas simpler** machen als das „große“ Monorepo-Bild – weil „best“ hier nicht maximal Enterprise ist, sondern **maximal wartbar + schnell für dich**.

## Meine Empfehlung, wenn ich freie Wahl hätte

### Option A (meine Wahl): **Ein Repo, zwei Next Apps, wenige Packages**

Das ist für dich am „idealsten“:

* `apps/site` (öffentlich)
* `apps/portal` (admin)
* `packages/ui` (shared UI)
* `packages/core` (domain + validators + kleine pure helpers)
* `packages/server` (db/auth/repositories, server-only)

Warum so?

* Du bekommst **Subdomain-Trennung** + getrennte Deployments.
* Du teilst nur das, was wirklich Sinn macht (UI + Types).
* Du vermeidest, dass du am Ende 8 Packages pflegst, die für ein Portfolio Overhead sind.

**Was ich NICHT machen würde:** Domain in `projects/work/timeline` zerlegen, *wenn* Timeline kein eigener Content ist. Dann lieber:

* `@ugur/core` exportiert `Project`, `WorkEntry`, `buildTimeline()`.

**Warum das gut ist (für dich):**

* Weniger Architektur-Schmerz.
* Trotzdem professionell (dist-Build, exports map, turbo cache).
* Du kannst später immer noch weiter splitten, wenn’s wächst.

---

### Option B (noch simpler, oft unterschätzt): **Eine einzige Next App + Subdomain via Host Header**

Das ist technisch auch „Best Practice“ für kleine Systeme:

* Eine Next App, mit Middleware/Host-Routing:

  * `uguroezdamar.com/*` → Marketing
  * `portal.uguroezdamar.com/*` → Admin (eigener Route-Tree)

Vorteile:

* Nur **ein** Deployment, weniger CI/Config.
* Kein Monorepo-Overhead.

Nachteile:

* Weniger harte Trennung (Security/Separation-of-concerns musst du sauber in Code enforce’n).
* Wenn Portal stark wächst, willst du’s später eh trennen.

**Wenn dein Portal klein bleibt** (Dashboard, CRUD, Uploads), ist das mega pragmatisch.

---

## Würde ich es genauso umsetzen wie oben (Domain/DB/UI auf viele Packages)?

**Nein – nicht 1:1.**
Ich würde es **schlanker** halten (Option A) und nur 2–3 Packages machen.

Der Punkt ist: „Domain-Driven Monorepo“ ist geil, aber bei einem Portfolio kann es zu viel sein. Du willst:

* schnell ändern können
* wenig Moving Parts
* klare Server/Client Grenzen
* saubere Deployments

Das erreichst du mit **A** am besten.

---

## Konkrete Ziel-Struktur (die ich dir empfehlen würde)

```txt
apps/
  site/
  portal/

packages/
  ui/          # shared components (dist)
  core/        # types, zod schemas, helpers (dist)
  server/      # mongodb, repos, auth, admin session (dist, server-only)

tooling/
  scripts/
  tests/        # optional
```

### Import-Regeln

* `apps/*` importieren:

  * `@ugur/ui` überall (client+server ok)
  * `@ugur/core` überall (pure TS/JS)
  * `@ugur/server` **nur** in Server Components / route handlers / server actions

So bleibt’s robust.

---

## Warum „dist everywhere“ trotzdem sinnvoll ist

Für `packages/*`: ✅ absolut, würde ich genau so machen (tsup → dist, exports map).
Für `apps/*`: Next bleibt `.next` – das ist okay und „normal“.

---

## Bottom line

Wenn ich freie Wahl hätte, würde ich für dein Projekt **Option A** bauen:

* **Turborepo Monorepo**, aber **minimal**: `ui`, `core`, `server`
* **2 Next Apps** für Domain/Subdomain
* Timeline **als Read Model Funktion**, nicht als eigenes CRUD-Modul (außer du pflegst Timeline-Items separat)

Wenn du willst, schreibe ich dir als nächsten Schritt **die exakten Package-Namen, exports maps, tsup configs und die Import-Pfade**, sodass du garantiert keinen TS-Leak hast und Turbo sauber cached (inkl. „server-only“ Absicherung).

