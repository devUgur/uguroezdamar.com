# ADR 0031: GitHub App als Zugang der Agenten zu GitHub

- Status: accepted
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0029](0029-projects-as-repository-access.md), [ADR 0024](0024-agent-platform-on-cloudflare.md)

## Kontext

Die Agenten griffen bisher mit einem Fine-grained Personal Access Token (`AGENT_GITHUB_TOKEN`) auf GitHub zu. Das hat drei Schwächen:

1. Ein Token hat genau einen Besitzer: das Konto oder eine einzelne Organisation. Organisationen und Konto gleichzeitig sind nicht möglich.
2. Er läuft ab (höchstens ein Jahr) und ist ein langlebiges Passwort, das in einem Secret liegt.
3. Seine Rechte gelten für alle freigegebenen Repositories gleich, und ein Mensch muss ihn erneuern.

## Entscheidung

1. **Eine GitHub App ist der bevorzugte Zugang.** Die API signiert ein JWT (RS256, höchstens zehn Minuten) mit dem privaten Schlüssel der App und tauscht es je Konto gegen ein Installations-Token (eine Stunde gültig). Die Tokens liegen im KV-Namespace `CONFIG`, bis sie fünf Minuten vor Ablauf erneuert werden; die Liste der Installationen wird fünf Minuten gecacht. Der Schlüssel verlässt das Modul `apps/api/src/github/app.ts` nie.
2. **Der Token bleibt als Rückfall.** Wo die App für ein Konto nicht installiert ist, nimmt die API `AGENT_GITHUB_TOKEN`, wenn er gesetzt ist; sonst meldet sie klar, dass die App dort fehlt. Ohne App läuft alles wie bisher mit dem Token.
3. **Die Besitzer-Freigabe bleibt die Grenze.** Die App kann auf mehr Konten installiert sein, als Agenten nutzen dürfen: Nur Besitzer in `GITHUB_OWNERS` zählen (ADR 0029). Das Portal zeigt unter `/projects`, wo die App installiert ist und welche Konten freigegeben sind (`GET /api/github/status`). Eine Organisation wird nutzbar, indem man die App dort installiert und den Besitzer in `GITHUB_OWNERS` einträgt.
4. **Anlegen von Repositories bleibt am Token.** Ein Installations-Token kann keine Repositories auf einem persönlichen Konto anlegen (das braucht ein Nutzer-Token). `repo_create` nutzt deshalb weiter `AGENT_GITHUB_TOKEN` mit `Administration: Read and write`; in Organisationen ginge es über die App mit dem Recht `Administration`, das wir nicht vergeben.
5. **Rechte der App** (Repository permissions): `Contents` Read and write, `Pull requests` Read and write, `Checks` Read-only; `Metadata` ist automatisch Read-only. Kein `Administration`, kein `Workflows`, keine Organisationsrechte, keine Webhooks.
6. **Secrets.** `AGENT_GH_APP_ID` und `AGENT_GH_APP_PRIVATE_KEY` (der Name darf nicht mit `GITHUB_` beginnen) liegen als GitHub-Actions-Secrets und werden beim Deploy zu Worker-Secrets. `pnpm ugur api secrets --apply` fragt die App-ID ab und liest den Schlüssel aus der heruntergeladenen `.pem`-Datei, ohne ihn anzuzeigen. Der Schlüssel darf als PKCS#1 (so liefert ihn GitHub) oder PKCS#8 vorliegen.

## App anlegen (einmalig)

1. `github.com/settings/apps` → „New GitHub App“.
2. Name: `uguroezdamar-agents`. Homepage URL: `https://uguroezdamar.com`. Webhook: „Active“ abwählen.
3. Repository permissions: Contents „Read and write“, Pull requests „Read and write“, Checks „Read-only“. Sonst nichts.
4. „Where can this GitHub App be installed?“: „Only on this account“.
5. „Create GitHub App“. Auf der Seite der App die **App ID** notieren und unter „Private keys“ „Generate a private key“: Die `.pem`-Datei wird heruntergeladen.
6. Links „Install App“ → das Konto wählen → „All repositories“ oder „Only select repositories“.
7. `pnpm ugur api secrets --apply`: App-ID und Pfad der `.pem`-Datei eingeben. Danach die `.pem`-Datei löschen.

Das Portal zeigt anschließend „GitHub App verbunden“. Den `AGENT_GITHUB_TOKEN` braucht es dann nur noch zum Anlegen von Repositories.

## Alternativen

- **GitHub-MCP-Server direkt am Agenten:** verworfen. Er umgeht Freigaben, Besitzer-Freigabe und die Sperre für auswertende Modelle, und seine Werkzeuge belegen Kontext.
- **OAuth-App mit Nutzer-Token:** verworfen. Das Token hängt an einem Menschen und müsste erneuert werden; die App-Installation braucht keine Anmeldung zur Laufzeit.
- **Weiter nur Token:** verworfen wegen der drei genannten Schwächen.

## Konsequenzen

- Neues Modul `apps/api/src/github/` (`app.ts`, `credentials.ts`); alle GitHub-Aufrufe der Werkzeuge und der Projektverwaltung holen ihr Token über `githubToken`.
- Ein Aufruf kostet beim ersten Mal bis zu zwei zusätzliche externe Anfragen (Installationen, Token), danach keine, solange der Cache hält. Sie zählen gegen das Subrequest-Budget der Etappe.
- Die Repository-Liste vereint die Repositories der App-Installationen mit denen des Tokens ohne Doppelte.
- Tests: `tests/api-github-app.test.ts` (Schlüsselformat, JWT-Signatur, Cache, Rückfall, Liste).

## Rückprüfung

Neu entscheiden, wenn Organisationen einbezogen werden (eigene Installation, Eintrag in `GITHUB_OWNERS`), wenn Repositories in Organisationen angelegt werden sollen, oder wenn GitHub die Installations-Token-Regeln ändert.
