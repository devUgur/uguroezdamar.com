---
applyTo: '**'
---

Zweck

Fehlerfreie SSR/SSG/Client Nutzung.

Inhalt

Server Components default

"use client" nur wenn zwingend

SSG für Blog & Projekte

SSR nur wenn nötig

Kein unnötiges no-store

Kein Fetch zur eigenen API für Mutations

Entscheidungsbaum:

Braucht Interaktion? → Client Island

Braucht DB? → Server Layer

Braucht Public HTTP? → Route Handler