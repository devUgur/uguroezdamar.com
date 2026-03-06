# ADR 0009: Feature-Local Queries and Actions (Site)

## Status
Angenommen (2025-03-05)

## Kontext
Der globale Layer `src/adapters` in `apps/site` war semantisch unscharf („Adapter“ als Containerbegriff). Die Optimierungsreview empfahl, Lese-Logik in feature-lokale `queries.ts` und Schreib-Logik in feature-lokale `actions.ts` zu überführen.

## Entscheidung

- **Site:** Der ehemalige Adapter-Layer wurde durch feature-lokale Module ersetzt:
  - `features/blog/queries.ts` und `features/blog/types.ts` (getAllPosts, getPostBySlug, compileMdx, PostRecord)
  - `features/home/queries.ts` (getProfileForAbout, getTimelineForAbout, getTimelineForEducation)
  - `features/projects/queries.ts` (getSiteProjects, getSiteProjectBySlug)
  - `features/selected-work/queries.ts` (getSiteWorkItems, getSiteWorkSlugs, getSiteWorkItemBySlug; importiert von features/projects/queries)
  - `features/contact/actions.ts` (submitContact)
- **Globale Ordner:** `src/adapters` und `src/actions` in `apps/site` wurden entfernt.
- **Portal:** Adapter in `apps/portal` bleiben vorerst unverändert (können in einer späteren Iteration ebenfalls feature-lokal werden).

## Konsequenzen

- Einheitliche Regel: Lesen = `queries.ts`, Schreiben = `actions.ts`, Darstellung = `ui/`, Typen = `types.ts` pro Feature.
- Keine zentrale „Adapter“-Schicht mehr in der Site; bessere Onboarding-Klarheit und fachliche Zuordnung.
