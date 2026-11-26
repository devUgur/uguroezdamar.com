# ADR 0037: Gedächtnis und Wissensindex der Agenten

- Status: accepted
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0024](0024-agent-platform-on-cloudflare.md), [ADR 0033](0033-model-providers-and-tenant-keys.md), [Plan](../../product/agent-company-plan.md) Stufe 3
- Nummer: 0035 ist Codex' GitHub-Issue-Sync, 0036 ist für die Sandbox reserviert (Branch `claude/modest-stonebraker-2e8223`).

## Kontext

Bis Stufe 2 kannten die Agenten ein Projekt nur aus dem aktuellen Gespräch und aus losen Notizen (`memories`). Fragen zu früheren Entscheidungen beantworteten sie, indem sie Dateien erneut lasen, oder sie konnten sie gar nicht beantworten. Wissen aus erledigten Aufgaben ging verloren.

## Entscheidung

Das Gedächtnis hat drei Schichten:

1. **Gesprächsverlauf** (Stufe 2): Der laufende Lauf geht vollständig an das Modell; davor gehen eine fortgeschriebene Zusammenfassung und zehn Nachrichten mit.
2. **Arbeitsgedächtnis** je Mitarbeiter und Projekt (`working_memory`):
   - Ein Dokument mit Zielen, Entscheidungen, offenen Punkten und Konventionen, höchstens 4.000 Zeichen.
   - Der Agent pflegt es selbst mit `memory_update`. Das Werkzeug ersetzt `memory_save`; bestehende Notizen bleiben im Prompt sichtbar.
   - Es steht in jedem Lauf vorn im Kontext.
3. **Wissensindex** je Projekt:
   - **Quellen:** Markdown-Dokumentation (README, AGENTS.md, CLAUDE.md, PLAN, `docs/**`) und erledigte Aufgaben samt Abschlussnotiz.
   - **Zerlegung:** entlang der Überschriften in Abschnitte von höchstens 1.500 Zeichen.
   - **Speicher:** Text und Volltextindex (FTS5, BM25) liegen in D1, Vektoren (`@cf/baai/bge-m3`, 1024 Dimensionen) in Vectorize (`uguroezdamar-knowledge[-dev]`, Metadaten-Index auf `tenant` und `project`).
   - **Suche ist hybrid:** Text und Bedeutung werden per Reciprocal Rank Fusion zusammengeführt. Sie funktioniert auch ohne Vektoren, etwa wenn das kostenlose Workers-AI-Kontingent aufgebraucht ist. Fehlende Vektoren holt der nächste Lauf nach.
   - **Indexer:** Das Durable Object `KnowledgeIndexer` arbeitet je Mandant und Projekt in Alarm-Etappen von 15 Dateien. Unveränderte Dateien (gleicher Blob-SHA) überspringt es, gelöschte entfernt es.
   - **Auslöser:** heute der Knopf „Wissen aktualisieren“ auf der Projektseite (`POST /api/projects/:id/knowledge/reindex`). Ein Push-Webhook kann folgen.
   - **Zugriff:** Agenten suchen mit `knowledge_search`; die Projektseite zeigt Status, eine Testsuche und das Arbeitsgedächtnis jedes Mitarbeiters.

**Datenschutz:** Embeddings rechnet Workers AI bei Cloudflare, das nicht auf Kundendaten trainiert. Auch Inhalte strenger Projekte bleiben dort. Jede Abfrage filtert nach Mandant und Projekt, in D1 über `tenant_id` und in Vectorize über die Metadaten.

## Mastra

Geprüft wurde `@mastra/memory`: Nachrichtenverlauf, Arbeitsgedächtnis, semantische Suche, Observational Memory, D1Store, Vectorize. Diese Prüfung lief anhand der aktuellen Doku vom 26.11.2026. Ein lauffähiger Spike mit dem Paket fand nicht statt.

Entscheidung: **nicht übernehmen.** Gründe:

- **Eigenes Thread-Modell:** Mastra verwaltet eigene Thread-, Nachrichten- und Ressourcentabellen. Unser Verlauf liegt je Thread in einem Durable Object mit eigener SQLite, zusammen mit Freigaben und Etappen. Beides parallel zu führen hieße, den Verlauf doppelt zu halten.
- **Gleiche Muster, schon eingebaut:** Die übernommenen Muster sind vorhanden und unter unseren Regeln getestet: kurzer Verlauf plus Verdichtung, Arbeitsgedächtnis, semantische Suche. Dazu gehören Mandanten-Wächter, Datenrichtlinie und Verbrauchsprotokoll.
- **Vektorzugriff per REST:** Die Mastra-Vectorize-Anbindung nutzt laut Doku die REST-API mit Konto-Token statt der Worker-Bindung, also einen weiteren Schlüssel im Worker.

Neu entscheiden, wenn Mastra-Workflows für die Orchestrierung in Stufe 4 einen klaren Vorteil zeigen; das ist eine getrennte Frage vom Speicher.

## Konsequenzen

- **Migration und Bindungen:** Migration `0019_knowledge.sql`, Durable-Object-Migration `v3`, Vectorize-Bindung `KNOWLEDGE` in beiden Stufen.
- **Deploy:** Der Deploy-Token braucht Zugriff auf Vectorize. Scheitert der Deploy an der Bindung, muss der Owner dem `CLOUDFLARE_API_TOKEN` „Vectorize: Edit“ geben.
- **Kosten:** Embeddings zählen zum Workers-AI-Kontingent. Auf dem Free Plan reicht es für die Doku eines Repositories; fehlt es, bleibt die Volltextsuche.

## Rückprüfung

`tests/api-knowledge.test.ts`:

- Zerlegung und Dateiauswahl
- sichere FTS-Ausdrücke
- Suche ohne Vektoren und Nachholen der Vektoren
- hybride Treffer
- Mandanten- und Projektgrenze
- Entfernen einer Quelle
- Arbeitsgedächtnis als Werkzeug und im Kontext
