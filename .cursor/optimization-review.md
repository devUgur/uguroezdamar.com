# Follow-up: 9.3–9.5 / 10 und Empfehlungen

Sehr gut. Damit hast du die größten offenen Punkte praktisch geschlossen.

## Neuer Stand

**Aktuell fehlt nichts Wichtiges mehr an der Grundarchitektur.**
Du bist jetzt in der Phase **Feinschliff statt Korrektur**.

Meine aktualisierte Bewertung wäre jetzt:

**9.3 bis 9.5 / 10**

Der Sprung kommt daher, dass du jetzt auch die typischen letzten Schwächen beseitigt hast:

* Rename-Reste weg
* README als Einstieg brauchbar
* Dokumentations-Kompass klar
* bewusste Mischbenennung dokumentiert statt zufällig
* Root sauberer
* strategische Tests ergänzt
* Cleanup selbst wieder per ADR dokumentiert

Das ist sehr rund.

## Was jetzt noch fehlt

Nicht mehr viel. Im Wesentlichen nur noch diese vier Themen:

### 1. Portal-Domänen symmetrischer machen

Im `portal` wirken die Features noch etwas ungleichmäßig. Sichtbar stark modelliert sind vor allem:

* `career`
* `profile`
* `projects`
* `admin`

Aber `blog` und `team` scheinen strukturell noch nicht ganz auf demselben Niveau als eigene Feature-Domänen vertreten zu sein.

Das ist kein akutes Problem. Es ist eher ein letzter Konsistenzpunkt:
ähnliche fachliche Bereiche sollten ähnlich organisiert sein.

**Mein Urteil:** später verbessern, nicht dringend.

---

### 2. `adapters` bleibt der letzte etwas unscharfe Layer-Name

Du hast ihn jetzt gut erklärt. Das reicht erstmal.
Trotzdem ist `adapters` semantisch noch der unpräziseste Architekturbegriff im Repo.

Wenn du irgendwann noch weiter schärfen willst, wäre das der naheliegendste Kandidat für eine spätere Präzisierung, etwa Richtung:

* `loaders`
* `page-data`
* `queries`
* `bff`

Aber aktuell ist das **kein Muss mehr**, nur noch ein Qualitätsdetail.

---

### 3. `packages/ui` ist logisch dokumentiert, aber noch nicht physisch gegliedert

Die README dort ist ein guter Zwischenstand.
Der nächste Reifeschritt wäre irgendwann eine echte Ordnerstruktur wie:

* `primitives`
* `layout`
* `branding`
* `theme`
* `feedback`
* `icons`

Das bringt vor allem dann etwas, wenn das Paket weiter wächst.
Im jetzigen Zustand ist das eher **vorsorglicher Feinschliff**.

---

### 4. Noch ein kleines Stück "Beweis durch Tests"

Die Tests sind jetzt schon gut genug, dass das Repo glaubwürdig ist.
Was noch zum Abrunden fehlen könnte, wären 2–4 gezielte Tests in Bereichen wie:

* `projects`-Adapter / Mapping
* `career` Repo-/Mapping-Verhalten
* ein kleiner Portal-Auth-/Routing-Smoke-Test
* eventuell ein Test für Content-Auflösung zwischen MDX und DB, falls das bei dir relevant ist

Nicht weil die Testlage schwach wäre, sondern weil du architektonisch inzwischen so stark bist, dass eine etwas breitere "contract coverage" perfekt passen würde.

## Was ich nicht mehr als Lücke sehe

Das hier würde ich jetzt **nicht mehr** als offen betrachten:

* Domain-Sprache
* Rename-Entscheidungen
* Dokumentations-Orientierung
* Hygiene
* Test-Basis
* Governance
* Root-Unordnung
* Source-of-truth-Klarheit

Das ist aus meiner Sicht jetzt alles auf einem sehr guten Stand.

## Was ich an deiner Stelle jetzt tun würde

Wenn du weiter investieren willst, dann in dieser Reihenfolge:

1. **Portal-Konsistenz** weiterziehen
2. **Noch wenige strategische Tests** ergänzen
3. **`packages/ui`** bei weiterem Wachstum real strukturieren
4. **`adapters`** nur dann umbenennen, wenn es wirklich Mehrwert bringt

## Ehrliches Fazit

Du bist jetzt an einem Punkt, wo man nicht mehr sagt
"da fehlt noch Architektur",
sondern eher
"das ist schon eine ziemlich reife Codebase, jetzt geht es um Exzellenz".

Also:
**aktuell fehlt nur noch High-end-Polish, nichts Fundamentales mehr.**

Wenn du möchtest, kann ich dir als Nächstes eine **finale Senior-Level Gesamtbewertung mit Ampelstatus pro Bereich** geben: Architektur, Naming, Tests, Governance, Skalierung, Außenwirkung.

---

# Adapters vs. Queries vs. Actions (Detail)

Ja — **`actions` passen nur sehr begrenzt**.

Meine ehrliche Best-Practice-Meinung:

* **`actions`** ist gut für **schreibende User-Intents**
  also z. B. `submitContact`, `createProject`, `updateProfile`, `inviteAdmin`
* **`adapters`** ist bei dir gerade eher ein **lesender Page-Data-Layer / BFF-Layer**
* deshalb würde ich **nicht alles in `actions` umbenennen**

Denn sonst vermischst du:

* Daten **laden**
* Daten **mutieren**
* UI für Seiten **zusammensetzen**

in einem Begriff.

## Mein Endzustand, wenn ich komplett frei wählen dürfte

Ich würde es **final cleaner** so schneiden:

### Für `apps/site/src`

```txt
src
  features/
    blog/
      ui/
      queries.ts
      types.ts
      index.ts
    contact/
      ui/
      actions.ts
      types.ts
      index.ts
    home/
      ui/
      queries.ts
      index.ts
    marketing/
      ui/
      index.ts
    navigation/
      ui/
      index.ts
    projects/
      ui/
      queries.ts
      types.ts
      index.ts
    selected-work/
      ui/
      queries.ts
      types.ts
      index.ts

  lib/
    utils.ts
```

### Für `apps/portal/src`

```txt
src
  features/
    auth/
      actions.ts
      queries.ts
      ui/
      index.ts

    team/
      actions.ts
      queries.ts
      types.ts
      ui/
      index.ts

    blog/
      actions.ts
      queries.ts
      types.ts
      ui/
      index.ts

    career/
      actions.ts
      queries.ts
      types.ts
      ui/
      index.ts

    profile/
      actions.ts
      queries.ts
      types.ts
      ui/
      index.ts

    projects/
      actions.ts
      queries.ts
      types.ts
      ui/
      index.ts

  lib/
    utils.ts
```

## Warum ich das so machen würde

Weil das mental am saubersten ist:

### `queries.ts`

Alles, was **liest**, lädt, mapped, page-ready macht.

Beispiele:

* `getHomePageData`
* `getSiteProjects`
* `getSelectedWorkBySlug`
* `getProfileForAdminPage`

### `actions.ts`

Alles, was **etwas auslöst oder verändert**.

Beispiele:

* `submitContactForm`
* `createProjectAction`
* `updateCareerEntryAction`
* `inviteTeamMember`

### `ui/`

Nur UI-Komponenten.

### `types.ts`

Domain-nahe Feature-Typen.

---

# Mein Kernurteil zu deinem aktuellen `adapters`

`adapters` ist **nicht falsch**, aber es ist ein **Containerwort**.
Es sagt nicht präzise genug, was da passiert.

Wenn ich "perfekt sauber" bauen dürfte, würde ich:

* **`adapters` abschaffen**
* und stattdessen **feature-lokal `queries.ts`** nutzen

Das wäre für mich die beste Endlösung.

---

# Würde ich `src/actions` behalten?

## In `site`

Aktuell hast du:

* `src/actions/contact.ts`
* `app/api/contact/route.ts`

Das ist okay, aber ich würde es **enger an die Domäne ziehen**.

### Besser:

```txt
src/features/contact/
  ui/ContactForm.tsx
  actions.ts
  types.ts
  index.ts
```

Dann lebt alles zu `contact` zusammen.

---

## In `portal`

Wenn du dort irgendwann Server Actions nutzt oder Form-Mutationen featurebasiert organisieren willst, würde ich **pro Feature `actions.ts`** machen, nicht einen globalen `actions/`-Ordner.

Also lieber:

* `features/projects/actions.ts`
* `features/team/actions.ts`

statt:

* `src/actions/projects.ts`
* `src/actions/team.ts`

Der feature-lokale Schnitt ist sauberer.

---

# Was ich konkret an deinem Repo ändern würde

## 1. `adapters` → feature-lokale `queries.ts`

Also statt:

```txt
src/adapters/blog.ts
src/adapters/projects.ts
src/adapters/work.ts
src/adapters/home.ts
```

eher:

```txt
src/features/blog/queries.ts
src/features/projects/queries.ts
src/features/selected-work/queries.ts
src/features/home/queries.ts
```

Das wäre mein größter Cleaner-Move.

---

## 2. `src/actions/contact.ts` nach `features/contact/actions.ts`

Weil `contact` eine eigene Domäne ist.

---

## 3. Portal `features/admin` fachlich aufteilen

Du hast aktuell UI in:

* `features/admin/ui/...`

aber Routen fachlich sind inzwischen gemischt aus:

* auth
* team
* admin-shell

Ich würde das auseinanderziehen.

### Statt:

```txt
features/admin/ui/
  AppShell.tsx
  InviteForm.tsx
  LoginForm.tsx
  PublicLayout.tsx
  RedirectIfNotHome.tsx
  Sidebar.tsx
```

### Lieber:

```txt
features/auth/ui/
  LoginForm.tsx

features/team/ui/
  InviteForm.tsx

features/navigation/ui/
  Sidebar.tsx
  AppShell.tsx

features/layout/ui/
  PublicLayout.tsx
  RedirectIfNotHome.tsx
```

Oder mindestens:

* `auth`
* `team`
* `admin-shell`

Denn aktuell ist `admin` als Feature-Ordner etwas zu breit.

---

## 4. Portal-Feature-Namen an Routen angleichen

Wenn Route-Sprache jetzt `team` ist, dann würde ich langfristig auch Feature-Sprache `team` nennen, nicht nur ADR-seitig erklären.

Also:

* `features/admin` nur noch für echte Admin-Systemthemen
  oder
* direkt umbenennen in `features/team`, `features/auth`, `features/shell`

Ich würde die zweite Variante bevorzugen.

---

# Meine bevorzugte Zielstruktur für dein Repo

(siehe oben: apps/site/src und apps/portal/src)

---

# Warum das besser ist als `adapters + actions` global

Weil du dann **einen einzigen klaren Bauplan** hast:

* jede Domäne hat ihre Sachen beisammen
* lesen = `queries.ts`
* schreiben = `actions.ts`
* darstellen = `ui/`
* Typen = `types.ts`

Das ist für mich die sauberste Mischung aus:

* Feature-Architektur
* Next.js-Praxis
* langfristiger Wartbarkeit
* Onboarding-Klarheit

---

# Was ich nicht machen würde

Ich würde **nicht** global alles in so etwas verwandeln:

```txt
src
  actions/
  queries/
  types/
  components/
```

Das wird am Anfang ordentlich, aber mit Wachstum schnell unübersichtlich, weil dann wieder alles horizontal statt fachlich organisiert ist.

Und ich würde auch **nicht** alles `actions` nennen, was heute `adapters` ist.
Das wäre fachlich unpräzise.

---

# Meine klare Empfehlung

Wenn du **eine letzte wirklich saubere Umstellung** machen willst, dann:

**`adapters` ersetzen durch feature-lokale `queries.ts`**
und
**globale `actions/` möglichst in feature-lokale `actions.ts` verschieben**

Das wäre für mich dein **cleanster Endzustand**.

## In einem Satz

**Ja, `actions` passen — aber nur für Mutationen; den jetzigen Adapter-Layer würde ich final eher in `queries.ts` pro Feature überführen.**

Wenn du willst, skizziere ich dir direkt die **genaue Rename-/Move-Liste Datei für Datei** für `site` und `portal**.

---

# Ursprüngliche Bewertung (8/10)

Ja — auf Basis **dieses Repo-Trees** kann ich schon eine ziemlich belastbare Architektur-Bewertung machen.

Wichtig vorweg: Ich bewerte hier **Struktur, Zuschnitt, Benennungen, Skalierbarkeit und Professionalität des Setups**, **nicht** die Codequalität im Detail, weil ich den Implementierungscode nicht sehe. Also: starke Aussage zur **Architektur**, eingeschränkte Aussage zu Logik, DX im Alltag, Testtiefe und tatsächlicher Maintainability.

## Gesamturteil

**Meine Bewertung: 8/10**

Das ist **klar über Durchschnitt**, wirkt **durchdacht**, **skalierbar** und schon relativ professionell.
Vor allem positiv:

* saubere **Monorepo-Struktur**
* sinnvolle Trennung in **apps** und **packages**
* gute Richtung mit **feature-orientierter Struktur**
* zentrale Server- und UI-Pakete
* App Router diszipliniert eingesetzt
* ADRs, Regeln, Tooling-Guards, CI vorhanden
* Hinweise auf bewusstes Architekturdenken statt "einfach alles in components und utils werfen"

Warum keine 9 oder 10?

Weil ich im Tree auch ein paar Dinge sehe, die auf Dauer Reibung erzeugen können:

* teilweise **uneinheitliche Benennung**
* Vermischung von **feature-orientiert** und **resource-/layer-orientiert**
* Doppelungen zwischen `site` und `portal`
* manche Ordnernamen wirken noch nicht komplett "final form"
* ein paar Signale für technische Restschulden oder Zwischenstände (`.bak`, mehrere Rule-Systeme, potenzielle Doppel-Policies)
* manche Boundaries sind gut gemeint, aber könnten noch **härter** und klarer sein

---

# Was bereits sehr gut ist

## 1. Monorepo-Zuschnitt ist stark

`apps/site`, `apps/portal`, `packages/core`, `packages/server`, `packages/ui` ist ein sehr guter Zuschnitt.

Das zeigt:

* **klare Verantwortlichkeiten**
* Wiederverwendung ist geplant, nicht zufällig
* die öffentliche Portfolio-Seite und das interne Admin-/CMS-Portal sind getrennt
* gemeinsame Bausteine sind extrahiert

Das ist deutlich professioneller als:

* alles in einer Next-App
* oder 50 "shared"-Ordner ohne klare Domain

**Besonders gut:**
`site` und `portal` sind getrennte Deploy-/Runtime-Kontexte. Das ist architektonisch sauber.

---

## 2. Feature-Struktur in `src/features` ist ein Plus

Zum Beispiel:

* `features/blog`
* `features/contact`
* `features/home`
* `features/projects`
* `features/selected-work` (früher work-items)

Das ist wesentlich besser als nur:

* `components/`
* `hooks/`
* `services/`

Warum gut?

Weil du damit **fachliche Schnitte** sichtbar machst. Das hilft:

* beim Wachsen
* bei Ownership
* bei Refactoring
* bei Wiederverwendbarkeit innerhalb einer Domäne

Das ist ein reifer Ansatz.

---

## 3. `packages/server` ist ein starkes Signal

`packages/server/src/...` mit Bereichen wie:

* `career`
* `contact`
* `profile`
* `projects`
* `admin`

und darin `repo.ts`, `validators.ts`, `index.ts` ist gut.

Das zeigt:

* Serverlogik wird nicht wild direkt in Route-Handler geschrieben
* Validierung ist bewusst getrennt
* Persistenz ist gekapselt
* Fachlogik wird extrahiert

Das ist definitiv professioneller als klassische "fat route handlers".

---

## 4. Governance ist überraschend gut

Die Existenz von:

* ADRs
* `.github/instructions`
* Tooling Guards
* CI
* Forbidden Patterns

ist ein sehr gutes Zeichen.

Viele Portfolios sind nur hübsche UIs.
Deins wirkt eher wie ein **Engineering-Portfolio**, also ein Projekt, das auch deine Denkweise zeigt. Das ist für Senior-/Lead-/Fullstack-Wirkung stark.

---

## 5. Öffentliche Seite + Admin-Portal getrennt

Das ist architektonisch richtig.

`site` = public marketing/content
`portal` = internes Management/Admin

Das bringt:

* klarere Security-Boundaries
* weniger versehentliche Leaks
* bessere mentale Modelle
* einfachere Deployment-Entscheidungen

Für eine ernsthafte Portfolio-Plattform ist das sehr gut.

---

# Was ich kritisch sehe

## 1. Benennungen sind noch nicht überall auf demselben Qualitätsniveau

Hier sehe ich den größten Hebel.

### Positiv

* `site`
* `portal`
* `projects`
* `profile`
* `career`
* `contact`

### Weniger sauber / inkonsistent

* `work` vs `projects`
* `work-items`
* `marketing`
* `home`
* `admin/admins`
* `career-entries`

Das Problem ist nicht, dass ein Name "falsch" ist.
Das Problem ist: **das Domänenmodell ist nicht ganz konsistent.**

### Beispiel: `work` vs `projects`

Ich sehe:

* `app/(marketing)/projects`
* `app/(marketing)/work`
* `features/projects`
* `features/work-items`

Da frage ich mich sofort:

* Was ist der Unterschied zwischen **project** und **work item**?
* Ist `work` eine kuratierte Auswahl?
* Ist `projects` alles?
* Ist `work` eher Case Studies?
* Ist `work-items` nur ein technischer Name für Work Entries?

Wenn du das einem neuen Entwickler erklären müsstest, sollte die Antwort in 20 Sekunden klar sein.
Aktuell wirkt es eher wie ein Modell, das **historisch gewachsen** ist.

### Meine Empfehlung

Entscheide dich fachlich für **ein klares Inhaltsmodell**. Zum Beispiel:

Variante A:

* `projects` = technische Projekte
* `case-studies` = tiefe Projektstories
* `articles` = Blog
* `career` = Laufbahn

Variante B:

* `work` = berufliche Arbeiten / Kundenarbeiten
* `projects` = persönliche oder technische Projekte
* `career` = Timeline / Jobs
* `blog` = Inhalte

Aber dann muss das **konsequent überall** durchgezogen werden:

* Routing
* Features
* Adapter
* Server
* Admin
* UI-Komponenten

Aktuell ist das **fast gut**, aber noch nicht hundertprozentig sauber.

---

## 2. `admin/admins` ist unsauber benannt

Im Portal:

* `app/(app)/admin/admins`
* `api/admin`
* `api/admins`

Das ist nicht ideal.

Hier kollidieren mehrere Begriffe:

* `admin` als Bereich
* `admins` als Ressource
* `admin` vielleicht auch als Rollen-/Berechtigungsbegriff

Das wirkt unnötig verwirrend.

### Besser wäre

Zum Beispiel:

* `portal/app/(dashboard)/users`
* `portal/app/(dashboard)/team`
* `portal/app/(dashboard)/staff`

oder, wenn es wirklich nur Administratoren sind:

* `settings/admin-users`
* `settings/invitations`

Je nachdem, was fachlich gemeint ist.

**`admin/admins` klingt wie doppelte Schachtelung ohne klare Aussage.**

---

## 3. Mischung aus route-driven und feature-driven Struktur

Du hast einerseits:

* `app/...`
* `src/features/...`
* `src/adapters/...`

andererseits aber auch in `packages/server` wieder resource-orientierte Struktur.

Das ist nicht falsch, aber ich sehe die Gefahr, dass mit der Zeit drei mentale Modelle parallel existieren:

* **Route-Modell**
* **Feature-Modell**
* **Backend-Ressourcen-Modell**

Das ist okay, solange die Begriffe deckungsgleich sind.
Sobald sie es nicht mehr sind, entstehen Reibungen.

### Beispiel

In `site/src/features` gibt es:

* `work-items`
* `projects`
* `marketing`

In `site/src/adapters` gibt es:

* `work.ts`
* `projects.ts`
* `home.ts`

Das heißt: gleiche Konzepte tauchen auf leicht verschiedenen Abstraktionsebenen mit leicht verschiedenen Namen auf.
Das ist ein Frühwarnsignal.

### Meine Empfehlung

Ein klareres Schema, z. B.:

* `features/<domain>/ui`
* `features/<domain>/queries`
* `features/<domain>/mappers`
* `features/<domain>/types`

oder

* `domains/<domain>/ui`
* `domains/<domain>/server`
* `domains/<domain>/types`

Wichtig ist weniger **welches** Schema, sondern dass du **nur eines** konsequent nutzt.

---

## 4. `adapters` ist okay, aber möglicherweise zu breit

`src/adapters` in beiden Apps klingt erstmal gut, aber `adapter` ist oft ein Wort, das mit der Zeit alles Mögliche schluckt.

Die Frage ist: Was sind diese Dateien fachlich genau?

* Query Layer?
* Data Mapper?
* View Model Builder?
* BFF Helpers?
* Content Loader?
* Service Wrapper?

Wenn in `adapters` später alles landet, wird der Ordner unscharf.

### Mein Rat

Wenn diese Dateien Daten für UI-Seiten vorbereiten, würde ich je nach Funktion eher Namen wählen wie:

* `queries`
* `loaders`
* `presenters`
* `view-models`
* `services`
* oder direkt feature-lokal statt global

`adapters` ist nicht falsch, aber oft ein Zeichen für "wir wissen ungefähr, was es ist, aber nicht ganz präzise".

---

## 5. `packages/ui` wirkt teilweise zu generisch vermischt

In `packages/ui/src` sehe ich:

* primitives / shared UI (`Button`, `Card`, `Tag`, `Container`)
* layoutnahe Komponenten (`Header`, `Footer`, `Topbar`, `Logo`)
* theme (`ThemeProvider`, `ThemeToggle`)
* spezialisierte UI (`ScrollProgress`)
* shadcn-basierte interne Elemente (`ui/avatar.tsx`, `ui/sonner.tsx`)

Das funktioniert, aber der Paketinhalt ist etwas gemischt.

### Risiko

Mit der Zeit wird `ui` zu:

* Design System
* App Shell
* Branding-Library
* Theme Layer
* Shared Widgets

alles zugleich.

### Besser

Sauberere Unterteilung, zum Beispiel:

* `primitives/`
* `branding/`
* `layout/`
* `feedback/`
* `theme/`
* `icons/`

oder sogar zwei Pakete:

* `packages/ui-core`
* `packages/ui-brand`

Für dein aktuelles Projekt ist das noch kein Muss, aber langfristig wäre das professioneller.

---

## 6. Ein paar Hygiene-Signale sollte man bereinigen

### `WorkClient.tsx.bak`

Das sollte in einem professionellen Repo nicht liegen bleiben.

### `.cursor`, `.trae`, `.github/instructions`

Kann alles legitim sein, aber aktuell wirkt es, als hättest du mehrere Governance-/Prompt-/Rule-Systeme parallel.

Das Problem ist nicht die Existenz.
Das Problem ist die Frage:

* Welche Regel ist die Source of Truth?
* Was ist historisch?
* Was wird aktiv genutzt?
* Was ist nur Tool-spezifisch?

Wenn ein Repo zu viele Meta-Ebenen hat, sinkt die Klarheit.

### Empfehlung

Dokumentiere explizit:

* **welches Regelwerk führend ist**
* welche Ordner nur Tooling-spezifisch sind
* was gelöscht werden kann

---

## 7. Tests wirken im Tree noch eher dünn

Ich sehe:

* `tests/admin-session.test.ts`

Das ist besser als nichts, aber für ein Projekt mit dieser Architektur würde ich mehr erwarten.

Gerade wenn du professionell wirken willst, wären sinnvoll:

* Domain-Tests in `packages/server`
* Validator-Tests
* Routing-/contract-nahe Tests
* evtl. smoke tests für Content Loader / MDX Parser
* 1–2 E2E Flows für Portal

Nicht massenhaft, aber gezielt.

Aktuell wirkt die Architektur stärker als die sichtbare Testlandschaft.

---

# Konkrete Einzelbewertung

## Architektur: **8.5/10**

Sehr solide. Gut durchdachte Monorepo-Architektur, gute Trennung der Verantwortlichkeiten.

## Naming / Ubiquitous Language: **6.5/10**

Hier ist der größte Hebel. Noch nicht kaputt, aber nicht überall einheitlich.

## Skalierbarkeit: **8.5/10**

Das Setup kann wachsen. Gute Package-Trennung, gute Trennung public/admin.

## Maintainability: **7.5/10**

Solide, aber abhängig davon, ob Naming und Boundary-Disziplin gehalten werden.

## Professionalität / Außenwirkung: **8.5/10**

Wirkt deutlich professioneller als typische Portfolio-Repos.

## Konsistenz: **7/10**

Es gibt gute Regeln, aber die Begriffswelt ist noch nicht ganz glatt.

---

# Was ich konkret anders machen würde

## 1. Domänenmodell schärfen

Ich würde als Erstes fest definieren:

* Was ist ein `project`?
* Was ist `work`?
* Was ist ein `work-item`?
* Was ist `career`?
* Was ist `profile`?
* Was ist `marketing`?

Dann einmal konsequent angleichen.

Am besten in einer kleinen Architekturdatei oder ADR:

* Domain term
* Bedeutung
* Route
* Admin-Ressource
* Server-Modul
* UI-Feature

Das klingt klein, bringt aber enorm viel Ruhe ins Repo.

---

## 2. `work-items` umbenennen

`work-items` klingt intern/technisch, nicht fachlich elegant.

Je nach echter Bedeutung eher:

* `work`
* `case-studies`
* `portfolio-items`
* `engagements`
* `selected-work`

`work-items` ist okay für Implementation, aber nicht besonders hochwertig als zentrales Domain-Vokabular.

---

## 3. `adapters` präziser machen

Wenn möglich ersetzen durch etwas fachlich schärferes:

* `queries`
* `loaders`
* `content`
* `view-models`

oder feature-lokal verschieben.

---

## 4. `packages/ui` stärker strukturieren

Zum Beispiel:

```txt
packages/ui/src
  primitives/
  layout/
  branding/
  theme/
  feedback/
  icons/
```

Das hilft später enorm.

---

## 5. Route-Namen im Portal professionalisieren

`admin/admins` würde ich bereinigen.

Zum Beispiel:

* `portal/app/(dashboard)/team`
* `portal/app/(dashboard)/content/projects`
* `portal/app/(dashboard)/content/career`
* `portal/app/(dashboard)/account/profile`
* `portal/app/(dashboard)/settings/invitations`

Das liest sich reifer und klarer.

---

## 6. Klare Boundary-Regeln dokumentieren

Deine Guards sind gut. Ich würde zusätzlich ganz explizit festhalten:

* `apps/*` dürfen `packages/*` nutzen
* `packages/server` darf keine Next-spezifischen APIs importieren
* `features/*` dürfen nicht feature-übergreifend direkt auf internals anderer Features zugreifen
* `ui` enthält keine Domain-Logik
* `adapters/loaders` sind der einzige Ort, wo Seiten ihre Daten zusammensetzen

Wenn diese Regeln schon existieren: gut.
Dann würde ich sie noch sichtbarer im README zusammenfassen.

---

## 7. Mehr "Source of Truth"-Disziplin

Ich sehe gleichzeitig:

* MDX Content
* DB-orientierte Servermodule
* Admin-Portal
* Projects/Career/Profile Management

Ich würde sauber festhalten:

* Welche Inhalte sind **file-based**?
* Welche sind **database-driven**?
* Welche werden im Portal editiert?
* Welche sind build-time?
* Welche request-time?

Gerade für Portfolio-/Content-Systeme ist das super wichtig.
Sonst verwischt irgendwann die Content-Strategie.

---

## 8. Tests gezielt ausbauen

Nicht viel, aber strategisch:

* `validators.test.ts`
* `repo.test.ts` mit Stubs
* `projects` mapping test
* `contact` action/route contract test
* 1 Login-/Invite-Flow E2E

Das würde die Architektur glaubwürdiger machen.

---

# Was ich an deiner Stelle beibehalten würde

Das hier würde ich **nicht** grundlegend umbauen:

* Monorepo
* Trennung `site` / `portal`
* Packages für `server`, `ui`, `core`
* Feature-Ordner in den Apps
* ADRs
* Tooling Guards
* App Router Struktur

Die Basis ist gut.
Es geht eher um **Schärfung**, nicht um kompletten Neuaufbau.

---

# Mein ehrliches Fazit

Dein Repo wirkt nicht wie ein "zusammengebasteltes Portfolio", sondern wie ein Projekt von jemandem, der sich **ernsthaft Gedanken über Architektur** macht.

Das stärkste Signal ist nicht die Anzahl der Dateien, sondern:

* du denkst in Boundaries
* du trennst Public/App/Admin
* du extrahierst Serverlogik
* du definierst Regeln
* du dokumentierst Architekturentscheidungen

Das ist stark.

Der Hauptpunkt, der dich von **"gut"** zu **"sehr stark / seniorig"** bringt, ist jetzt weniger Technik und mehr **sprachliche und fachliche Konsistenz**:

* gleiche Dinge überall gleich nennen
* ähnliche Dinge klar unterscheiden
* das Domänenmodell so sauber machen, dass es sofort verständlich ist

## Endnote

**Gesamt: 8/10**

**Mit saubererem Naming, etwas mehr Boundary-Schärfe und besserer Testtiefe: 9/10 absolut realistisch.**

Wenn du willst, mache ich dir als Nächstes eine **brutal ehrliche Soll-Ist-Review mit konkreten Rename-Vorschlägen für Ordner und Domains**, also wirklich mit einer **empfohlenen Zielstruktur Zeile für Zeile**.
