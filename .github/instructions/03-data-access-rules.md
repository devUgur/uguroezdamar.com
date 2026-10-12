---
applyTo: '**'
---

Zweck

Verhindert DB Chaos.

Inhalt

Kein DB Import in UI

Kein Datenbankzugriff in app/

Queries nur in features/*/server/queries.ts

Mutations nur in actions.ts

Repository Pattern Pflicht

Flow Definition:

Page → Query → Repo → Postgres