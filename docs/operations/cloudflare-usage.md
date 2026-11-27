# Cloudflare-Verbrauch der Agenten-API

**Zweck:** Wofür `apps/api` Cloudflare-Kontingent verbraucht, je Funktion geschätzt, und wovon die API bei Cloudflare abhängt. Entscheidungen: [ADR 0024](../architecture/decisions/0024-agent-platform-on-cloudflare.md), [ADR 0025, Nachträge](../architecture/decisions/0025-synchronisierte-agentenpraesenz.md), [ADR 0040](../architecture/decisions/0040-platform-core-and-providers.md).

Cloudflare ist hier ein Anbieter, nicht die Architektur. Der Kern spricht nur mit den Ports in `apps/api/src/platform/ports.ts`. Die Tabelle unten zeigt, welcher Port heute auf welchem Cloudflare-Dienst läuft und was ein Wechsel bedeuten würde.

## Abhängigkeiten

| Port | Cloudflare-Dienst heute | Wofür | Kontingent (Workers Free) | Austauschbar durch |
| --- | --- | --- | --- | --- |
| `SqlPort` | D1 `agents` | Threads, Aufgaben, Ereignisse, Workflows, Freigaben, `live_presence` | 5 Mio. Lesezeilen, 100.000 Schreibzeilen am Tag | SQLite, libSQL, Postgres (Dialekt prüfen) |
| `KeyValuePort` | KV | Einmal-Tickets (Office-Anmeldung), Caches | 100.000 Lesungen, 1.000 Schreibungen am Tag | Redis, SQL-Tabelle |
| `BlobPort` | R2 | Anhänge, Artefakte | 10 GB, 1 Mio. Class-A-Operationen im Monat | S3-kompatibel |
| `ActorStatePort` / `ActorDirectory` | Durable Objects (`AgentRuntime`, `LiveHub`, `OfficePresence`, `KnowledgeIndexer`, `Workstation`, `NodeSession`) | ein Gespräch, Live-Verbindungen, Büro-Zustand, Indexierung | **100.000 Requests am Tag**, der knappste Wert | Prozess je Actor plus Queue, z. B. Node mit SQLite |
| `VectorIndexPort` | Vectorize | Wissenssuche | 30 Mio. abgefragte Dimensionen im Monat | pgvector, Qdrant |
| `InferencePort` | Workers AI (Embeddings) | Vektoren fürs Wissen | 10.000 Neurons am Tag | jeder Embedding-Anbieter |

Sprachmodelle (Gemini, DeepSeek, Modal) laufen über die Anbieter-Gateways und zählen nicht zum Cloudflare-Kontingent. Ihre Kosten stehen in `events.cost_usd`.

## Verbrauchsmodell: Durable-Objects-Requests

Jeder Aufruf eines Durable Objects zählt als ein Request: RPC, `fetch`, Alarm und jede eingehende WebSocket-Nachricht, die das Objekt weckt. Ein Ping, den `setWebSocketAutoResponse` beantwortet, zählt nicht.

| Vorgang | Requests seit Nachtrag 2 | Vorher |
| --- | --- | --- |
| Office öffnen (Raum laden, Ticket, WebSocket) | 3 (`configure`, `issueTicket`, `fetch`) | 4 und mehr, dazu ein `setViewers` |
| Office offen, niemand arbeitet | 0 pro Minute | bis zu 40 pro Minute (Bewegungsalarme und Broadcasts) |
| Gespräch ansehen | 1 (`view`) | 2 (`history` und `status`) |
| Gespräch ändern (PATCH) | höchstens 1 `status` | 2 |
| Nachricht an einen Agenten, eine Stufe | 1 (`chat`) plus 1 Alarm je Stufe | gleich |
| Ereignis, niemand verbunden | 0 Hub, Office nur bei Tätigkeitswechsel | 1 Hub und 1 Office je Ereignis |
| Ereignis, Browser verbunden | 1 Hub, plus Office bei Tätigkeitswechsel | gleich |
| Gestreamter Text, niemand verbunden | 0 | 1 pro Sekunde |
| Gestreamter Text, Browser verbunden | 1 pro Sekunde | 4 pro Sekunde (vor Nachtrag 1) |

**Faustregel für einen Arbeitstag:** Ein Agent mit 20 Stufen und 15 Ereignissen pro Stufe braucht ohne Zuschauer etwa 20 Alarme, 1 `chat` und die Office-Aufrufe der Tätigkeitswechsel, zusammen unter 100 Requests. Mit offenem Office kommen die Hub-Broadcasts dazu: rund 300 Ereignisse und eine Minute gestreamter Text je Stufe, zusammen etwa 1.500 Requests. Das Kontingent reicht damit für deutlich über 50 solcher Agenten-Tage. Vor Nachtrag 1 hat ein einziges offenes Office über den Tag mehr als 50.000 Requests verbraucht.

## Wer zuhört: `live_presence`

Der `LiveHub` schreibt beim Verbinden und beim Schließen jedes Sockets, wie viele Verbindungen offen sind und wie viele davon Office-Ansichten sind (Migration `0029_live_presence.sql`). Sender lesen das in D1, bevor sie den Hub aufrufen.

- `emit()` liest den Wert in derselben Anweisung, die das Ereignis speichert (`RETURNING … (SELECT sockets …)`). Das kostet keinen zusätzlichen D1-Aufruf.
- Gestreamter Text fragt einmal je Stufe nach.
- `OfficePresence` veröffentlicht nur, wenn ein Office offen ist.

**Grenzfälle:**

- Bricht ein Deploy Verbindungen ab, ohne dass `webSocketClose` läuft, bleibt ein zu hoher Wert stehen. Dann wird wie früher gesendet, bis der nächste Socket schließt. Das ist harmlos.
- Der Wert fehlt nur vor der ersten Verbindung nach der Migration. Ein Browser lädt beim Verbinden ohnehin den aktuellen Stand (Snapshot und Ereignisse seit seiner letzten ID).

## Beobachten

- **Heute:** Im Cloudflare-Dashboard unter *Workers & Pages → Durable Objects → Metrics*, aufgeteilt nach Klasse. Dort zeigt sich, welcher Actor verbraucht. Die Modellkosten stehen in `events` (`tokens_in`, `tokens_out`, `cost_usd`) und erscheinen im Portal.
- **Geplant:** ein lesender Endpunkt `/api/usage/infra`. Er fragt die GraphQL-Analytics-API von Cloudflare nach Durable-Objects-, D1- und KV-Nutzung des laufenden Tages ab und vergleicht sie mit den Grenzen oben. Das Office zeigt ab 70 % eine Warnung.
  - Voraussetzung ist ein eigener, nur lesender API-Token (`Account Analytics: Read`). Der Owner legt ihn an. Der Token wird im Secrets-Manifest deklariert und von `api-deploy.yml` als Worker-Secret gesetzt.

## Was bewusst nicht passiert

- **Kein Redis:** Die Last kommt aus unnötigen Aufrufen, nicht aus fehlender Geschwindigkeit. Ein weiterer Dienst wäre eine weitere Abhängigkeit ohne belegten Nutzen.
- **Keine Migration weg von D1:** Die Ports halten den Weg offen. Ein Wechsel lohnt erst, wenn D1-Grenzen gemessen erreicht werden.
- **Workers Paid:** Mit dem bezahlten Plan (5 USD im Monat) fällt die Tagesgrenze von 100.000 Requests weg. Die Optimierungen bleiben trotzdem richtig, weil jeder Request dann Geld kostet.
