# Plan: Von zwei Agenten zur KI-Entwicklungsfirma

- Stand: 26.11.2026
- Gilt für: `apps/api`, `apps/portal`
- Ergänzt: [Office-Brain-Roadmap](../architecture/office-brain/roadmap.md), ADR 0024–0035

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
>   - Nächster Hebel: Werkzeugbeschreibungen und Systemprompt straffen, Werkzeuge je Aufgabe auswählen.

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

- **Arbeitsgedächtnis:** Werkzeug `memory_update` mit festem Schema je Mitarbeiter und Projekt.
- **Thread-Verdichtung:** Sobald der Verlauf ein Token-Limit überschreitet, fasst ein günstiges Modell ihn zusammen (nach dem Muster von Mastras Observational Memory).
- **Wissensindex in Vectorize** je Projekt:
  - Neu indexiert nach jedem Push auf den Standardbranch (Webhook) und nach jeder erledigten Aufgabe.
  - Werkzeug `knowledge_search` mit Quellenangabe.
  - Die Embeddings rechnet Workers AI. Inhalte strenger Projekte verlassen Cloudflare dabei nicht.
- **Test (höchstens zwei Tage):** `@mastra/memory` mit `D1Store` und Vectorize statt Eigenbau. Entscheidung in einer ADR.
- **Abnahme:** Ein neuer Chat beantwortet Fragen zu früheren Entscheidungen des Projekts aus dem Gedächtnis, mit Quelle und ohne die alten Threads zu laden.

### Stufe 4: Team und Orchestrierung

- **Rollen der ersten Welle:**

  | Rolle | Aufgabe | Werkzeuge |
  | --- | --- | --- |
  | Product Owner | Anliegen → Aufgaben mit Abnahmekriterien | Lesen, Aufgaben anlegen |
  | Tech Lead | Plan und Zerlegung, Review der Architektur | Lesen, Wissen |
  | Entwickler (1–n) | Umsetzung auf `agent/…`-Branch, PR | Schreiben nach Freigabe, Sandbox |
  | QA-Reviewer | Prüfung gegen Kriterien, Diff, CI | Nur lesen (wie heute) |
  | Release Manager | PR nach `main` vorbereiten, Release-Notizen | PR erstellen; mergen nie |
  | Tech Writer | Doku und ADRs nachziehen | Doku-Pfade schreiben |

- **Chef wird Supervisor:** Werkzeug `delegate(task, role, auftrag)` startet einen Unterlauf (`runs.parent_run_id`) und wartet auf dessen Bericht (`agent_messages`). Höchstens zwei Ebenen; parallel höchstens so viele Läufe, wie die Sandbox erlaubt.
- **Standardablauf als Workflow:**
  1. Intake (PO)
  2. Plan (Tech Lead)
  3. Umsetzung (Entwickler)
  4. Prüfung (QA)
  5. Doku (Writer)
  6. Release-Vorschlag (Release Manager)
  7. Abnahme durch den Owner

  Jeder Übergang ist persistiert. Wartet ein Schritt auf eine Freigabe, pausiert der Workflow (suspend/resume) und läuft nach der Entscheidung weiter. Projektregeln (AGENTS.md, Schreibmodus, Datenrichtlinie) gelten in jedem Schritt.
- **Abnahme:** Ein kleiner Auftrag in einem Testrepository läuft auf Dev von Intake bis PR. Jeder Schritt erscheint in `runs` und `agent_messages`, und der Owner gibt nur Commit und PR frei.

### Stufe 5: Büro 2.0

- **Räume:**
  - Arbeitsplätze nach Abteilung
  - Besprechungsraum
  - Projektwand mit Sprint, Backlog und laufenden Aufgaben des gewählten Projekts
  - Release-Ecke
- **Besprechungen:** Bei Delegation oder Rückfrage gehen die beteiligten Figuren in den Besprechungsraum. Eine Sprechblase zeigt die Zusammenfassung aus `agent_messages`; danach kehren sie an ihre Plätze zurück. Die Daten kommen aus `meetings`, das Büro erfindet nichts.
- **Projektfilter:** Wird ein Projekt gewählt, sind seine Mitarbeiter hervorgehoben und die anderen gedimmt; die Wand zeigt dessen Sprint. Ein Klick auf eine Aufgabe öffnet den Lauf (`/runs/[id]`).
- **Agentenblatt:** aktuelle Aufgabe, letzte Läufe, Kosten heute, Modell und Denkaufwand (bearbeitbar aus Stufe 2).
- **Abnahme:** Zwei Browser sehen dieselbe Besprechung zur selben Zeit; jede Szene lässt sich auf ein Protokoll-Ereignis zurückführen.

### Stufe 6: Ausführung und Previews

- **Sandbox-Branch:** `claude/modest-stonebraker-2e8223` prüfen, ADR-Nummer auf 0036 ändern (0035 ist schon Codex' Issue-Sync) und nach `dev` mergen.
- **Voraussetzungen:** Workers Paid (5 $/Monat), Container-Bindung, Egress-Regeln, Aufräumen.
- **Entwickler-Agenten bauen und testen in der Sandbox.** Jeder PR bekommt eine Preview-URL in `task_links`; das Projektcockpit und die Projektwand im Büro zeigen sie.
- **Abnahme:** Ein PR aus Stufe 4 hat grüne Checks aus der Sandbox und eine erreichbare Preview.

### Stufe 7: Mandanten (ADR 0032, Stufe 3)

Danach folgen Kundenanmeldung mit GitHub, Rollen je Mandant, Grenzen und Budgets je Mandant sowie ein eigener Live-Hub je Mandant.

## 6. Abstimmung mit der parallelen Arbeit

- **Codex arbeitet im selben Checkout**, uncommittet: Portfolio-Produkte, GitHub-Issue-Sync, `/costs`, `agent_handoff`. Diese Arbeit erst committen, dann Stufe 1 darauf aufsetzen.
- **Tenancy-Wächter:** Er scheitert heute an den neuen Portfolio-Tabellen (`TENANT_TABLES`) und an zwei Abfragen ohne `tenant_id` (`github/issues.ts`, `github/webhook.ts`). Das muss vor dem Commit der Codex-Arbeit behoben sein.
- **Nummern:** Codex hat ADR 0035 vergeben; der Sandbox-Branch nutzt ebenfalls 0035 und wird auf 0036 umbenannt. Migrationen bitte fortlaufend ab 0017.

## 7. Entscheidungen des Owners

1. **Mastra:** Konzepte übernehmen und nur den Speicher als Bibliothek testen (empfohlen) oder die Laufzeit auf Mastra umbauen.
2. **Workers Paid (5 $/Monat):** jetzt buchen. Nötig für Sandbox und Container, Queues für die Indexierung und höhere Grenzen je Aufruf.
3. **Rollen der ersten Welle:** wie in Stufe 4 oder anders gewichtet.
4. **Budget je Tag:** für Dev-Tests, z. B. 5 $ je Mitarbeiter und 20 $ je Mandant.

## 8. Was nicht passiert

- Keine Agenten-Schleife ohne Grenzen: Schritte, Tiefe, Parallelität und Budget sind fest begrenzt.
- Kein Agent mergt nach `main` oder deployt Produktion.
- Keine Szene im Büro ohne zugrunde liegendes Protokoll-Ereignis.
- Keine Kosten ohne Preis-Version; unbekannte Preise zählen hoch (ADR 0033).
