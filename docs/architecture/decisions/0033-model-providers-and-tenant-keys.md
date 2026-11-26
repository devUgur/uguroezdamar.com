# ADR 0033: Modulare Modellanbieter, Schlüssel je Mandant und Sprints je Projekt

- Status: accepted
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0024](0024-agent-platform-on-cloudflare.md), [ADR 0029](0029-projects-as-repository-access.md), [ADR 0032](0032-multi-tenant-github-connect.md)

## Kontext

Die Agenten hatten nur kostenlose Modelle: Gemini Free Tier (auf Dev ohne Schlüssel) und Workers AI mit 10.000 Neurons am Tag. Private Repositories dürfen nur an Modelle ohne Datenauswertung gehen, also blieben Workers AI und Modal. Sobald das Tageskontingent verbraucht war, antwortete kein Agent mehr. Neue Anbieter brauchten bisher Code, einen GitHub-Secret und einen Deploy. Für das Ziel, dass jeder Mandant (ADR 0032) seine eigene Entwicklungsfirma betreibt, muss er seine eigenen Modelle und Schlüssel einbringen können.

## Entscheidung

### 1. Ein Katalog, drei Adapter

`apps/api/src/models/config.ts` beschreibt jeden Anbieter: Art (`openai-compatible`, `anthropic`, `workers-ai`), Basis-URL, Datenpolitik (`trainsOnData`), kostenpflichtig oder nicht, Link zum Schlüssel, kuratierte Modelle mit Preis. Eingebaut sind Anthropic (Claude), OpenAI, DeepSeek, Moonshot (Kimi), Mistral, Groq, xAI, Together, Fireworks, OpenRouter, Gemini, Modal und Workers AI. Jeder Endpunkt im OpenAI-Format kommt als **eigener Anbieter** (`custom-…`) mit Name, https-Basis-URL und Datenpolitik dazu.

- **Claude** hat einen eigenen Adapter mit dem offiziellen SDK (`@anthropic-ai/sdk`). Gründe: Denkblöcke müssen im nächsten Schritt unverändert zurück (gespeichert als `raw` an der Nachricht), Werkzeuge haben Anthropics eigenes Format, und Prompt-Caching (`cache_control`), Aufwand (`effort: medium`) sowie Ersatzmodelle bei Ablehnungen (`fallbacks: "default"`, nicht bei Haiku) gibt es nur dort.
- Alle anderen laufen über den vorhandenen OpenAI-kompatiblen Adapter.
- **Modelle eines Schlüssels** werden beim Speichern abgefragt (`GET …/models`, bei Claude über das SDK). Das ist zugleich der Test des Schlüssels. Kuratierte Modelle stehen vorn, die übrigen dahinter.

### 2. Schlüssel je Mandant, verschlüsselt, nie wieder lesbar

- Tabelle `provider_credentials` (Mandant, Anbieter). Der Schlüssel liegt nur als AES-GCM-Chiffrat vor. Der Schlüssel dazu wird per HKDF aus dem Worker-Secret `PROVIDER_KEYS_SECRET` und dem Mandanten abgeleitet. Mandant und Anbieter sind als Zusatzdaten gebunden: Eine kopierte Zeile lässt sich für keinen anderen Mandanten und keinen anderen Anbieter entschlüsseln.
- Das Portal sieht nur Anbieter, die letzten vier Zeichen, Testergebnis und Modellliste. Es gibt keine Route, die einen Schlüssel zurückgibt.
- `PROVIDER_KEYS_SECRET` erzeugt `pnpm ugur api secrets --apply` einmal. Es liegt in Infisical (`prod`) und wird nach GitHub Actions kopiert. Es wird nie rotiert, denn ein neuer Wert macht alle gespeicherten Schlüssel unlesbar; sie wären dann neu einzutragen.
- **Keine Synchronisierung mit Infisical.** Infisical bleibt die Quelle der Betriebs-Secrets der Plattform. Schlüssel aus dem Portal gehören dem Mandanten. Sie in den Betriebstresor zu schreiben hieße, Kundengeheimnisse mit Plattformgeheimnissen zu mischen, und der Worker bräuchte eine eigene Infisical-Identität.
- Die Worker-Secrets des Owners (z. B. `GEMINI_API_KEY`) gelten weiter, aber nur für den Owner. Ein anderer Mandant bekommt ohne eigenen Schlüssel keinen Zugang auf die Rechnung des Owners.
- Ändern dürfen nur Aufrufe mit dem Scope `providers:write`. Das Portal setzt ihn nur für den aktiven Owner.

### 3. Wahl je Rolle und je Gespräch

- `tenant_model_defaults`: Der Mandant legt je Rollen-Alias (`chef-smart`, `coder`, `worker-cheap`) ein Modell fest. Es wird vor der eingebauten Kette versucht. Die eingebauten Ketten beginnen mit Claude: Ohne Schlüssel wird es übersprungen und kostet nichts.
- Die Modellwahl im Chat zeigt nur Anbieter mit Schlüssel.
- Die Datenschutzregel bleibt hart: In privaten Repositories antworten nur Anbieter mit `trainsOnData: false` (Claude, OpenAI, Workers AI, Modal, eigene Anbieter mit ausdrücklicher Angabe).
- **Datenrichtlinie je Projekt** (Migration `0016`, `projects.model_policy`, Ergänzung vom 26.11.2026):
  - `strict`: nur Anbieter ohne Datenauswertung.
  - `open`: alle Anbieter mit Schlüssel.
  - Ohne Wahl gilt die Sichtbarkeit des Repositories: privat heißt streng, öffentlich heißt offen.
  - Der Owner setzt sie auf der Projektseite (`PATCH /api/projects/:id`, Scope `providers:write`). Für eigene Repositories ohne Kundendaten ist „offen“ eine bewusste, sichtbare Entscheidung.
  - Ein Thread, der ein anderes privates Repository gelesen hat, merkt sich dessen Namen. Er bleibt streng, solange eines davon kein Projekt oder ein strenges Projekt ist.
  - Hintergrund DeepSeek: Die Datenschutzerklärung nennt das Training der Modelle als Zweck (mit Widerspruchsrecht). Die API-Bedingungen nehmen API-Eingaben nicht ausdrücklich aus, und die Daten liegen in China. Deshalb bleibt DeepSeek als „wertet aus“ eingestuft.
- Die Regel wirkt sichtbar, nicht still:
  - Ein Chat in einem privaten Projekt lässt auswertende Anbieter (DeepSeek, Kimi, Gemini …) nicht wählen; die API lehnt die Wahl mit einer Begründung ab.
  - Wechselt ein Chat mit solchem Modell in ein privates Projekt, fällt er auf die automatische Wahl zurück und meldet das.
  - Der Router nennt jedes ausgelassene Modell im Fehler („gesperrt (privates Repository …)“), und das Portal erklärt es.
- **Budget:** Ein kostenpflichtiges Modell ohne bekannten Preis zählt mit 5 $ / 25 $ je Million Tokens (Eingabe/Ausgabe), damit das Tagesbudget auch bei unbekannten Modellen greift.

### 4. Sprints je Projekt

Ein Projekt ist ein Repository (ADR 0029). Neu ist die Tabelle `sprints` (geplant, läuft, abgeschlossen) und an Aufgaben `sprint_id`. Je Projekt läuft höchstens ein Sprint. Wird er abgeschlossen, gehen offene Aufgaben zurück ins Backlog. Das Portal zeigt unter `/projects/[id]` Sprints, Backlog und Planung des Repositories.

## Warum Modal Kaltstarts hat

Modal vermietet GPUs sekundengenau und fährt sie nach fünf Minuten ohne Anfrage herunter (`scaledown_window`). Danach muss ein Container starten und die Gewichte (8 bis 26 Milliarden Parameter) in den GPU-Speicher laden; das dauert ein bis drei Minuten. Abhilfe gibt es nur gegen Geld: `min_containers=1` hält eine GPU warm, kostet bei der L40S aber rund 1,95 $ pro Stunde, also etwa 1.400 $ im Monat. Speicher-Snapshots verkürzen den Start, beseitigen ihn aber nicht.

Für Chat und Agenten ist eine bezahlte API deshalb günstiger und schneller. Modal bleibt sinnvoll für:

- Batch-Arbeit
- Bild-, Audio- und Video-Erzeugung
- eigene oder feinabgestimmte Modelle
- Inhalte, die die eigene Infrastruktur nicht verlassen dürfen

## Alternativen

- **Alles über OpenRouter:** ein Schlüssel für viele Modelle, aber eine Zwischenstation mehr, Datenpolitik je Modell unterschiedlich und kein Claude-spezifisches Caching oder Denken. Bleibt als Anbieter wählbar.
- **Cloudflare AI Gateway mit gespeicherten Schlüsseln (BYOK):** bindet die Schlüssel an ein Cloudflare-Konto, nicht an den Mandanten. Für mehrere Mandanten ungeeignet; das Gateway bleibt als Durchleitung möglich (`MODEL_VIA_GATEWAY`).
- **Schlüssel in Infisical je Mandant:** siehe oben; Betriebs- und Kundengeheimnisse bleiben getrennt.

## Risiken

- **Verlust von `PROVIDER_KEYS_SECRET`:** Dann müssen alle Schlüssel neu eingetragen werden; Infisical hält die Sicherung.
- **Fehlerhafte Preisangaben:** Die Preise der Anbieter ändern sich. Kuratierte Preise stehen im Katalog, unbekannte zählen hoch.
- **Fehlerhafte Datenpolitik bei eigenen Anbietern:** Sie liegt in der Verantwortung des Owners; voreingestellt ist „wertet aus“.

## Rückprüfung

`tests/api-providers.test.ts`:

- Verschlüsselung und Bindung an Mandant und Anbieter
- Scope- und Ablageprüfung, Speichern mit Test und Modellliste, kein Schlüssel in Antworten oder Klartext in D1
- Modellwahl je Rolle, eigene Anbieter und unsichere URLs
- Owner-Secrets nur für den Owner, Preisregel
- Claude-Format und SDK-Aufruf mit Streaming
- Sprints mit einem aktiven Sprint je Projekt und Rückgabe offener Aufgaben
