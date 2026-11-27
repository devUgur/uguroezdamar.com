# Plan: Von zwei Agenten zur KI-Entwicklungsfirma

- Stand: 27.11.2026 (Plattform-Fahrplan ergänzt, ADR 0040)
- Gilt für: `apps/api`, `apps/office`, `apps/portal`
- Ergänzt: [Office-Brain-Roadmap](../architecture/office-brain/roadmap.md), ADR 0024–0040
- **Technischer Fahrplan:** [Plattform-Migration](../architecture/platform-migration.md) mit den Phasen P1–P6: Nähte, Policy-Engine, Ablauf und Team, Docker, Anbieter und Skills, Open Source. Die Stufen unten sind die Produktsicht darauf: Stufe 4 = P3, Stufe 6 = `ExecutionPort`.

## 1. Ziel

Ein Owner (später jeder Mandant) verbindet seine GitHub-Repositories und betreibt darauf eine KI-Entwicklungsfirma:

- Mehrere Rollen planen, bauen, prüfen und liefern nach festen Regeln.
- Jeder Schritt ist protokolliert, kostet nachvollziehbar Geld und ist im Büro sichtbar.
- Das Wissen der Firma wächst, ohne dass jeder Lauf den ganzen Verlauf neu liest.

## 2. Ist-Stand (geprüft im Code)

| Bereich | Heute | Lücke |
| --- | --- | --- |
| Agenten | Zwei ausführbare: Chef, QA-Reviewer. Katalog kennt weitere Rollen (Product Analyst, Tech Lead, DevOps/Release …), nicht ausführbar. | Keine Entwickler-, Planer-, Release-Agenten; keine Delegation |
| Orchestrierung | Owner startet Chef und QA von Hand; Übergaben als `agent_handoff`-Events (Codex, uncommittet) | Kein Ablauf Intake → Plan → Bau → Prüfung → Release, keine Agent-zu-Agent-Nachrichten |
| Modelle | 13 Anbieter, Schlüssel je Mandant, Datenrichtlinie je Projekt (ADR 0033) | Modell und Denkaufwand nur je Rolle bzw. je Chat, nicht je Mitarbeiter |
| Kontext | Jeder Schritt schickt Systemprompt plus die letzten **60 Nachrichten** (`HISTORY_LIMIT`), Werkzeugergebnisse bis 20.000 Zeichen | Teuer, unscharf; kein Arbeitsgedächtnis, keine Zusammenfassung, keine Wissenssuche |
| Protokoll und Kosten | Events mit Tokens und Kosten; `/costs` (Codex, uncommittet) summiert `model_result`-Events | Kein Laufprotokoll als Tabelle, keine Latenz, kein Cache-Anteil, keine Kosten je Projekt, kein Trace je Lauf |
| Arbeit | Aufgaben, Sprints, Projektseite, Issue-Verknüpfung (Codex), Portfolio-Produkte (Codex) | Keine Abhängigkeiten, keine PR-/CI-Referenzen, Büro zeigt keine Projektarbeit |
| Büro | 2D/3D, Figuren laufen nach Aktivität zum Platz | Keine Räume, keine Besprechungen, keine Projektwand, keine sichtbare Zusammenarbeit |
| Ausführung | Nur GitHub-API; Sandbox und Previews liegen ungemergt auf `claude/modest-stonebraker-2e8223` | Agenten können nicht bauen oder testen |

## 3. Leitentscheidungen

### 3.1 Mastra: Konzepte übernehmen, Laufzeit behalten

Mastra (geprüft am 26.11.2026, Doku unter mastra.ai) bietet genau die Bausteine, die fehlen:

- **Speicher in Schichten:** Nachrichtenverlauf (`lastMessages`), Arbeitsgedächtnis je Nutzer oder Thread, semantische Suche über einen Vektorspeicher.
- **Verdichtung des Verlaufs:** „Observational Memory“ – Hintergrund-Agenten fassen alte Nachrichten zu Beobachtungen zusammen.
- **Workflows:** mit `suspend`/`resume` für menschliche Freigaben.
- **Supervisor und Unteragenten:** ein Agent delegiert an andere.
- **Tracing:** Spans für Agentenlauf, Modellaufruf, Werkzeug.
- **Cloudflare-Anbindung:** D1-Speicher (`@mastra/cloudflare-d1`) und Vectorize.

Empfehlung: **die Konzepte übernehmen, die eigene Laufzeit behalten.** Gründe:

- **Durable Objects:** Unsere Laufzeit läuft in Durable Objects mit Etappen-Budget (Workers Free). Ob Mastra Durable Objects unterstützt, war in der Doku nicht belegbar.
- **Freigaben, Mandanten, Datenschutz:** Freigaben, Mandantentrennung (SQL-Wächter) und Datenschutz-Routing sind gebaut und getestet. Mastra hat dafür kein Gegenstück, das wir nicht nachbauen müssten.
- **Kein Tracing mit D1:** Laut Mastra-Doku unterstützt der D1-Speicher kein Tracing; wir bräuchten ohnehin eine zweite Ablage.

Ein zeitlich begrenzter Test von `@mastra/memory` mit D1 und Vectorize in Stufe 3 entscheidet, ob wir den Speicherteil als Bibliothek übernehmen statt ihn selbst zu bauen. Fällt der Test positiv aus, ersetzt Mastra nur diesen Teil.

### 3.2 Ein Protokoll, aus dem alles liest

Kosten, Büro, Agentenansicht, Projektcockpit und Abnahme lesen dieselben Tabellen. Events bleiben der Live-Strom. Ausgewertet wird nur das Protokoll; JSON-Felder in Events werden dafür nicht mehr summiert.

### 3.3 Mitarbeiter statt Rollen-Aliase

Eine **Agentendefinition** (versioniert, im Code) legt fest, was eine Rolle darf: Prompt, Werkzeuge, Grenzen. Ein **Mitarbeiter** (Instanz, in D1) ist eine konkrete Person im Büro mit Name, Platz, Modell, Denkaufwand und Budget. Davon kann es mehrere je Rolle geben, z. B. zwei Entwickler. Werkzeugrechte bleiben Code (ADR 0030); Modell, Denkaufwand und Budget stellt der Owner im Portal ein.

## 4. Datenmodell (Ziel)

Neue Tabellen, alle mit `tenant_id` und vom Tenancy-Wächter geprüft:

| Tabelle | Inhalt | Ersetzt / ergänzt |
| --- | --- | --- |
| `runs` | Ein Lauf eines Mitarbeiters. Felder: Art (chat, task, review, delegation), Projekt, Aufgabe, Thread, Eltern-Lauf, Status, Start, Ende, Schritte, Kosten | Laufzustand, der heute nur im Durable Object liegt |
| `model_calls` | Je Modellaufruf: Lauf, Schritt, Anbieter, Modell, Tokens (Eingabe, Ausgabe, Cache lesen/schreiben, Denken), Preis-Version, Kosten, Latenz, Zeit bis zum ersten Token, Ergebnis, Fehler, Datenrichtlinie, Herkunft des Schlüssels | Kosten in `events.data` |
| `tool_calls` | Je Werkzeugaufruf: Lauf, Schritt, Werkzeug, Argument-Vorschau (ohne Secrets), Dauer, Erfolg, Freigabe | `tool_call`/`tool_result`-Events als Auswertungsquelle |
| `agent_instances` (Ausbau von `agents`) | Modell je Mitarbeiter, Denkaufwand, maximale Schritte, Tagesbudget, Status, Avatar | Budget nur per SQL änderbar |
| `agent_messages` | Nachrichten zwischen Mitarbeitern: Absender, Empfänger, Lauf, Aufgabe, Art (delegate, question, answer, report), Zusammenfassung | `agent_handoff`-Events |
| `meetings` | Besprechung: Teilnehmer, Anlass (Aufgabe), Thema, Beginn, Ende, Ergebnis | neu, fürs Büro |
| `task_links` | Aufgabe ↔ Issue, PR, Commit, CI-Lauf, Preview-URL | Issue-Spalten an `tasks` (Codex) werden hierhin verallgemeinert |
| `task_dependencies` | Aufgabe blockiert Aufgabe | neu |
| `working_memory` | Je Mitarbeiter und Projekt ein strukturiertes Dokument (Ziele, Entscheidungen, offene Punkte), vom Agenten selbst gepflegt | `memories` (lose Notizen) |
| `thread_summaries` | Verdichtete Zusammenfassung älterer Nachrichten je Thread | 60-Nachrichten-Fenster |
| Vectorize-Index `knowledge` | Abschnitte aus README, ADRs, AGENTS.md, erledigten Aufgaben und Reviews je Projekt; Metadaten Mandant, Projekt, Quelle, Commit | neu |

Hierarchie: Mandant → Produkt (`portfolio_projects`) → Repository-Projekt (`projects`) → Sprint → Aufgabe → Lauf → Modell- und Werkzeugaufrufe.

## 5. Stufen

Jede Stufe ist einzeln auslieferbar, hat Tests gegen echtes SQLite und wird auf Dev abgenommen. Reihenfolge nach Abhängigkeit: Ohne Protokoll lässt sich nichts darüber messen.

### Stufe 1: Protokoll und Kosten

> **Umgesetzt am 26.11.2026:** Migration `0017_usage_ledger.sql`, `apps/api/src/usage/`, Portal `/usage` (Verbrauch) mit Filtern, Summen, Tagesbudgets, Tagesverlauf, Aufteilung nach Mitarbeiter, Modell, Projekt und Anbieter, Läufen, letzten Aufrufen und CSV. Dazu `/usage/runs/[id]` mit dem Trace eines Laufs. Das Tagesbudget zählt jetzt aus `model_calls`. Noch offen: Cache-Rabatte im Preis, Budgets je Projekt und Mandant, Umzug von Codex' `/costs` auf das Protokoll.

- **Tabellen:** `runs`, `model_calls`, `tool_calls`. Die Laufzeit schreibt in jedem Schritt mit.
- **Preise:** im Katalog versioniert. Die Kosten eines Aufrufs speichern die Preis-Version.
- **`/costs` als Tabelle:**
  - Filter nach Zeitraum, Projekt, Produkt, Mitarbeiter, Rolle, Anbieter, Modell und Lauf.
  - Summen, Tagesverlauf, Cache-Quote, teuerste Läufe, CSV-Export.
  - Die Seite baut auf der Codex-Version auf und wechselt deren Quelle auf `model_calls`.
- **Lauf-Ansicht `/runs/[id]`:** Zeitstrahl aller Schritte mit Prompt-Größe, Antwort, Werkzeugen, Tokens, Latenz und Kosten (Trace).
- **Budgets:** je Mitarbeiter, Projekt und Mandant, mit Warnung bei 80 Prozent.
- **Abnahme:** Ein Lauf auf Dev erscheint vollständig in `/costs` und `/runs/[id]`. Die Summe stimmt mit den Einzelaufrufen überein, und die Tagessumme liegt nicht mehr in Event-JSON.

### Stufe 2: Mitarbeiter konfigurieren, Kontext verschlanken

> **Umgesetzt am 26.11.2026:**
> - Einstellungen je Mitarbeiter und Mandant (`agent_settings`, Migration `0018`, `GET/PUT /api/agents/:id/settings`) für Modell, Denkaufwand, Schritte und Tagesbudget; bearbeitbar im Agentenblatt des Büros, nur für den Owner.
> - Reihenfolge der Modelle: Wahl im Chat → Modell des Mitarbeiters → Standard der Rolle → eingebaute Kette.
> - Der Context Builder (`apps/api/src/runtime/context.ts`) schickt den laufenden Lauf vollständig, damit der Prompt-Cache greift. Davor gehen nur eine fortgeschriebene Zusammenfassung (günstiges Modell, im Protokoll als `context-summary`) und die letzten zehn Nachrichten mit gekürzten Werkzeugergebnissen mit.
> - **Messung auf Dev (26.11.2026), kurzer Thread mit einem Vorlauf (elf Nachrichten, sechs Dateilesungen):**
>   - Erster Schritt der Folgefrage: 4.723 Eingabe-Tokens statt geschätzt rund 6.300 mit dem alten Fenster, also etwa 25 Prozent weniger insgesamt und etwa 40 Prozent weniger beim Verlauf. Die Antwort war ohne erneutes Lesen richtig.
>   - Das 50-Prozent-Ziel ist damit für kurze Threads nicht erreicht. Der feste Teil (Systemprompt und Werkzeugbeschreibungen, rund 2.300 Tokens) überwiegt dort. Lange Threads mit großen Werkzeugergebnissen sparen deutlich mehr (Test `tests/api-context.test.ts`).
>   - **Prompt gestrafft (26.11.2026):** fester Teil des Chefs 8.536 → 6.015 Zeichen, des QA-Reviewers → 3.985, Obergrenzen und Pflichtregeln durch `tests/api-prompt-budget.test.ts` abgesichert. Nächste Folgefrage im selben Thread: 3.929 Eingabe-Tokens (vorher 4.723, obwohl der Thread zwei Nachrichten länger war). Gegenüber dem alten 60-Nachrichten-Fenster sind das rund 40 Prozent weniger.
>   - Werkzeuge je Situation auszuwählen ist bewusst verworfen: Eine wechselnde Werkzeugliste steht vorn im Prompt und würde den Prompt-Cache bei jedem Wechsel ungültig machen.

- **Agentenblatt im Büro bearbeitbar:**
  - Modell (aus den Anbietern mit Schlüssel und passend zur Datenrichtlinie) und Denkaufwand (niedrig bis hoch, wo der Anbieter es kann).
  - Maximale Schritte, Tagesbudget, aktiv oder pausiert.
  - Versioniert und protokolliert wie die Organisationsverwaltung.
- **Context Builder** ersetzt das 60-Nachrichten-Fenster. Ein Schritt bekommt:
  1. den stabilen Systemprompt mit Regeln (gecacht);
  2. das Arbeitsgedächtnis;
  3. die Thread-Zusammenfassung;
  4. die letzten 8–12 Nachrichten;
  5. den Kontext der Aufgabe (Abnahmekriterien, Abhängigkeiten).

  Ältere Werkzeugergebnisse werden durch ihre Kurzfassung ersetzt.
- **Abnahme:** Gleiche Aufgaben auf Dev vorher und nachher. Gemessen in `model_calls`: Eingabe-Tokens je Schritt sinken um mindestens 50 Prozent bei gleicher Qualität (QA-Ergebnis).

### Stufe 3: Gedächtnis und Wissen

> **Umgesetzt am 26.11.2026** ([ADR 0037](../architecture/decisions/0037-agent-memory-and-knowledge.md)):
> - Arbeitsgedächtnis je Mitarbeiter und Projekt (`memory_update`, steht vorn im Kontext).
> - Wissensindex je Projekt aus Doku und erledigten Aufgaben, mit hybrider Suche (Volltext plus Vektoren, funktioniert auch ohne Vektoren), Indexer als Durable Object und Werkzeug `knowledge_search`.
> - Projektseite mit „Wissen & Gedächtnis“.
> - Mastra-Speicher wird nicht übernommen (Begründung in der ADR).

- **Arbeitsgedächtnis:** Werkzeug `memory_update` mit festem Schema je Mitarbeiter und Projekt.
- **Thread-Verdichtung:** Sobald der Verlauf ein Token-Limit überschreitet, fasst ein günstiges Modell ihn zusammen (nach dem Muster von Mastras Observational Memory).
- **Wissensindex in Vectorize** je Projekt:
  - Neu indexiert nach jedem Push auf den Standardbranch (Webhook) und nach jeder erledigten Aufgabe.
  - Werkzeug `knowledge_search` mit Quellenangabe.
  - Die Embeddings rechnet Workers AI. Inhalte strenger Projekte verlassen Cloudflare dabei nicht.
- **Test (höchstens zwei Tage):** `@mastra/memory` mit `D1Store` und Vectorize statt Eigenbau. Entscheidung in einer ADR.
- **Abnahme:** Ein neuer Chat beantwortet Fragen zu früheren Entscheidungen des Projekts aus dem Gedächtnis, mit Quelle und ohne die alten Threads zu laden.

### Stufe 4: Team und Orchestrierung mit Cloudflare Workflows

**Grundentscheidung (26.11.2026):**

- **Den Ablauf einer Aufgabe steuert ein Cloudflare Workflow.** Die Agenten-Durable-Objects bleiben die „Mitarbeiter“: Sie halten Gespräch, Kontext und Gedächtnis und führen jeweils einen Lauf aus. Der Workflow ist der dauerhafte Arbeitsauftrag, der sie nacheinander einsetzt.
- **Gründe für Workflows:**
  - Schritte mit Wiederholung und gespeichertem Zustand (`step.do`).
  - Warten auf Ereignisse bis zu einem Jahr (`step.waitForEvent`) für Freigaben des Owners.
  - Pausieren, Fortsetzen und Abbrechen von außen.
  - Auf Free und Paid verfügbar (Free: 3.000 Schritte am Tag, 10 ms CPU je Schritt, 100 gleichzeitige Instanzen).
- **Mastra-Workflows sind damit nicht nötig.** Die Funktionen sind dieselben, laufen bei Cloudflare aber ohne zusätzliche Bibliothek und ohne eigene Speicherschicht.

**Ablauf `DeliveryWorkflow`** (eine Instanz je Aufgabe, ID = Task-ID):

1. **Intake:** Product Owner schärft die Aufgabe, schreibt Abnahmekriterien.
2. **Plan:** Tech Lead zerlegt, nennt Dateien und Risiken. Bei großen Aufgaben folgt `waitForEvent("plan-approved")` (Owner).
3. **Umsetzung:** Entwickler arbeitet auf `agent/<task>` in der Workstation (Stufe 6), committet nach Freigabe.
4. **Tests:** `pnpm check` in der Workstation. Scheitert es, geht die Aufgabe mit Befund zurück an 3, höchstens zweimal.
5. **Pull Request** mit Beschreibung, `task_links` erhält PR und Preview.
6. **QA:** QA-Reviewer prüft unabhängig (wie heute, read-only).
7. **Doku:** Tech Writer zieht README, ADRs und Plan nach.
8. **Abnahme:** `waitForEvent("owner-approval")`. Erst danach bereitet der Release Manager den PR `dev → main` vor; Mergen bleibt beim Owner.

Jeder Schritt ist ein `step.do` mit eigenem Lauf in `runs` (`parent_run_id` = Workflow-Lauf) und Nachrichten in `agent_messages`. Die Freigaben aus dem Chat und dem Portal senden das passende Ereignis an die Workflow-Instanz.

**Stand 27.11.2026:** Die erste Welle arbeitet schon, noch ohne Workflow.
- Product Owner, Tech Lead, Entwickler und DevOps sind angelegt (Migration `0023_delivery_team.sql`, Registry).
- Mit `tasks_list` lesen die Agenten die Tafel; mit `task_create` legen Product Owner und Tech Lead Aufgaben mit Abnahmekriterien an, nur in einem Projekt.
- Zuweisen, Starten, QA-Übergabe und Abnahme macht der Owner auf der Tafel im Office (oder im Portal); die API prüft jeden Übergang.
- Release Manager und Tech Writer folgen mit dem `DeliveryWorkflow`.

**Rollen der ersten Welle:**

| Rolle | Aufgabe | Werkzeuge |
| --- | --- | --- |
| Product Owner | Anliegen → Aufgaben mit Abnahmekriterien | Lesen, Wissen, Aufgaben anlegen |
| Tech Lead | Plan und Zerlegung, Architektur-Review | Lesen, Wissen |
| Entwickler (1–n) | Umsetzung auf `agent/…`, Tests in der Workstation | Schreiben nach Freigabe, `sandbox_run` |
| QA-Reviewer | Prüfung gegen Kriterien, Diff, CI | Nur lesen |
| Release Manager | PR nach `main`, Release-Notizen | PR erstellen; mergen nie |
| Tech Writer | Doku und ADRs | Doku-Pfade schreiben |
| DevOps (Stufe 6b) | Umgebungen, Previews, Provisionierung | Cloudflare- und Vercel-Werkzeuge mit Freigabe |

**Abnahme:** Ein kleiner Auftrag in einem Testrepository läuft auf Dev von Intake bis PR mit grünen Tests. Jeder Schritt steht in `runs`, `agent_messages` und unter `/usage`; der Owner gibt nur Plan (optional), Commit, PR und Abnahme frei.

### Stufe 5: Büro 2.0

**Stand 27.11.2026:** Das Office ist eine eigene App (ADR 0039).
- **Fertig:**
  - Bereichswahl (Firma oder Projekt) per Dropdown.
  - Projektwand als Tafel an der Rückwand.
  - Kanban je Projekt und für die Firma nach Projekten gegliedert.
  - Überblick mit Kosten heute, Arbeitsfluss und Freigaben.
  - Aktionen auf der Tafel: anlegen, zuweisen, Priorität, Status, starten, an QA übergeben, abnehmen.
- **Offen:**
  - Besprechungsraum und Besprechungen aus `meetings`.
  - Hervorheben der Mitarbeiter eines Projekts.
  - Sprint-Anzeige auf der Tafel.

- **Räume:**
  - Arbeitsplätze nach Abteilung
  - Besprechungsraum
  - Projektwand mit Sprint, Backlog und laufenden Aufgaben des gewählten Projekts
  - Release-Ecke
- **Besprechungen:** Jeder Übergang im `DeliveryWorkflow` mit Nachricht ist eine Besprechung. Die beteiligten Figuren gehen in den Besprechungsraum; eine Sprechblase zeigt die Zusammenfassung aus `agent_messages`, danach kehren sie an ihre Plätze zurück. Die Daten kommen aus `meetings`, das Büro erfindet nichts.
- **Projektfilter:** Wird ein Projekt gewählt, sind seine Mitarbeiter hervorgehoben, die anderen gedimmt, und die Wand zeigt dessen Sprint. Ein Klick auf eine Aufgabe öffnet den Workflow mit seinen Läufen.
- **Agentenblatt:** aktuelle Aufgabe, letzte Läufe, Kosten heute, Modell und Denkaufwand (bearbeitbar seit Stufe 2).
- **Abnahme:** Zwei Browser sehen dieselbe Besprechung zur selben Zeit; jede Szene lässt sich auf ein Protokoll-Ereignis zurückführen.

### Stufe 6: Ausführung (Workstations) und Previews

- **Stand:** Am 26.11.2026 nach `dev` gemergt ([ADR 0036](../architecture/decisions/0036-isolated-workstations-and-previews.md), Migration `0022_previews.sql`). Der Code ist da, aber noch nicht aktiv, bis Workers Paid und die Container-Bindung stehen.
  - **Workstation:** Ein Durable Object mit Container je Lauf, ohne Internet. Nur `github.com` (nur Lesen des einen Repositories) und `registry.npmjs.org` sind über Gateways im Worker erreichbar.
  - **Kein Token im Container:** Der Worker setzt es erst unterwegs ein.
  - **Feste Befehle:** Nur `install`, `check`, `test`, `lint`, `typecheck`, `build`.
  - **Werkzeuge:** `sandbox_run` und `preview_deploy` (mit Freigabe).
  - **Previews:** Je Projekt gibt es einen Worker `pv-<projekt>` mit einem Preview-Alias je Branch oder PR.
- **Beim Merge erledigt:** ADR auf 0036 umnummeriert, Migration auf 0022, `markPrivate` an die Datenrichtlinie angepasst, Werkzeugbeschreibungen gekürzt, Prompt-Budget bewusst angehoben (Chef 7.700, QA 5.200 Zeichen).
- **Voraussetzungen des Owners:**
  - **Workers Paid (5 $/Monat).** Nötig für Containers, mehr Workflow-Kapazität (10.000 statt 50 Subrequests je Aufruf, 30 s CPU je Schritt) und ein Workers-AI-Kontingent über die 10.000 Neurons am Tag hinaus.
  - **Container-Bindung** in `apps/api/wrangler.jsonc`.
  - **Token `AGENT_CF_PREVIEW_TOKEN`** (nur „Workers Scripts: Edit“).
- **Erkenntnis aus der Recherche:** Version-URLs gibt es nicht für Worker mit Durable Objects. Für solche Projekte gilt `wrangler preview` (Wrangler ≥ 4.135): eigene Durable-Object-Namensräume je Preview, auf Free 100 und auf Paid 500 Previews je Worker. Die Regel aus der Sandbox-ADR wird beim Merge darum ergänzt.
- **Abnahme:** Ein PR aus Stufe 4 hat grüne Checks aus der Workstation und eine erreichbare Preview.

### Stufe 6b: DevOps und Provisionierung je Projekt

Ziel: Was der Owner heute am Desktop mit `wrangler`, `vercel`, `gh`, Infisical und MCP-Servern einrichtet, machen Agenten nach festen Regeln in der Cloud.

**Ein Projekt-Blueprint, gleich für jedes neue Repository.** `repo_create` legt nicht nur das Repository an, sondern danach mit Freigabe des Owners auch:

1. Grundgerüst: `AGENTS.md` mit den Firmenregeln, `README.md`, CI-Workflow (`pnpm check` auf jedem Push und PR), Branches `dev` und `main`, Branchschutz für `main`.
2. **Hosting nach Projektart:**
   - **Cloudflare (Workers mit statischen Assets oder Worker-API):** `wrangler.jsonc`, ein Dev-Worker und ein Produktions-Worker, Previews je Branch über die Workstation. Workers Builds bleibt außen vor; es lässt sich laut Doku nur im Dashboard verbinden.
   - **Vercel (Next.js):** `POST /v11/projects` mit `gitRepository` legt das Projekt an, `POST /v10/projects/{id}/env` setzt die Variablen. Vercel baut Previews je Branch selbst.
3. Eintrag in `project_environments` (neu): Anbieter, Art (`dev`, `preview`, `production`), URL, Status, letzter Deploy. Die Projektseite zeigt alle Umgebungen an einer Stelle.

**Zugänge der Agenten, nur über die API und mit Freigabe:**

| Zugang | Weg | Warum so |
| --- | --- | --- |
| GitHub | GitHub App (ADR 0031), Installations-Token je Konto | Kurzlebig, je Repository begrenzt |
| Cloudflare | Cloudflare-API-MCP (`https://mcp.cloudflare.com/mcp`, Code Mode, rund 2.500 Endpunkte) mit **API-Token des Mandanten** | Das Token gilt nur für das Konto des Mandanten, also keine Verwechslung wie mit ViralSync. Jede ändernde Aktion braucht eine Freigabe. |
| Vercel | REST-API mit Token des Mandanten | Der offizielle Vercel-MCP verlangt eine Browser-Zustimmung je Verbindung und taugt nicht für unbeaufsichtigte Agenten |
| Neon, weitere | API-Token je Mandant | Nach demselben Muster |

Alle Tokens liegen wie die Modellschlüssel verschlüsselt je Mandant in D1. Aus `provider_credentials` wird dafür eine allgemeine Ablage für Integrationen. Sie sind im Portal einzutragen, nie wieder lesbar und an Mandant und Integration gebunden. Infisical bleibt die Quelle der Betriebs-Secrets der Plattform selbst (ADR 0033).

**Was sicher bleibt:** Kein Agent mergt nach `main`, deployt Produktion oder löscht Ressourcen ohne Freigabe. Produktions-Deploys laufen nur über den Merge `dev → main` (für uguroezdamar.com) oder den Promote-Knopf des Owners.

**Abnahme:** Ein neues Testrepository entsteht aus dem Chat mit Blueprint, CI, Dev- und Preview-Umgebung. Die Projektseite zeigt alle Umgebungen, und ein PR des Entwickler-Agenten erzeugt eine erreichbare Preview.

### Stufe 7: Mandanten (ADR 0032, Stufe 3)

Danach folgen Kundenanmeldung mit GitHub, Rollen je Mandant, Grenzen und Budgets je Mandant sowie ein eigener Live-Hub je Mandant.

## 6. Lagebild und offene Punkte (Stand 26.11.2026, abends)

**Fertig und auf Dev abgenommen:**
- Fehleranzeige im Chat.
- 13 Modellanbieter mit Schlüsseln je Mandant (ADR 0033).
- Datenrichtlinie je Projekt.
- Verbrauchsprotokoll `/usage` (Stufe 1).
- Mitarbeiter-Einstellungen und schlanker Kontext (Stufe 2).
- Gedächtnis und Wissensindex (Stufe 3, ADR 0037).
- Sprints je Projekt.
- Gespräche standardmäßig auf Firmenebene, Projekt als innere Schicht; `code_verify` prüft kostenlos über die CI oder in der Workstation (ADR 0038).
- Office als eigene Next.js-App `apps/office` auf Cloudflare Workers, Dev unter `office-dev.uguroezdamar.com`, Anmeldung über das Portal (ADR 0039). Bereich per Dropdown ohne Neuladen, Tafel mit Kanban.
- Team der ersten Welle: Product Owner, Tech Lead, Entwickler und DevOps neben Chef und QA-Reviewer; Werkzeuge `tasks_list` und `task_create`.

**Offen, nach Dringlichkeit:**

| # | Punkt | Wer | Nächster Schritt |
| --- | --- | --- | --- |
| 1 | Codex-Arbeit uncommittet | erledigt | Übernommen mit Korrekturen: Migrationen als 0020/0021, Tenancy-Wächter grün, Issue-Webhook nur für die Mandanten der sendenden Installation |
| 2 | `/costs` und `/usage` doppelt | erledigt | `/costs` leitet auf `/usage` weiter, Auswertung aus Events entfernt |
| 3 | Sandbox-Branch ungemergt, ADR-Nummer doppelt | erledigt | Gemergt als ADR 0036, Migration 0022; aktiv erst mit Workers Paid |
| 4 | Workers Paid nicht gebucht | Owner | Entscheidung, siehe Abschnitt 7 |
| 5 | Workers-AI-Kontingent (10.000 Neurons am Tag) ist täglich schnell leer: Vektoren des Wissensindex fehlen, Workers AI als Modell fällt aus | Owner | Workers Paid oder Embeddings über einen anderen Anbieter |
| 6 | Kein Anbieter ohne Datenauswertung mit Schlüssel (Claude oder OpenAI); strenge Projekte haben nur Workers AI | Owner | Claude-Schlüssel mit Guthaben unter `/models` |
| 7 | Kosten rechnen Cache-Treffer zum vollen Preis | Agent | Cache-Preise je Anbieter im Katalog |
| 8 | Budgets nur je Mitarbeiter, nicht je Projekt und Mandant | Agent | Mit Stufe 4 |
| 9 | Produktion: `api.uguroezdamar.com` löst nicht auf; Stufen 1–3 sind nur auf Dev | Owner | Release-PR `dev → main` nach Abnahme, DNS und Custom Domain prüfen |
| 10 | GitHub-Verbinden-Fluss (ADR 0032, Stufe 2) nur mit dem eigenen Konto getestet | Owner | Zweites GitHub-Konto als Testmandant |
| 11 | Wrangler war lokal mit dem ViralSync-Konto angemeldet; zwei Indizes landeten im falschen Konto (gelöscht) | erledigt | `pnpm ugur cf login` bindet jetzt ein eigenes Profil an diesen Checkout, `pnpm ugur cf whoami` prüft das Konto |
| 12 | Leere Prüf-Worktree-Ordner `C:\v1`–`C:\v6` | Owner | Löschen (für Agenten gesperrt) |
| 13 | Office in Produktion (`office.uguroezdamar.com`) entsteht erst mit dem Release-PR `dev → main` | Owner | Release nach Abnahme auf `office-dev` (ADR 0039) |
| 14 | GitHub App ohne „Actions: Read“: `code_verify` sieht nur Annotationen statt Job-Logs | Owner | Recht in der GitHub App ergänzen und Installation bestätigen |
| 15 | Plattform: P1 erledigt (Cloudflare nur noch in `apps/api/src/cloudflare/`, Wächter, Kern läuft im Test ohne Cloudflare). Offen: Policy-Engine, Selbsthosting, Lizenz | Agent, Owner | Phase P2 (Policy-Engine) aus der [Plattform-Migration](../architecture/platform-migration.md); Owner entscheidet O1–O5 |

## 7. Entscheidungen des Owners

**Neu mit ADR 0040** (Empfehlung jeweils zuerst):
- **O1 Lizenz:** Apache-2.0; AGPL-3.0, wenn gehostete Kopien offengelegt werden sollen; sonst MIT.
- **O2 Datenbank der selbst gehosteten API, Version 1:** SQLite-Datei, PostgreSQL ab Version 2.
- **O3 Workers Paid:** buchen, sobald der `DeliveryWorkflow` (P3) steht.
- **O4 Standard-Autonomie eigener Projekte:** `balanced`.
- **O5 Eigenes Repository und Name der Plattform:** nach P4.

**Aus Stufe 1–4:**

1. **Workers Paid (5 $/Monat):** jetzt buchen. Damit werden Workstations, Workflow-Kapazität und Workers AI über das Gratis-Kontingent hinaus möglich. Ohne ihn bleiben Stufe 6 und die Vektorsuche blockiert.
2. **Reihenfolge:** Erst Punkt 1–3 aus dem Lagebild (Codex-Arbeit und Sandbox zusammenführen), dann Stufe 4. Oder Stufe 4 sofort, ohne Ausführung in der Workstation.
3. **Rollen der ersten Welle:** wie in Stufe 4 oder anders gewichtet.
4. **Hosting-Standard für neue Projekte:** Cloudflare (Workers mit statischen Assets) als Standard und Vercel nur für Next.js, oder umgekehrt.
5. **Budget je Tag:** für Dev-Tests, z. B. 5 $ je Mitarbeiter und 20 $ je Mandant.

## 8. Was nicht passiert

- Keine Agenten-Schleife ohne Grenzen: Schritte, Tiefe, Parallelität und Budget sind fest begrenzt.
- Kein Agent mergt nach `main` oder deployt Produktion.
- Keine Szene im Büro ohne zugrunde liegendes Protokoll-Ereignis.
- Keine Kosten ohne Preis-Version; unbekannte Preise zählen hoch (ADR 0033).

## Anhang: Vom Desktop in die Cloud

| Heute am Desktop | Morgen bei den Agenten |
| --- | --- |
| Claude Code / Codex im Checkout | Entwickler-Agent mit Workstation (Container) und `DeliveryWorkflow` |
| `wrangler` mit Owner-Anmeldung | Cloudflare-API-MCP mit Token des Mandanten, Freigabe je Änderung; Deploys über die CI des Repositories |
| `vercel` CLI | Vercel-REST-API mit Token des Mandanten |
| `gh` CLI | GitHub App (Installations-Token) |
| Infisical CLI | Betriebs-Secrets der Plattform bleiben in Infisical; Zugänge der Mandanten verschlüsselt in D1 |
| Neon-MCP | Neon-API mit Token des Mandanten |
| Lokale Tests (`pnpm check`) | `sandbox_run` in der Workstation, Ergebnis im Lauf-Trace |
| Eigene Notizen, Pläne | Wissensindex und Arbeitsgedächtnis je Projekt |
