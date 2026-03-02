Alles klar – du bist schon ziemlich nah an einem “professionellen” Setup: Du hast **Feature-Slices (`features/*`)**, **API Routes**, **Portal/Admin**, **MongoDB**, Seeds/Indexes und sogar MDX als Content-Quelle. Was dir gerade fehlt, ist vor allem **eine saubere Domänen-Definition** (Work vs Projects) + **ein konsistenter Content-Layer**, der später Blog/weitere Inhalte “ohne Umbau” erlaubt.

Unten ist ein Ansatz, der dir **jetzt** Ordnung gibt (ohne Overengineering) und **später** sauber skaliert (Blog, Case Studies, etc.).

---

## 1) “Work” vs “Projects” lösen: ein einziges Modell + optionaler Typ

Du hast aktuell:

* `/projects` (mit `[slug]`)
* `/work` (page)
* UI heißt teils WorkGrid, teils ProjectGrid

Das ist ein klassischer Moment für: **eine Entität, zwei Views**.

### Empfehlung

**Ein einziges Datenmodell**: z.B. `WorkItem` (oder `Project`, aber dann wirklich überall).

* `Work` wird **nur eine Route/Seite als “Überbegriff”/Hub**:
  `/work` listet alles (oder kuratiert)
* Wenn du wirklich später Kategorien willst (z.B. “Projects”, “Experiments”, “Client Work”): dann über ein Feld `type`.

**Damit bleibt dein UI stabil:**

* `WorkGrid` rendert `WorkItem[]`
* `WorkItemCard` (statt ProjectCard / WorkCard getrennt)
* `WorkItemHero`

Und falls du “Projects” erstmal weglassen willst:

* `/projects` kann weg
* intern heißt’s trotzdem `WorkItem` oder `Project` – aber eben nur **eine**.

---

## 2) Konkretes MongoDB-Datenmodell für “Work”

### Minimal, aber stark (für Portfolio)

**Collection:** `work_items`

**Felder (V1):**

* `title: string`
* `slug: string` (unique)
* `summary: string` (1–2 Sätze für Cards/SEO)
* `content: { kind: "mdx" | "blocks", body: string }`
  → du kannst heute MDX speichern oder später auf Blocks umsteigen
* `coverImage: { url: string, alt: string }`
* `gallery: Array<{ url: string, alt?: string }>`
* `tags: string[]` (oder `tagIds` später)
* `type: "project" | "case-study" | "experiment"` (optional, default `"project"`)
* `status: "draft" | "published" | "archived"`
* `featured: boolean`
* `sortIndex?: number` (für manuelles Ordering)
* `year?: number` / `date?: Date` (für Timeline)
* `links?: { live?: string, repo?: string, behance?: string }`
* `tech?: string[]` (oder zusammen mit tags)
* `createdAt, updatedAt, publishedAt?`

**Indexes (wichtig):**

* unique index auf `slug`
* index auf `status`
* index auf `{ featured: 1, sortIndex: 1, publishedAt: -1 }`

> Vorteil: Du kannst **alles** in einem Grid zeigen und später trotzdem filtern/sortieren/featured machen, ohne neues Schema.

---

## 3) Content-Strategie: MDX jetzt, Admin später, ohne Rewrite

Du hast aktuell `content/projects/*.mdx` und `features/blog/server/mdx.ts` – das ist super.

Was du willst: später Admin-Editing (MongoDB) **ohne die UI umzubauen**.

### Der saubere Trick: Repository + “Content Source”

Baue einen kleinen Layer, der immer **WorkItems liefert**, egal ob aus:

* MDX im Repo (jetzt)
* MongoDB (später)
* oder gemischt (Migration)

**Interface-Idee:**

* `getWorkItems({ status, featured, limit })`
* `getWorkItemBySlug(slug)`
* `createWorkItem(...)` (nur DB)
* `updateWorkItem(...)` (nur DB)

Dann kannst du:

* heute: `getWorkItems` liest aus MDX
* morgen: gleiche Funktion liest aus MongoDB
* oder Übergang: DB hat Priorität, fallback auf MDX

**Wichtig:** Die UI-Komponenten bekommen immer das gleiche DTO.

---

## 4) Admin/Auth: Einladungen + Rollen ohne Chaos

Du hast bereits:

* `/api/admin/admins/invite`
* `/api/admin/login`, `/logout`
* portal Seiten

Das schreit nach einem klaren Modell:

### Collections

**`admins`**

* `_id`
* `email` (unique)
* `name?`
* `role: "owner" | "admin" | "editor"`
* `passwordHash` **oder** Auth via Provider (später)
* `createdAt`, `lastLoginAt?`
* `isActive: boolean`

**`admin_invites`**

* `_id`
* `email`
* `role`
* `tokenHash` (niemals plain token speichern)
* `expiresAt`
* `acceptedAt?`
* `createdByAdminId`
* `createdAt`

### Ablauf (sauber & üblich)

1. Owner/Admin erstellt Invite (API)
2. System sendet Mail: Link wie `/portal/signup?token=...`
3. Signup-Route validiert Token (hash compare + expiry)
4. Account wird angelegt/aktiviert, Invite wird “accepted”
5. Login erstellt Session (Cookie)

### Session

Für Next.js App Router + MongoDB hast du zwei solide Wege:

* **Iron Session / Cookie-based sessions** (simpel, schnell)
* **JWT** (auch okay, aber revocation schwieriger)
* **NextAuth** wäre möglich, aber du hast schon eigene Routen – also würde ich *jetzt* eher bei “eigene Session” bleiben.

**Empfehlung für dein Setup:**
DB-Session-Tabelle ist oft am wartungsärmsten, weil du Sessions invalidieren kannst.

**`admin_sessions`**

* `_id`
* `adminId`
* `sessionTokenHash`
* `expiresAt`
* `createdAt`, `lastSeenAt`
* `ip?`, `userAgent?` (optional)

Cookie enthält nur ein Random Token, DB enthält Hash.

---

## 5) Routing/Pages: So würde ich es “entwirren”

### Vorschlag (ohne riesen Umbau)

* `/work` → Grid/Filter/Featured
* `/work/[slug]` → Detailseite

Wenn du `/projects` erstmal raus willst:

* leiten oder löschen, aber **interne Entität bleibt**.

Im `features/`:

* `features/work/`

  * `server/queries.ts`
  * `server/repo.ts` (Content Source Switch)
  * `ui/WorkGrid.tsx`
  * `ui/WorkItemCard.tsx`
  * `ui/WorkHero.tsx` (oder `WorkItemHero`)
  * `index.ts`

Und dann:

* `app/work/page.tsx` ruft `features/work/server/...`
* `app/work/[slug]/page.tsx` auch

Das ist konsistenter als `features/projects` + `app/projects` parallel.

---

## 6) Blog später: Einfach gleich “ContentEntry” denken (aber nicht bauen)

Du willst Blogs später: perfekt. Mit dem obigen Ansatz musst du *nichts* neu erfinden.

Du kannst später entweder:

* `blog_posts` als separate Collection machen
  oder
* eine generische `content_entries` Collection mit `kind: "work" | "blog"`

**Aber**: Ich würde es **nicht** jetzt verallgemeinern.
Mach **WorkItems jetzt perfekt**, Blog später als eigenes Modell (weil andere Felder: readingTime, excerpt, toc, series, etc.).

---

## 7) Was du jetzt konkret als nächstes tun kannst (quick wins)

1. **Entscheide “eine Entität”:** `WorkItem` oder `Project` (ich würde `WorkItem` nehmen, weil “Work ist Kontext” bei dir schon existiert)
2. **Rename UI-Komponenten** (nur intern):

   * `ProjectCard` → `WorkItemCard`
   * `ProjectGrid` → `WorkGrid`
3. **Baue `features/work/server/repo.ts`** mit 2 Implementierungen:

   * `mdxWorkRepo` (liest `content/projects/*.mdx` oder verschiebe nach `content/work/*.mdx`)
   * `mongoWorkRepo` (später aktivieren)
4. **MongoDB Schema + Indexes** für `work_items` anlegen (du hast schon `scripts/setup-indexes.mjs`)
5. **Admin Invite Flow** sauber machen mit `admin_invites` + Token hashing (falls du noch plain token speicherst)

---

## 8) Wenn du willst: “V1 DTO” (einheitliches Objekt für UI)

Ein DTO, das überall in Cards/Detail funktioniert:

* `id`
* `slug`
* `title`
* `summary`
* `coverImage`
* `tags`
* `featured`
* `publishedAt`
* `contentHtml?` oder `contentMdx?` (für Detail)
* `links`

Damit kann dein Frontend stabil bleiben, egal ob MDX oder MongoDB.

---

Wenn du mir **eine Beispiel-MDX-Datei** (z.B. `content/projects/my-project.mdx`) + (falls vorhanden) dein aktuelles MongoDB-Admin/Auth Code-Snippet (`shared/lib/mongodb.ts`, `features/admin/server/logic.ts`, `api/admin/login/route.ts`) hier reinkopierst, kann ich dir daraus direkt:

* ein **konkretes `work_items` Schema** (inkl. Zod Validatoren)
* passende **queries** (`getWorkItems`, `getWorkItemBySlug`, `upsertWorkItem`)
* und den **Invite Token Flow** (hashing + expiry + sessions)

als “drop-in” Struktur in deinem aktuellen Projektstil zusammenstellen.
