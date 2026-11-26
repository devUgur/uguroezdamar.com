# ADR 0036: Isolierte Workstations auf Cloudflare Containers und Previews je Repository

- Status: accepted (Code und Regeln); Aktivierung der Container im Cloudflare-Konto ist eine eigene Owner-Entscheidung
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0024](0024-agent-platform-on-cloudflare.md), [ADR 0029](0029-projects-as-repository-access.md), [ADR 0031](0031-github-app-access.md), [ADR 0032](0032-multi-tenant-github-connect.md)
- Setzt um: Phase 4 der [Office-Brain-Roadmap](../office-brain/roadmap.md)

## Kontext

Chef und QA-Reviewer lesen und schreiben bisher nur über die GitHub-API. Sie können weder bauen noch testen; der Reviewer darf nach ADR 0028 nicht einmal behaupten, Tests ausgeführt zu haben. Für das Ziel – eine regelbasierte Entwicklungsfirma, die beliebige Repositories betreut – braucht jeder Lauf eine eigene, kurzlebige Arbeitsumgebung: Repository klonen, Branch auschecken, `pnpm install` und `pnpm check` ausführen, Ergebnis zurückmelden. Dazu kommt eine Vorschau-URL je Branch oder Pull Request, damit der Owner eine Änderung ansehen kann, bevor sie gemergt wird.

Randbedingungen:

- Die API läuft als Cloudflare Worker, heute im Free Plan (ADR 0024). Ein Worker selbst hat keine Shell und kein Dateisystem. Cloudflare Containers gibt es nur im Workers-Paid-Plan (5 $ im Monat); der Wechsel ist nach ADR 0024 eine Entscheidung des Owners und Voraussetzung dieser ADR.
- GitHub-Zugriff läuft über das Installations-Token der GitHub App (`apps/api/src/github/app.ts`, ADR 0031): eine Stunde gültig, je Konto, im KV gecacht.
- Code aus fremden Repositories, ihre Abhängigkeiten und deren `postinstall`-Skripte sind nicht vertrauenswürdig.
- Mandantenfähigkeit nach ADR 0032: Kein Lauf darf Daten oder Zugang eines anderen Mandanten sehen.

## Optionen

| Option | Isolation | Kaltstart | Kosten | Zugang zum Repository | Bewertung |
| --- | --- | --- | --- | --- | --- |
| **Cloudflare Containers über ein eigenes Durable Object** (`ctx.container`, Modell des Sandbox SDK 1.0) | eigene VM je Instanz, eine Instanz je Lauf | 1–3 s laut Cloudflare, plus Klonen und Installieren | nutzungsbasiert, Kontingent im Paid-Plan (siehe unten) | Token bleibt im Worker; ausgehende Anfragen an `github.com` laufen durch ein `WorkerEntrypoint`, das es einsetzt | **gewählt** |
| `@cloudflare/sandbox` 0.12 (stabiles Paket) | gleich | gleich | gleich | `gitCheckout()` erwartet das Token in der URL; es landet in `.git/config` und ist für jeden Prozess lesbar | abgelehnt: Token im Container, Paketlinie wird 2026 abgelöst |
| `@cloudflare/sandbox@next` (1.0-Vorschau) als Abhängigkeit | gleich | gleich | gleich | wie gewählt | nicht nötig: Wir brauchen nur `start`, `exec`, `interceptOutboundHttps` und `destroy`, die die Laufzeit selbst bietet. Keine neue Bibliothek ohne belegten Nutzen. |
| GitHub-Actions-Runner je Lauf (`workflow_dispatch`) | gut (frische VM) | 10–60 s Warteschlange | Actions-Minuten des Repository-Besitzers | braucht `actions:write` und eine Workflow-Datei in **jedem** betreuten Repository | abgelehnt: greift in fremde Repositories ein, Ergebnis nur über Logs, nicht gleich für jedes Projekt |
| Dynamic Workers / Worker Loader | V8-Isolate | Millisekunden | sehr gering | gut über Bindings | abgelehnt: keine Shell, kein `pnpm`, kein Node-Ökosystem |
| Externe Sandbox-Anbieter (Modal, E2B, Vercel Sandbox) | gut | Sekunden | eigener Vertrag | Token müsste das Cloudflare-Konto verlassen | abgelehnt: weiterer Anbieter, Code privater Repositories verlässt die eigene Infrastruktur |

## Entscheidung

### 1. Eine Workstation ist ein Durable Object mit einem Container, je Lauf eines

- Klasse `Workstation` in `apps/api/src/workstation/workstation.ts`. Jeder Lauf bekommt einen neuen Namen (`ws:<tenant>:<uuid>`). Zwei Läufe teilen nie Dateisystem, Prozesse oder Netz; das ist die Isolation je Lauf, die die Roadmap als Gate verlangt.
- Der Container startet mit `enableInternet: false`. Erreichbar sind nur Hosts, die das Durable Object vor dem Start abfängt:
  - `github.com` über `GitGateway`: erlaubt ausschließlich `info/refs?service=git-upload-pack` und `POST …/git-upload-pack` für **das eine** Repository des Laufs. Pushen (`git-receive-pack`) und jedes andere Repository werden mit 403 abgewiesen, auch wenn das Token mehr dürfte.
  - `registry.npmjs.org` über `RegistryGateway`: nur `GET`/`HEAD`, damit `pnpm install` funktioniert.
  - Für Previews zusätzlich `api.cloudflare.com` über `PreviewGateway` (Abschnitt 4).
- Befehle laufen als argv-Liste (`exec(["pnpm", "check"])`), nie als Shell-String. Erlaubt sind nur die Befehle der Allowlist in `apps/api/src/workstation/commands.ts` (`install`, `check`, `test`, `lint`, `typecheck`, `build`). Das Modell kann keinen freien Befehl einschleusen.

### 2. Keine Secrets im Container – auch nicht das kurzlebige Token

Die Aufgabenstellung erlaubte das kurzlebige Installations-Token im Container. Die Laufzeit macht es überflüssig: `interceptOutboundHttps("github.com", …)` leitet jede Git-Anfrage durch den Worker, und erst dort wird `Authorization: Basic x-access-token:<token>` gesetzt. Im Container stehen weder in Umgebungsvariablen noch in `.git/config` Zugangsdaten. Ein bösartiges `postinstall` sieht nur das ohnehin geklonte Repository.

- Das Token holt `GitGateway` bei jeder Anfrage über `githubToken(env, tenantId, owner)` (ADR 0031/0032). Mandant und Repository kommen als `props` aus dem Durable Object, nicht aus der Anfrage des Containers.
- Öffentliche Repositories werden ohne Token geklont.
- Ausgaben werden vor der Rückgabe gekürzt (Ende behalten, weil dort die Fehler stehen) und auf Token-Muster (`ghs_`, `ghp_`, `github_pat_`, `Bearer …`) geprüft und geschwärzt.

### 3. Lebenszyklus und Aufräumen

1. `run()` registriert die Gateways, startet den Container und setzt `setInactivityTimeout` auf die Laufzeitgrenze plus Puffer.
2. Klonen (`git clone --depth 1 --branch <ref>`, Commit-SHA per `fetch` + `checkout`), dann die Schritte der Allowlist, jeder mit eigenem Zeitlimit (`timeout -k 5 <s>`).
3. **Immer** im `finally`: `ctx.container.destroy()`. Zusätzlich setzt `run()` einen Alarm des Durable Objects, der einen hängengebliebenen Container zerstört; die Inaktivitätsgrenze ist die dritte Sicherung. Der Speicher des Durable Objects wird danach gelöscht (`deleteAll`).
4. Jeder Lauf schreibt ein Event `sandbox_run` (Mandant, Agent, Thread, Repository, Ref, Befehl, Exit-Codes, Dauer, Instanztyp). Kosten und Laufzeit sind damit je Lauf zuordenbar.

Grenzen (in `apps/api/src/workstation/commands.ts`): Instanztyp `standard-1` (½ vCPU, 4 GiB, 8 GB Platte), höchstens 10 Minuten je Lauf, 20 Läufe je Mandant und Tag (KV-Zähler), höchstens 16.000 Zeichen Ausgabe je Schritt.

### 4. Previews je Repository: Workers-Versionen mit Preview-Alias

Regel, gleich für jedes Projekt:

- **Preview-fähig** ist ein Projekt, dessen Repository eine Wrangler-Konfiguration im Wurzelverzeichnis hat (`wrangler.jsonc`, `wrangler.json` oder `wrangler.toml`). Andere Projekte (z. B. Next.js auf Vercel) bekommen keine Cloudflare-Preview; das Portal sagt das.
- Je Projekt gibt es **einen** Preview-Worker im Konto der Plattform: `pv-<projekt-id>` (höchstens 54 Zeichen). Er ist von Produktions-Workern des Kunden getrennt.
- Je Branch oder Pull Request lädt die Workstation eine neue Version hoch: `wrangler versions upload --name pv-<projekt-id> --preview-alias <alias>`. Alias = `pr-<nummer>` für Pull Requests, sonst der Branch in Kleinbuchstaben, alles außer `[a-z0-9-]` wird zu `-`, gekürzt, damit `<alias>-pv-<projekt-id>` als DNS-Label höchstens 63 Zeichen hat.
- Die URL folgt daraus deterministisch: `https://<alias>-pv-<projekt-id>.<workers-subdomain>.workers.dev`. Sie wird in der Tabelle `previews` (Mandant, Projekt, Ref, Alias, URL, Version, Status, Zeit) gespeichert und im Portal unter `/projects/[id]` angezeigt.
- Das Cloudflare-Token (`AGENT_CF_PREVIEW_TOKEN`, Recht „Workers Scripts: Edit“ nur für dieses Konto) bleibt im Worker. `PreviewGateway` lässt nur Anfragen an `/accounts/<konto>/workers/scripts/pv-<projekt-id>/…` und die für den Upload nötigen Lesepfade durch und setzt das Token erst dort ein. Andere Worker des Kontos sind aus dem Container nicht erreichbar.
- Das Werkzeug `preview_deploy` hat **Außenwirkung** (eine öffentlich erreichbare URL) und braucht daher die Freigabe des Owners (`requiresApproval`). `sandbox_run` dagegen liest nur und braucht keine Freigabe.

Verworfen: Cloudflare Pages (Branch-Previews nur über die Git-Integration je Projekt, die das Repository mit dem Cloudflare-Konto verbindet und nicht regelbasiert aus der API angelegt wird) und Workers Builds (gleiches Problem, zusätzlich je Projekt im Dashboard einzurichten).

## Kosten im Workers-Paid-Plan

Tarif (Stand 26.11.2026): im Paid-Plan enthalten sind 25 GiB-Stunden Arbeitsspeicher, 375 vCPU-Minuten und 200 GB-Stunden Platte im Monat; darüber 0,0000025 $ je GiB-Sekunde, 0,00002 $ je aktiver vCPU-Sekunde, 0,00000007 $ je GB-Sekunde. Speicher und Platte zählen nach bereitgestellter Größe, CPU nur bei Nutzung. Egress in Nordamerika und Europa: 1 TB im Monat enthalten, danach 0,025 $ je GB.

Beispiel: ein fünfminütiger Lauf auf `standard-1` mit voller CPU-Last.

| Posten | Verbrauch | ohne Kontingent |
| --- | --- | --- |
| Speicher | 4 GiB × 300 s = 0,33 GiB-h | 0,0030 $ |
| CPU | 0,5 vCPU × 300 s = 2,5 vCPU-min | 0,0030 $ |
| Platte | 8 GB × 300 s = 0,67 GB-h | 0,0002 $ |

Das Kontingent reicht für rund **75 solcher Läufe im Monat** (Speicher ist der Engpass). Jeder weitere kostet etwa **0,6 Cent**; 1.000 Läufe im Monat also rund 6 $. Hinzu kommen Durable-Object-Anfragen (vernachlässigbar) und Egress für Abhängigkeiten, die innerhalb des Terabytes bleiben. Das Tageslimit von 20 Läufen je Mandant begrenzt den schlimmsten Fall auf rund 600 Läufe im Monat und Mandant.

## Aktivierung (Owner-Entscheidung, nicht Teil dieses Commits)

Der Code ist vollständig und getestet, im Konto läuft aber noch kein Container. Bis zur Aktivierung antworten `sandbox_run` und `preview_deploy` mit „Workstations sind nicht eingerichtet“. Aktivieren heißt:

1. Das Konto auf Workers Paid umstellen (ADR 0024).
2. In `apps/api/wrangler.jsonc` je Umgebung einen `containers`-Eintrag (`class_name: "Workstation"`, `image: "./workstation/Dockerfile"`, `instance_type: "standard-1"`, `max_instances`), eine Durable-Object-Bindung `WORKSTATION` und die Migration `v3` mit `new_sqlite_classes: ["Workstation"]` ergänzen.
3. Der Deploy-Workflow braucht Docker (auf `ubuntu-latest` vorhanden), weil `wrangler deploy` das Image baut und hochlädt.
4. Für Previews `AGENT_CF_PREVIEW_TOKEN` in Infisical (`prod`) anlegen, nach GitHub Actions kopieren und `CF_WORKERS_SUBDOMAIN` in `wrangler.jsonc` setzen.

Das ist eine Änderung an Deployment und Kosten und wird deshalb getrennt freigegeben.

## Folgen

- Chef und QA-Reviewer dürfen `sandbox_run` nutzen. Der Reviewer kann damit belegen, dass `pnpm check` auf dem Head-Commit eines Pull Requests grün ist; ohne Lauf gilt weiter ADR 0028.
- Workstations schreiben nie nach GitHub. Commits und Pull Requests bleiben bei den bestehenden, freigabepflichtigen Werkzeugen.
- Parallele Coding-Läufe sind technisch möglich, werden aber erst nach dem Gate der Roadmap (Cleanup nach Erfolg, Fehler und Abbruch belegt) für mehrere Agenten gleichzeitig freigegeben.

## Risiken

- **Abhängigkeiten aus der npm-Registry** sind beliebiger Code. Sie laufen isoliert, ohne Zugangsdaten und ohne Internet außer den abgefangenen Hosts. Ein Angriff kann den Lauf verfälschen, aber kein Token stehlen.
- **Kosten bei Fehlern:** Ein hängengebliebener Container kostet bis zum Alarm. Drei Sicherungen (finally, Alarm, Inaktivitätsgrenze) begrenzen das auf Minuten.
- **Preview-Worker sind öffentlich.** Wer die URL kennt, sieht den Branch. Für private Repositories wird die Preview erst nach ausdrücklicher Freigabe angelegt; Schutz per Cloudflare Access ist ein späterer Schritt.
- **Pfadliste des Preview-Gateways:** Welche Cloudflare-API-Pfade `wrangler versions upload` genau aufruft, ist erst beim ersten echten Lauf belegt. Das Gateway lässt bis dahin nur den Script-Pfad des Preview-Workers und die Subdomain-Abfrage durch; fehlt ein Pfad, scheitert der Upload sichtbar mit 403 statt zu viel freizugeben.
- **Container-API in Bewegung:** Die Laufzeit-API (`ctx.container`) ist neu. Sie ist hinter `WorkstationPort` gekapselt; Tests laufen gegen eine Fake-Implementierung.

## Nachtrag (26.11.2026, beim Merge nach `dev`)

- Nummer: Die ADR entstand auf einem Branch als 0035; diese Nummer hatte inzwischen der GitHub-Issue-Sync. Die Migration hieß `0014_previews.sql` und ist jetzt `0022_previews.sql`.
- Recherche: Cloudflare erzeugt **keine Version-URLs für Worker, die Durable Objects enthalten** (auch Container- und Sandbox-Worker). Für solche Projekte ist `wrangler preview` (Wrangler ab 4.135) der Weg. Jede Preview hat dort eigene Durable-Object-Namensräume; auf Free gibt es 100, auf Paid 500 Previews je Worker. Die Preview-Regel oben gilt deshalb vorerst für Projekte ohne Durable Objects. Die Ergänzung folgt mit Plan-Stufe 6b.
- Aktivierung bleibt beim Owner: Workers Paid, Container-Bindung in `apps/api/wrangler.jsonc`, `AGENT_CF_PREVIEW_TOKEN`.
