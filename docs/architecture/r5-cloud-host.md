# R5: Node-Host in der Cloud (Plan)

**Zweck:** Die Agenten-API von dev läuft als Node-Host in der Cloud, auf Neon-Postgres, und Portal und Office von dev sprechen mit ihr. Damit hängt dev nicht mehr am Kontingent der Durable Objects. Entscheidung und Rahmen: [ADR 0045](decisions/0045-agent-runtime-independent-of-durable-objects.md), Owner-Entscheidungen O-R1 bis O-R3. Vorher: R1 bis R4 ([Plattform-Migration](platform-migration.md#p4-neu-zweite-runtime)).

**Stand:** Plan vom 27.11.2026. Die Schritte 1, 2, 3 und 10 sind umgesetzt. Die übrigen ruhen: Northflank verlangt eine Kreditkarte, deren Prüfbuchung gescheitert ist. Cloudflare ist wieder die erste Laufzeit ([ADR 0045, Nachtrag](decisions/0045-agent-runtime-independent-of-durable-objects.md#nachtrag-27112026-cloudflare-wieder-zuerst)). Produktion bleibt bis R6 und bis zur Freigabe des Owners auf Cloudflare.

## Was die Recherche ergab

| Anbieter | Stand laut Quellen vom November 2026 | Folge für uns |
| --- | --- | --- |
| **Northflank Sandbox** | 2 Dienste, 2 Jobs, 1 Datenbank, Ressourcen bis 20 USD im Monat, laufend ohne Schlafen. Gedacht für Tests und Hobby, nicht für Produktion. Ob eine Karte nötig ist, widersprechen sich die Quellen. | Genau ein Node-Host für **dev**. 0,5 vCPU und 1 GB kosten rund 12 USD und passen in die 20 USD. Ein zweiter Host für prod passt nicht hinein. |
| **Railway Hobby** | ab 5 USD im Monat, auf die Nutzung angerechnet (O-R1) | erster bezahlter Host, für **prod** in R6 |
| **Neon Free** | 100 Projekte, 10 Branches je Projekt, 100 CU-Stunden Rechenzeit je Projekt und Monat, 1 GB je Projekt. Scale-to-zero nach 5 Minuten, auf Free nicht abschaltbar. | Ein **eigenes Projekt** für die Agenten-API mit den Branches `dev` und `prod`, damit sie ihr eigenes Rechenbudget hat und das der Site nicht verbraucht. |

Die Zahlen stammen aus Sekundärquellen und Neons FAQ. Vor dem Anlegen prüft der Owner die Seiten direkt: [northflank.com/pricing](https://northflank.com/pricing) und [neon.com/pricing](https://neon.com/pricing).

**Wichtigster Befund: Der Scheduler darf Neon nicht wach halten.**
- **Das Problem:** Der Host fragt heute jede Sekunde nach fälligen Aufträgen. Neon schläft erst nach 5 Minuten ohne Abfrage ein. Bei einer Abfrage je Sekunde bleibt der Rechner dauernd wach: 0,25 CU mal 730 Stunden sind etwa 180 CU-Stunden, fast doppelt so viel wie die 100 im Monat.
- **Die Lösung (Schritt 1):** Eigene Aufträge weckt der Host über einen Timer im Prozess, genau zum fälligen Zeitpunkt. Die Datenbank fragt er nur in einem seltenen Durchgang ab, für Aufträge eines anderen oder abgestürzten Hosts (alle 30 Minuten, die Lease dauert 15 Minuten). Im Leerlauf kostet das etwa 30 CU-Stunden im Monat; Arbeit kommt dazu.

## Schritte

| Nr. | Schritt | Ergebnis | Wer |
| --- | --- | --- | --- |
| 1 ✓ | **Neon schonen:** Timer für eigene Aufträge statt Abfrage jede Sekunde; Durchgang für fremde Aufträge alle `NODE_HOST_SWEEP_MS` (Standard 30 Minuten). Kein Health-Check fragt die Datenbank. | Leerlauf ohne Dauerlast auf Neon | Agent |
| 2 ✓ | **Cloud-Pflichten in `mode.ts`:** In `cloud` ist `PROVIDER_KEYS_SECRET` Pflicht, denn ein im Container erzeugter Schlüssel ginge beim Neustart verloren. Der Durchgang ist über `NODE_HOST_SWEEP_MS` einstellbar, mindestens 10 Sekunden. Rückruf-URLs folgen, sobald der Host welche braucht (Schritt 6). | Ein falsch konfigurierter Host startet nicht, statt halb zu laufen | Agent |
| 3 ✓ | **Image-Pipeline** (`.github/workflows/node-host-image.yml`, startet das Image danach einmal mit Postgres zur Probe): Workflow `node-host-image.yml` baut bei Push auf `dev` das Ziel `api` aus `deployments/docker/Dockerfile` und legt es als `ghcr.io/devugur/uguroezdamar-api:dev-<sha>` ab, dazu `:dev`. Northflank zieht das fertige Image, kein Build beim Anbieter. | Dasselbe Image für Northflank, Railway und Docker, kein anbieterspezifischer Build | Agent |
| 4 | **Konten anlegen:** Northflank-Konto mit Projekt `uguroezdamar` und Neon-Projekt `uguroezdamar-agents` mit den Branches `dev` und `prod`. Northflank-API-Token (nur dieses Projekt) und Neon-Verbindung `dev` kommen nach Infisical. | Zugänge, ohne dass ein Agent ein Konto anlegt | **Owner** |
| 5 | **Secrets in den Host:** `pnpm ugur northflank secrets --stage dev --apply` überträgt die nötigen Namen aus Infisical in eine Northflank-Secret-Group. Es zeigt nur Namen und folgt dem Muster von `pnpm ugur api secrets`. Neue Namen kommen zuerst ins Manifest. | Werte nie im Repository, nie im Log | Agent baut, **Owner** führt aus |
| 6 | **Dienst anlegen:** Northflank-Dienst `agents-dev` aus dem GHCR-Image, Port 3103 (HTTP, WebSocket), Health-Check `GET /api/health`, eine Instanz, Plan nf-compute-50. Die Einstellungen stehen versioniert in `deployments/northflank/agents-dev.json`, angewendet über die Northflank-API. | Laufender Host mit Neon `dev` | Agent bereitet vor, **Owner** gibt frei |
| 7 | **Adresse:** `agents-dev.uguroezdamar.com` als CNAME auf Northflank, nach dem DNS-Verfahren aus ADR 0023 mit Freigabe des Owners. `api-dev.uguroezdamar.com` bleibt der Cloudflare-Worker. | Feste Adresse, Cloudflare unberührt | **Owner** gibt frei |
| 8 | **Daten von dev:** Entweder übernimmt ein Export von D1 nach Neon Aufgaben, Projekte, Initiativen und Ereignisse, oder dev beginnt leer (O-R5). Verläufe in Durable Objects lassen sich erst in R6 übertragen. | dev ohne Datenverlust oder bewusst frisch | **Owner** entscheidet |
| 9 | **Umschalten von dev:** `API_URL` in Infisical `dev` zeigt auf `https://agents-dev.uguroezdamar.com` (Portal-Preview und Office `office-dev.`); der Rückweg ist der alte Wert. `pnpm ugur smoke` prüft beide Wege. | dev läuft auf dem Node-Host, Cloudflare bleibt Rückfall | Agent, nach Freigabe des Owners |
| 10 ✓ | **Rückfall ohne WebSocket:** Bricht die Live-Verbindung dreimal ab, gleichen Office (Chat ab der letzten Ereignis-ID, Raum über den Snapshot) und die Arbeitsansicht des Portals alle 5 Sekunden ab, bis die Verbindung wieder steht. Das Portal zeigt „Live getrennt, Abgleich alle 5 s“. | Live-Ansicht ohne WebSocket | Agent |
| 11 | **Abnahme:** Siehe unten. Erst danach geht es an R6. | | Agent prüft, **Owner** nimmt ab |

Die Schritte 1, 2, 3 und 10 sind erledigt (27.11.2026). Ein Test belegt, dass ein ruhender Host keine Anweisung an die Datenbank schickt.

## Owner-Entscheidungen in R5

| Nr. | Frage | Vorschlag |
| --- | --- | --- |
| O-R5 | Werden die Daten von dev übernommen oder beginnt dev leer? | Aufgaben, Projekte und Initiativen übernehmen, Gesprächsverläufe nicht (die kommen mit R6) |
| O-R6 | Neue Adresse oder `api-dev` umhängen? | Neue Adresse `agents-dev.`, damit Cloudflare als Rückfall unverändert bleibt |
| O-R7 | Wohin gehen Fehler und Logs? | Zuerst Northflank-Logs; ein eigener Log-Anbieter erst, wenn er gebraucht wird |

## Kosten

- **Northflank Sandbox:** 0 USD bis 20 USD Ressourcen im Monat; nf-compute-50 kostet etwa 12 USD daraus.
- **Neon Free:** 0 USD, solange das API-Projekt unter 100 CU-Stunden und 1 GB bleibt. Die Nutzung zeigt das Neon-Dashboard. Die Anzeige unter Verbrauch bekommt in R6 eine Neon-Zeile.
- **GHCR:** für ein privates Repository innerhalb des Kontingents von GitHub.

## Risiken

- **Sandbox nicht für Produktion:** Northflank nennt die Sandbox einen Test- und Hobby-Plan. Nur dev läuft dort; prod kommt in R6 auf Railway Hobby oder einen bezahlten Northflank-Plan.
- **Kaltstart:** Nach 5 Minuten Ruhe braucht die erste Abfrage einige hundert Millisekunden länger. Für Agentenläufe ist das unkritisch.
- **Zwei Wahrheiten in dev bis R6:** Während dev auf dem Node-Host läuft, sieht der Cloudflare-Worker von dev die neuen Daten nicht. Der Rückfall auf Cloudflare ist ein Rückfall auf den alten Stand, kein Failover. Echtes Failover kommt mit R6.
- **Kartenpflicht:** Northflank verlangt möglicherweise eine Zahlungsart, auch für die Sandbox. Die Quellen widersprechen sich.

## Abnahme

- **Ohne Cloudflare:** In dev läuft ein Agentenlauf vom Chat bis zur Antwort über `agents-dev.`. Kein Durable-Objects-Request entsteht dabei, prüfbar in der Verbrauchsanzeige.
- **Neustart:** Wird der Dienst mitten in einem Lauf neu gestartet, setzt der Host den Lauf nach Ablauf der Lease fort, und keine Nachricht fehlt.
- **Ohne WebSocket:** Das Office zeigt Ereignisse auch bei gesperrtem WebSocket innerhalb von 5 Sekunden.
- **Neon im Leerlauf:** Über einen Tag ohne Arbeit bleiben weniger als 2 CU-Stunden auf dem API-Projekt.
- **Rückweg:** `API_URL` zurück auf `api-dev` stellt den alten Zustand in unter 5 Minuten her.

## Ohne Kreditkarte

Vorschläge für einen zweiten Host, solange keine Karte hinterlegt werden kann. Alle nutzen dasselbe Image und denselben Code (R1 bis R4):

| Weg | Kosten, Karte | Läuft dauerhaft? | Passt, weil | Aufwand |
| --- | --- | --- | --- | --- |
| **A: Node-Host beim Owner und Cloudflare Tunnel** (gebaut, [Anleitung](../operations/self-hosting.md#erreichbar-über-cloudflare-tunnel)) | 0 €, keine Karte; Tunnel und Zero Trust Free sind enthalten | solange der Rechner läuft | Cloudflare bleibt vorn. Der Host ist unter einer festen Adresse erreichbar (z. B. `agents-local.uguroezdamar.com`), ohne offenen Port. Die Daten liegen in Neon Free oder lokalem Postgres. | Ein Compose-Dienst `tunnel` (cloudflared) mit Token aus Infisical, ein DNS-Eintrag mit Freigabe |
| **B: Render Free** | 0 €, keine Karte | nein, schläft nach 15 Minuten, etwa 60 Sekunden Aufwachen | Ein Lauf überlebt das Schlafen: Beim Aufwachen übernimmt der Durchgang offene Aufträge (R3). Gut für Tests, nicht für lange Läufe ohne Zuschauer. | Dienst aus dem GHCR-Image, Secrets im Render-Dashboard |
| **C: Workers Paid** | 5 USD im Monat, Karte nötig | ja | Keine Tagesgrenze für Durable Objects | nur buchen |

Empfehlung: **A** als Rückfall, sobald Cloudflare-Kontingent knapp wird, und **C**, sobald die Karte funktioniert. B nur, wenn ein öffentlich erreichbarer Testhost ohne laufenden Rechner gebraucht wird.

## Quellen

- [Render, HostAdvice: freie Docker-Hosts ohne Karte](https://hostadvice.com/docker-hosting/free-docker-hosting-no-credit-card/)
- [SnapDeploy: 14 Plattformen verglichen](https://snapdeploy.dev/blog/free-cloud-deployment-platforms-2026-comparison)
- [Cloudflare Tunnel: TryCloudflare und Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)
- [Cloudflare Tunnel 2026 (Erfahrungsbericht)](https://dev.to/recca0120/cloudflare-tunnel-in-2026-expose-localhost-without-opening-ports-or-buying-an-ip-32l5)

- [Northflank Free Tier 2026 (agentdeals.dev)](https://agentdeals.dev/vendor/northflank)
- [Northflank Sandbox, Katalog-Eintrag (GitHub)](https://github.com/ePlus-DEV/free-tier-hub/issues/996)
- [Free Docker Hosting 2026 (xCloud)](https://xcloud.host/best-free-docker-hosting/)
- [Neon: Free plan limits and quotas](https://neon.com/faqs/free-plan-limits-and-quotas)
- [Neon: Plans](https://neon.com/docs/introduction/plans)
- [Northflank: GitHub Actions](https://northflank.com/docs/v1/application/infrastructure-as-code/use-github-actions-with-northflank)
- [Northflank: API](https://northflank.com/docs/v1/api/use-the-api?tab=api)
