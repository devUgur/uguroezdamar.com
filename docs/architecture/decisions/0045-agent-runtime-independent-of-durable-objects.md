# ADR 0045: Agenten-Runtime unabhängig von Durable Objects

- Status: accepted (Owner-Entscheidungen vom 27.11.2026 unter „Entscheidungen des Owners“)
- Datum: 2026-11-27
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0040](0040-platform-core-and-providers.md) (zieht Phase P4 vor und schneidet sie neu), [ADR 0024](0024-agent-platform-on-cloudflare.md), [ADR 0025](0025-synchronisierte-agentenpraesenz.md)
- Umsetzung: [Plattform-Migration, Abschnitt „P4 neu: zweite Runtime“](../platform-migration.md#p4-neu-zweite-runtime)

## Kontext

Am 27.11.2026 war das Durable-Objects-Kontingent von Workers Free (100.000 Requests am Tag) zweimal erschöpft. Danach fiel nicht nur das Office aus, sondern auch der Agenten-Chat. Die Nachträge 1 und 2 zu ADR 0025 senken den Verbrauch stark ([Verbrauchsmodell](../../operations/cloudflare-usage.md)). Die Ursache bleibt: Die Ausführung der Agenten hängt an genau einem Cloudflare-Dienst.

**Befund im Code (`dev`, 483613e):**

| Vorgang | Weg | Hängt an |
| --- | --- | --- |
| Nachricht senden | `index.ts` und `work/tasks.ts`, `workflow/steps.ts` → `env.AGENTS.get(…).chat()` | Durable Object `AgentRuntime` je Thread |
| Verlauf und Status | `index.ts` → `stub.view()` | dasselbe Objekt |
| Freigabe fortsetzen | `index.ts` → `stub.resume()` | dasselbe Objekt |
| Nächste Stufe | `ThreadRuntime.alarm()`, geplant mit `state.setAlarm()` | Alarm desselben Objekts |
| Gesprächsverlauf | `state.sql.exec(…)` auf der Tabelle `messages` | SQLite **im** Objekt, synchron |
| Laufzustand, Eingang, Zusammenfassung | `state.get/put` (`RUN`, `INBOX`, `SUMMARY`, `PRIVATE_THREAD`) | Speicher **im** Objekt |
| Ereignisse | `emit()` → D1, danach Hub und Office | D1; Hub und Office nur bei Zuhörern, Fehler abgefangen |

**Lokale Entwicklung (Audit vom 27.11.2026, nur lesend):**
- **API läuft lokal nicht:** `pnpm dev:office` startet nur Portal (:3101) und Office (:3102), siehe `LOCAL_ORIGINS` in `tooling/cli/src/lib/stages.ts`. Die Agenten-API ist kein Teil eines lokalen Laufs.
- **Fremdes Ziel:** Beide Apps lesen `API_URL` aus Infisical `dev`; dort steht `https://api-dev.uguroezdamar.com` (`STAGE_TARGETS` in `tooling/cli/src/commands/api.ts`). Ein Chat auf `localhost` läuft deshalb auf dem Cloudflare-Worker von dev und dessen Durable Objects.
- **Keine Remote-Bindings:** `wrangler.jsonc` hat keine `remote: true`. Ein lokales `wrangler dev` würde die Objekte simulieren. Es wird nur nicht gestartet, und die Secrets der API liegen in GitHub Actions, nicht lokal (ADR 0024).
- **Gemeinsames Kontingent:** Das Kontingent gilt für das ganze Konto. Lokales Testen gegen api-dev verbraucht dieselben 100.000 Requests wie die Produktion und kann sie stilllegen.

**Was schon trägt:**
- `ThreadRuntime` ist plattformfrei und spricht nur mit `ActorStatePort` (ADR 0040, P1).
- `runtime/loop.ts`, Werkzeuge, Policy und Workflow laufen in den Tests auf Node mit SQLite.

**Was fehlt:**
- **Zustand nur lokal:** Der Zustand eines Gesprächs liegt im Host, der das Gespräch gerade führt. Ein zweiter Host sieht ihn nicht.
- **Synchrones SQL:** `state.sql.exec` ist synchron und lässt sich deshalb nicht auf eine entfernte Datenbank legen.
- **Weckzeiten:** Die Fortsetzung ist ein Alarm des Objekts, kein Auftrag, den jeder Host übernehmen kann.
- **Kein zweiter Host:** Einen produktiven Host außer Cloudflare gibt es nicht.

## Entscheidung

**1. Ausführung und Zustand werden getrennt.** Der Zustand eines Gesprächs liegt in gemeinsamer SQL-Datenbank, nicht mehr im Host:
- Verlauf, Laufzustand, Eingang und Zusammenfassung.
- Geplante Fortsetzungen.

Jeder Host kann jeden Lauf fortsetzen, der in der Datenbank steht.

**2. Zwei neue Ports ersetzen die direkte Nutzung von `ActorStatePort` in `ThreadRuntime`:**

| Port | Aufgabe | Cloudflare heute | Gemeinsamer SQL-Adapter |
| --- | --- | --- | --- |
| `ThreadStorePort` | Nachrichten anhängen und lesen, Laufzustand, Eingang, Zusammenfassung; **asynchron** | Durable-Object-Speicher (Übergang, keine Datenwanderung) | Tabellen `thread_messages`, `thread_state` |
| `SchedulerPort` | „Thread X ab Zeitpunkt T fortsetzen“, abbrechen | Alarm des Objekts | Tabelle `scheduled_jobs` mit Lease |

**3. Fortsetzung als Auftrag mit Lease:**
1. Eine Nachricht wird gespeichert. Für ihren Thread entsteht ein Auftrag mit fester ID.
2. Ein Host übernimmt den Auftrag mit einer zeitlich begrenzten Lease (`UPDATE … WHERE lease_until < now`, eine Zeile gewinnt).
3. Er führt eine Stufe aus, speichert Ergebnis und Fortschritt und plant die nächste Stufe.
4. Stirbt der Host, übernimmt nach Ablauf der Lease ein anderer.

Eine Stufe, die schon gespeichert ist, läuft nicht zweimal. Externe Aktionen bekommen einen Idempotenzschlüssel aus Lauf, Stufe und Werkzeugaufruf. Das gilt für Commit, PR, Deploy und Issue. Vor einer Wiederholung wird das Ergebnis geprüft.

**4. Zweiter Host: `apps/node-host`.**
- **Prozess:** Node-24-Prozess mit demselben Fetch-Handler wie der Worker und einer Scheduler-Schleife, die fällige Aufträge übernimmt.
- **Live-Verbindungen:** WebSocket im Prozess, zusätzlich SSE.
- **Adapter:** Lokal und in Tests `node:sqlite`. Im Betrieb die gemeinsame Datenbank (O-R2).

**5. Live und Office sind nicht mehr Voraussetzung.**
- Chat und Ausführung funktionieren, auch wenn Hub oder Office nicht erreichbar sind.
- Portal und Office fallen ohne WebSocket auf Abfragen ab der letzten Ereignis-ID zurück, zuerst per SSE, sonst per Polling.
- Das Office zeigt Zustand aus der Datenbank und steuert nichts.

**6. Cloudflare bleibt ein Anbieter.**
- Durable Objects bleiben für den Live-Hub, das Office und die Workstation (ADR 0036), solange sie dort nützen.
- Gespräche führt ein Durable Object nur noch als Host für `ThreadRuntime`, mit denselben Ports wie Node, und ab Phase R6 gar nicht mehr.

**Ausdrücklich nicht:**
- **Durable Objects bleiben:** Keine wird sofort gelöscht.
- **Kein zweiter Endpunkt:** Es entsteht kein zweiter API-Endpunkt, der intern wieder dieselben Objekte ruft.
- **Kein Redis jetzt:** Redis oder Valkey kommt erst, wenn mehrere Instanzen gleichzeitig laufen.
- **Keine Microservices:** Ein Fetch-Handler, zwei Hosts.
- **Kein Hatchet jetzt:** Der SQL-Ablauf aus P3 bleibt. Hatchet wird erst geprüft, wenn er an Grenzen stößt.
- **Keine Brücke ohne Umbau:** Workers Paid ersetzt diesen Umbau nicht (O-R4).

**7. Drei Betriebsarten, eine Codebasis.** Die Anbieter werden an einer Stelle beim Start gewählt und geprüft, nicht im Code verteilt:

| Betriebsart | Wofür | Cloudflare |
| --- | --- | --- |
| **local** (Standard für `pnpm dev:*`) | Entwicklung: Node-Host, Postgres in Docker, lokaler Scheduler, Live im Prozess, Dateien lokal, Modelle nach Wahl (auch Ollama) | **keine** Cloudflare-Ressource |
| **cloud-dev** | Integration: lokaler Host, ausdrücklich gewählte Cloud-Dienste (Dev-Datenbank, R2, Workers AI) | nur, was konfiguriert ist |
| **cloud** | Betrieb: Node-Host primär, Cloudflare zweiter Host, gemeinsames Postgres | als Anbieter |

Modellanbieter sind kein Runtime-Host: Ollama kann lokal rechnen, während der Agent auf einem Cloud-Host läuft.

## Entscheidungen des Owners (27.11.2026)

| Nr. | Frage | Entscheidung |
| --- | --- | --- |
| O-R1 | Wo läuft der Node-Host? | Anbieterneutral: ein Docker-Image, kein anbieterspezifischer Code. Zuerst Northflank (kostenlose Sandbox, laut Anbieter ohne Schlafen; Grenzen vor dem Deploy prüfen) als Test, Railway Hobby (ab 5 USD im Monat) als erster bezahlter Host. Render und Koyeb (schlafen ein) scheiden für Agentenläufe aus. |
| O-R2 | Gemeinsame Datenbank | **PostgreSQL**, in der Cloud Neon, lokal Postgres in Docker. Eine Datenbanktechnologie in allen Umgebungen; SQLite bleibt Testhilfe und wird nicht ungeprüft Produktionsadapter. |
| O-R3 | Primärer Host | **Node-Host primär**, Cloudflare zweiter Host und für Live-Hub und Office. |
| O-R4 | Brücke | Vorerst **kein** Workers Paid; der Owner bucht es voraussichtlich in einigen Tagen. Bis R1 steht: lokal möglichst nicht gegen api-dev testen. |

Abwägung, wie sie dem Owner vorlag:

| Nr. | Frage | Vorschlag | Kosten und Folgen |
| --- | --- | --- | --- |
| O-R1 | Wo läuft der Node-Host? | Railway, Hobby-Plan (immer laufend, WebSocket, Docker) | ab 5 USD im Monat; der Free-Plan legt Dienste schlafen. Alternativen: Fly.io, eigener VPS (Hetzner) |
| O-R2 | Welche gemeinsame Datenbank haben beide Hosts? | PostgreSQL bei Neon (schon für Site und Portal im Einsatz), eigenes Projekt oder eigene Datenbank für die API | Die SQL der API (SQLite-Dialekt: `unixepoch()`, `INSERT OR IGNORE`, FTS5) braucht einen Übersetzer oder Umbau. D1 ist von außerhalb Cloudflares nur über die REST-API erreichbar und als gemeinsame Datenbank ungeeignet |
| O-R3 | Welcher Host ist primär? | Node auf Railway primär, Cloudflare zweiter Host | Das Portal braucht `API_URL` je Host und eine Umschaltung nach Gesundheitsprüfung |
| O-R4 | Brücke bis R4? | Workers Paid buchen (5 USD im Monat): keine Tagesgrenze für Durable Objects | Behebt die Ausfälle sofort, kostet je Request. Ohne Brücke fällt der Chat weiter aus, wenn das Kontingent erschöpft ist |

## Folgen

**Positiv:**
- Ein erschöpftes Kontingent oder ein Ausfall eines Anbieters legt die Agenten nicht mehr still.
- Laufzustand ist abfragbar (welcher Lauf, welche Stufe, welcher Host), statt in Objekten verborgen.
- Selbsthosting (P4 alt) und lokale Nodes (ADR 0042) nutzen dieselben Ports.

**Negativ und Risiken:**
- Mehr Schreibzugriffe auf die gemeinsame Datenbank: jede Nachricht und jede Stufe. Bei D1 zählt das gegen die 100.000 geschriebenen Zeilen am Tag; das Verbrauchsmodell wird nachgezogen.
- **Datenwanderung:** Bestehende Verläufe liegen in den Durable Objects. R3 kopiert sie beim ersten Zugriff in die Datenbank und markiert das Objekt als übernommen. Bis dahin liest der Cloudflare-Adapter aus beiden.
- Der Postgres-Umbau (O-R2) ist der größte Einzelposten. Er betrifft rund 190 Stellen mit SQL.

## Abnahme

- **Failover:** Mitten in einem Agentenlauf wird Cloudflare für die API abgeschaltet. Der Node-Host übernimmt den Lauf nach Ablauf der Lease. Keine Nachricht geht verloren, kein Werkzeugaufruf mit Außenwirkung läuft doppelt. Der Host-Wechsel steht im Ereignisprotokoll.
- **Unabhängigkeit vom Office:** Ist das Office nicht erreichbar, bleiben Chat und Aufgaben voll nutzbar.
- **Ohne WebSocket:** Portal und Office zeigen neue Ereignisse innerhalb von fünf Sekunden über SSE oder Polling.
