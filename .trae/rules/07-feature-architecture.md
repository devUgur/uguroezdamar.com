---
applyTo: '**'
---

Feature Scaling absichern.

Inhalt

Feature Template:

features/<feature>/
  ui/
  server/
  types.ts
  index.ts

Regeln:

Feature ist isoliert

Kein Feature darf anderes Feature importieren (außer explizit erlaubt)

shared nur für generische Dinge