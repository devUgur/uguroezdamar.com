# apps/office

Das Office ist die Arbeitsfläche mit den Agenten: 3D-Büro im Vollbild, Bereiche (Firma oder ein Projekt), Mitarbeiter-Einstellungen und alle Chats. Grundlage: [ADR 0039](../../docs/architecture/decisions/0039-office-as-own-app-on-workers.md), Bereiche: [ADR 0038](../../docs/architecture/decisions/0038-office-app-and-conversation-scope.md).

| Stufe | Adresse | Worker | Anmeldung über |
| --- | --- | --- | --- |
| dev (Branch `dev`) | https://office-dev.uguroezdamar.com | `uguroezdamar-office-dev` | Portal-Preview von `dev` |
| prod (Branch `main`) | https://office.uguroezdamar.com | `uguroezdamar-office` | https://portal.uguroezdamar.com |
| lokal | http://localhost:3102 | – | http://localhost:3101 |

## Aufbau

- `app/` ist nur Routing:
  - `(office)/`: geschützt durch die Office-Session. `(room)/layout.tsx` hält das 3D-Büro dauerhaft; `/` (Firma) und `/projects/:id` laden beim Wechsel nur ihre Widgets nach. `/chat` sind die Chats.
  - `auth/`: Login, Callback und Logout.
- `src/features/agents/` enthält Büro, Chat, Einstellungen, Queries und Server Actions.
- `src/adapters/agents-api.ts` ruft die API auf (Service-Token, nur serverseitig).
- `src/adapters/session*.ts` enthält die signierte Office-Session.
- Keine Datenbank, kein `@ugur/server`: Alle Daten kommen aus `apps/api`.

## Befehle

```bash
pnpm dev:office                                         # Portal :3101 und Office :3102 mit dev-Secrets
pnpm --filter @ugur/office typecheck
pnpm --filter @ugur/office exec opennextjs-cloudflare build   # Worker-Bundle; unter Windows nur in WSL
```

Ausgeliefert wird nur durch `.github/workflows/office-deploy.yml`, nie lokal: Die lokale Wrangler-Anmeldung ist nicht das Deploy-Konto.
