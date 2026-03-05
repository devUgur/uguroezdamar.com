---
applyTo: '**'
---

Zweck

Verhindert DB Chaos.

Inhalt

Kein DB Import in UI
Kein Mongo in apps/
Repos und Validatoren NUR in packages/server
Apps (apps/*/src/server) sind reine Adapter (Next actions, route handlers, caching)
Keine Domain-Logik in Apps
Repository Pattern Pflicht

Flow Definition:

Page → Adapter (App) → Domain Service/Repo (Package) → Mongo