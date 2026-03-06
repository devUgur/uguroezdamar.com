# ADR 0007: Renames – selected-work, admin/team

## Status
Angenommen (2025-03-05)

## Kontext
Die Begriffe `work-items` und `admin/admins` waren sprachlich unscharf oder redundant. Für bessere fachliche Lesbarkeit und Konsistenz mit Route-, Feature- und Content-Modell wurden gezielte Umbenennungen vorgenommen.

## Entscheidung

### 1. `work-items` → `selected-work`

- **Vorher:** Feature-Ordner `apps/site/src/features/work-items`; Begriff „work-items“ technisch und generisch.
- **Nachher:** Feature-Ordner `apps/site/src/features/selected-work`; Begriff „selected work“ = kuratierte Auswahl von Projekten (vgl. ADR 0004 „Selected Work“).
- **Nicht geändert:** Route bleibt `/work` und `/work/[slug]`; URLs und Nutzer sichtbare Begriffe bleiben stabil. Adapter und Server nutzen weiter „work“ (z. B. `getSiteWorkItems`, `getSiteWorkSlugs`) als technischen Begriff.
- **Begründung:** Einheitliche fachliche Sprache: „selected work“ = Präsentationsdomäne; „projects“ = alle Projekte; „work“ = kuratierte Teilmenge.

### 2. `admin/admins` → `admin/team` (Portal UI)

- **Vorher:** Portal-Routen `(app)/admin/admins` und `(app)/admin/admins/[id]`; Sidebar „Manage Admins“.
- **Nachher:** Portal-Routen `(app)/admin/team` und `(app)/admin/team/[id]`; Sidebar „Team“. Ressource in der UI heißt „Team“ (Personen mit Zugang zum Portal).
- **Nicht geändert:** API-Pfade bleiben **`/api/admins`**, **`/api/admins/[id]`**, **`/api/admins/invites`** und Auth-Endpunkte unverändert (Stabilität, bestehende Integrationen).
- **Begründung:** „admin/admins“ war doppelt und unklar. „admin/team“ trennt den Bereich (admin) von der Ressource (team). Intern und in der API bleibt „admins“ der technische Begriff (Rollen, Sessions, Invites). **Die gemischte Benennung (UI = „Team“, API = „admins“) ist bewusst so gewählt und in diesem ADR festgehalten.**

### 3. Was bewusst nicht umbenannt wurde

- **Route-Sprache:** `/work` (nicht `/selected-work`) bleibt die öffentliche URL.
- **API:** `/api/admins/*` bleibt; nur die Portal-UI spricht von „Team“.
- **Server/Adapter:** Module wie `admin`, `getAdminsSnapshot`, `createAdminSession` behalten ihre Namen.

## Konsequenzen

- Neue Teammitglieder und Reviewer sehen in ADR 0006 (Glossar) und hier die Begriffsentscheidungen.
- Bei der Frage „Warum Team in der UI, aber admins in der API?“ dient dieses ADR als Referenz: fachliche Klarheit in der UI, technische Stabilität in der API.
