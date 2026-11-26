# ADR 0039: Office als eigene Next.js-App auf Cloudflare Workers

- Status: accepted
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Ersetzt teilweise: [ADR 0038](0038-office-app-and-conversation-scope.md), Punkte 2 und 3 (Office als Route im Portal, Subdomain per Proxy-Umschreibung)
- Ergänzt: [ADR 0020](0020-vercel-hosting.md), [ADR 0024](0024-agent-platform-on-cloudflare.md)

## Kontext

ADR 0038 hat das Office als Vollbild-Route `/office` im Portal angelegt. Der Owner möchte das Office als eigene App: Dort entsteht die Arbeit mit den Agenten. Das Portal bleibt die Verwaltung. Beide sind mit der API verbunden. Dev und Produktion sollen je eine feste Adresse haben, die Subdomain liegt bei Cloudflare.

## Entscheidung

1. **`apps/office` ist eine eigene Next.js-App:**
   - **Versionen:** Next.js 16 und React 19 aus dem Workspace-Katalog, Tailwind 4 und `@ugur/ui`. Gestaltung und Tokens wie im Portal.
   - **Inhalt:** Das Agenten-Feature (3D-Büro, Mitarbeiter-Einstellungen, alle Chats) ist aus dem Portal hierher umgezogen.
   - **Weiterleitungen im Portal:** `/office`, `/agents`, `/chat` und `/chat/:id` leiten in die Office-App weiter, damit alte Links aus Board, Projekten und Verbrauch weiter funktionieren.
2. **Keine Datenbank im Office:**
   - Alle Daten kommen über die API (`apps/api`) mit dem Service-Token der Stufe, wie zuvor im Portal.
   - `@ugur/server` ist im Office per Lint verboten. Das hält das Bundle klein und die App unabhängig von Neon.
3. **Anmeldung über das Portal, dieselben Zugangsdaten:**
   - **Ablauf:**
     1. `/auth/login` im Office schickt den Browser an `/office-handoff` im Portal.
     2. Das Portal prüft seine Session und die Owner-Rolle.
     3. Es holt bei der API ein Einmal-Ticket (`POST /api/auth/handoff`, 60 Sekunden gültig) und schickt es an `/auth/callback` des Offices.
     4. Der Office-Server löst das Ticket genau einmal ein (`POST /api/auth/handoff/redeem`).
     5. Er setzt eine eigene, signierte Session (`office_session`, 12 Stunden, `httpOnly`, `sameSite: lax`).
   - **Schlüssel der Session:** Er wird per HKDF aus dem Service-Token abgeleitet. Das Office braucht kein eigenes Secret, und eine Rotation des Tokens beendet alle Sessions.
   - **Rücksprung:** Das Portal erlaubt nur die Callback-Adresse des Offices seiner Stufe, das Office leitet nur auf eigene Pfade weiter.
   - **Owner-Rechte:** Sie gehen als `canManage` in die Session, zum Beispiel für die Mitarbeiter-Einstellungen.
4. **Hosting auf Cloudflare Workers per OpenNext (`@opennextjs/cloudflare`):**
   - **Deploy:** Der Workflow `.github/workflows/office-deploy.yml` liefert aus, wie bei der API:
     - Branch `dev` geht an `uguroezdamar-office-dev` unter `office-dev.uguroezdamar.com`.
     - Branch `main` geht an `uguroezdamar-office` unter `office.uguroezdamar.com`.
   - **Domains:** Die Custom Domains legen DNS-Eintrag und Zertifikat beim Deploy selbst an.
   - **Token:** Das Office nutzt das `API_SERVICE_TOKEN` aus den GitHub-Environments der API (`api-dev`, `api-production`).
   - **Adressen:** `API_URL` und `PORTAL_URL` stehen je Stufe als `vars` in `apps/office/wrangler.jsonc`. Das Portal findet das Office über `VERCEL_ENV`; `OFFICE_URL` überschreibt das.
   - **Warum nicht Vercel:** Ein drittes Vercel-Projekt bräuchte DNS-Einträge, die nur der Owner im Cloudflare-Dashboard anlegen kann. Auf Workers richtet sich die Subdomain mit dem vorhandenen Deploy-Token selbst ein, Dev und Produktion getrennt wie bei der API.
   - **Warum nicht vinext:** Cloudflare empfiehlt für neue Projekte vinext. Hier bleibt es bei echtem Next.js, weil der Owner eine Next.js-App wollte und Site und Portal dieselbe Version nutzen.
5. **Lokal:**
   - **Start:** `pnpm dev:office` startet Portal (:3101) und Office (:3102) mit den dev-Secrets. Die Anmeldung läuft über das lokale Portal.
   - **Worker-Build:** `opennextjs-cloudflare build` läuft unter Windows nicht (Symlinks) und daher nur im Deploy-Workflow.

## Folgen

- **Workers Free:** Er erlaubt 3 MiB komprimierten Code und 10 ms CPU je Anfrage. Der Workflow gibt die Bundle-Größe aus. Werden die Grenzen knapp, ist Workers Paid nötig; das ist ohnehin eine offene Entscheidung des Owners.
- **Dev ansehen:** `office-dev.uguroezdamar.com` meldet über die Portal-Preview von `dev` an. Diese ist durch Vercel geschützt; der Owner kommt mit seinem Vercel-Konto durch.
- **Produktion:** Mit dem nächsten Release-PR `dev → main` entsteht `office.uguroezdamar.com`. Der Production-Deploy läuft über das Environment `api-production`.
