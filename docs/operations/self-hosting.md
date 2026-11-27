# Selbst hosten mit Docker

**Zweck:** Die Plattform läuft ohne Cloudflare und ohne Vercel: Postgres, die Agenten-API als Node-Host, das Portal und das Office. Entscheidung: [ADR 0045](../architecture/decisions/0045-agent-runtime-independent-of-durable-objects.md), Phase R4 der [Plattform-Migration](../architecture/platform-migration.md#p4-neu-zweite-runtime).

## Was läuft

| Dienst | Adresse | Inhalt |
| --- | --- | --- |
| `postgres` | `127.0.0.1:5433` | Postgres 17 mit zwei Datenbanken: `portal` (Drizzle, `packages/server`) und `agents` (Agenten-API) |
| `migrate` | – | wendet einmal die Portal-Migrationen an und beendet sich |
| `api` | `http://localhost:3103` | `apps/node-host` in der Betriebsart `cloud`. Das Schema der Agenten-API (`apps/api/migrations-postgres`) legt der Host beim ersten Start an |
| `portal` | `http://localhost:3101` | `apps/portal` mit `next start` |
| `office` | `http://localhost:3102` | `apps/office` mit `next start`; die Anmeldung läuft über das Portal |

Alle Ports sind nur auf diesem Rechner erreichbar. Die Dienste finden sich im Compose-Netz unter ihren Namen. Der Browser erreicht die API über `API_PUBLIC_URL` (`http://localhost:3103`) für die Live-Verbindung.

## Starten

Secrets liegen nie in einer Datei dieses Repositorys. Compose liest sie aus der Umgebung der Shell.

Mit Infisical, der Owner-Weg, nutzt du die Werte von `dev`. `PROVIDER_KEYS_SECRET` steht dort nicht (nur in `prod`); setze ihn vorher wie unten beschrieben:

```powershell
infisical run --env=dev -- docker compose -f deployments/docker/compose.yaml up --build
```

Ohne Infisical setzt du sie selbst:

```powershell
$env:API_SERVICE_TOKEN = node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
$env:ADMIN_API_KEY = node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
$env:PROVIDER_KEYS_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
$env:DEEPSEEK_API_KEY = "<eigener Schlüssel>"
docker compose -f deployments/docker/compose.yaml up --build
```

**Werte:**
- **`API_SERVICE_TOKEN`:** Pflicht, mindestens 32 Zeichen. Portal und Office melden sich damit bei der API.
- **`ADMIN_API_KEY`:** Pflicht für das Portal.
- **Modellschlüssel:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY` und `OPENROUTER_API_KEY` sind optional. Schlüssel lassen sich auch im Portal eintragen.
- **`PROVIDER_KEYS_SECRET`:** Pflicht, ein fester Schlüssel für die im Portal hinterlegten Modellschlüssel. Erzeugen wie den Token oben. Geht er verloren, sind die Schlüssel unlesbar und müssen neu eingetragen werden.

## Erstes Admin-Konto

Das Portal braucht ein Owner-Konto. Lege es vom Rechner aus gegen das Compose-Postgres an:

```powershell
$env:DATABASE_URL_DIRECT = "postgres://postgres@127.0.0.1:5433/portal"; node tooling/cli/src/scripts/admin.ts create du@example.com
```

Das Passwort fragt der Befehl verdeckt ab.

## Erreichbar über Cloudflare Tunnel

Der Node-Host auf deinem Rechner wird über einen benannten Cloudflare Tunnel unter einer festen Adresse erreichbar, ohne offenen Port und ohne Kreditkarte. Tunnels sind im kostenlosen Plan enthalten. So ist er der Rückfall, wenn das Kontingent der Durable Objects knapp wird ([ADR 0045, Nachtrag](../architecture/decisions/0045-agent-runtime-independent-of-durable-objects.md#nachtrag-27112026-cloudflare-wieder-zuerst)).

**Einmal einrichten (Owner):**
1. **Tunnel anlegen:** Im Cloudflare-Dashboard des Kontos mit der Zone `uguroezdamar.com` unter *Zero Trust → Networks → Tunnels* einen Tunnel `agents-local` vom Typ *cloudflared* anlegen. Den angezeigten Token direkt in Infisical übernehmen:
   ```powershell
   pnpm ugur secrets set AGENTS_TUNNEL_TOKEN --stage dev
   ```
2. **Adresse:** Unter *Public Hostname* `agents-local.uguroezdamar.com` mit Service `HTTP` und `api:3103` eintragen. Cloudflare legt dafür einen DNS-Eintrag an; nach ADR 0023 ist das die Freigabe des Owners.

**Starten:** Nur Postgres, API und Tunnel, ohne lokales Portal und Office. Vorher `PROVIDER_KEYS_SECRET` setzen, wie oben beschrieben.

```powershell
infisical run --env=dev -- docker compose -f deployments/docker/compose.yaml --profile tunnel up -d --build postgres api tunnel
```

**Prüfen:**

```powershell
curl.exe https://agents-local.uguroezdamar.com/api/health
```

Erwartet ist `{"ok":true,"env":"docker"}`. Ohne Service-Token antwortet jede andere Route mit 401.

**Umschalten:** Damit das gehostete Portal (Vercel-Preview) und das Office von dev mit dem Tunnel-Host sprechen, setzt du `API_URL` in Infisical `dev` auf `https://agents-local.uguroezdamar.com` und deployst beide neu; der Rückweg ist der alte Wert `https://api-dev.uguroezdamar.com`. Der Tunnel-Host hat seine eigene Datenbank: Er sieht nicht, was auf Cloudflare (D1) liegt, und umgekehrt. Ein gemeinsamer Stand kommt erst mit R6.

**Probelauf am 27.11.2026:** API-Image aus dem Commit-Stand hinter einem kurzlebigen Quick Tunnel (`trycloudflare.com`), danach wieder abgebaut. Über Cloudflares Netz kamen zurück:
- Health-Check
- 401 ohne Token
- WebSocket mit `hello`, `ping` und `pong`
- Ablehnung eines zweiten Einsatzes desselben Tickets

## Daten

- **Volume `postgres`:** Portal und Agenten, also Gespräche, Aufgaben, Ereignisse und Aufträge.
- **Volume `api-data`:** der eigene Kleinkram des Hosts: Einmal-Tickets, Caches, Büro- und Index-Actors.
- **Löschen:** `docker compose -f deployments/docker/compose.yaml down -v` löscht beides unwiderruflich.

## Was noch fehlt

- **Wissenssuche:** Die Volltextsuche funktioniert, Vektoren und Embeddings fehlen; sie kommen mit pgvector.
- **Workstation:** Es gibt keine Docker-Workstation für Agenten (ADR 0036); `code_verify` läuft über die CI.
- **Ein Host:** Ein zweiter API-Container würde dank Lease funktionieren, ist aber noch nicht erprobt (R5).
