---
applyTo: '**'
---

Feature-based Regeln (für kleines Projekt = sehr gut)
Ziel

Alles, was zu einer Funktion gehört, liegt zusammen: UI, Queries, Actions, Types.

Empfohlener Ordnerbaum:

src/
  app/...
  features/
    projects/
      ui/
        ProjectCard.tsx
        ProjectGrid.tsx
      server/
        queries.ts        // getProjects, getProjectBySlug (server only)
        actions.ts        // createContactMessage (server action)
      types.ts
      index.ts
    contact/
      ui/ContactForm.tsx  // client (UX), nutzt Server Action
      server/actions.ts
  shared/
    ui/
      Button.tsx
      Section.tsx
    lib/
      env.ts
      fetcher.ts
      validators.ts
    styles/

Regeln

features/<feature>/server/* enthält nur serverseitige Dinge (Queries, Actions).

features/<feature>/ui/* enthält Komponenten.

shared/ nur für wirklich wiederverwendbare Bausteine (UI primitives, utils).

Keine „mega utils“ die alles können – lieber klein & feature-nah.