# Office Brain – Systementwurf

- Status: Vorschlag
- Geltungsbereich: Admin-Portal, Agentensteuerung, Aufgabenfluss, Wissensbibliothek und Visualisierung

## Systemkontext

Das Office erweitert das bestehende Portal, statt eine zweite Verwaltungs-App daneben zu stellen. Das Portal bleibt die Bedienoberfläche und Session-Grenze. Agentenarbeit wird über die geschützte `apps/api`-Control-Plane validiert und in D1 gespeichert (ADR 0026); bestehende Portal-Domänen nutzen weiterhin `packages/server` und Neon. Modell- und Ausführungsanbieter hängen hinter schmalen Adaptern.

**Bestand heute:** Agentenchat, Aufgabenboard, read-only Organisationskatalog und Agentenbüro nutzen einen Laufzeitpfad: das Portal auf Vercel ruft `apps/api` auf Cloudflare auf; D1 hält Organisationsprofile, Instanzen, Work-Items und Events, Durable Objects halten Thread-Verlauf und synchronisierte Office-Bewegungspläne. Neon bleibt für bestehende Portal-Daten. Weitere Domänen erhalten einen expliziten Speichervertrag, statt dieselben Aufgaben in Neon und D1 zu duplizieren.

~~~mermaid
flowchart LR
  Owner[Owner / Admin] --> Portal[apps/portal<br/>Office UI und API]
  Portal --> API[apps/api<br/>Control Plane und Agenten-Adapter]
  API --> D1[(Cloudflare D1<br/>Organisation, Tasks, Agenten, Events)]
  API --> Runtime[Durable Objects<br/>Thread, LiveHub, OfficePresence]
  API --> ModelPort[ModelPort<br/>Profil → Provider/Modell]
  ModelPort --> LLM[Modellprovider oder Gateway]
  Portal --> Server[packages/server<br/>bestehende Portal-Domänen]
  Server --> Neon[(Neon PostgreSQL)]
  API -. langer Lauf bei Bedarf .-> Workflow[optionale durable Worker-Plattform]
  Infisical[Infisical<br/>Portal-Secrets] --> Server
~~~

Die Grafik zeigt den bestehenden Agentenpfad und geplante Erweiterungen. Das Portal verwendet Neon weiter für seine bestehenden Fachbereiche. Agentenbezogene Aufgaben laufen über D1; eine zusätzliche Worker-Plattform oder ein Objektspeicher bleibt ein späteres Entscheidungstor.

## Laufzeitgrenzen

### Portal als Kontrollzentrum

Die Office-Oberfläche gehört unter geschützte Portalrouten. `/agents`, `/chat` und `/work` sind die bestehenden Bereiche. Weitere Management-/Knowledge-Ansichten sind Vorschläge:

- Übersicht: offene Aufgaben, laufende und wartende Runs, letzte Aktivitäten;
- Workers: Agenten, Fähigkeiten, erlaubte Werkzeuge, Modellprofil und Status;
- Aufgaben: Zuweisung, Priorität, Ergebnis und Freigabeschritte;
- Graph: filterbare Beziehungen zwischen Arbeit und Wissen;
- Wissen: Quellen, Versionen, Zugriffsumfang, Freigabestatus und Zitate;
- Kosten/Aktivität: Modellnutzung, Fehler, Laufzeiten und Kostenabschätzung.

Die Next.js-Seite ruft Queries und Actions ihres eigenen Features auf. UI-Code greift weder direkt auf D1/Neon noch auf Cloudflare-Bindings zu. Jede Route und Action prüft die Portal-Session; die API prüft Service-Token, Eingaben, Statusübergänge und Scope serverseitig. `/organization` liest den Katalog read-only. Rollenprofile verleihen keine Ausführungsrechte; nur registrierte Runtime-Definitionen können Tasks übernehmen.

### Agentenlauf

1. Ein Admin legt eine Aufgabe an und verschiebt sie in `ready`.
2. Die geschützte API prüft den aktuellen Status und startet sie derzeit ausschließlich beim registrierten Chef-Agenten. Sie erzeugt einen Thread mit `task_id` und wechselt atomar per bedingtem Update nach `in_progress`.
3. Titel, Beschreibung und Abnahmekriterien bilden den Arbeitsauftrag; die Agent-Definition beschränkt Modellprofil, Werkzeuge, Budget und Freigaben.
4. Der Durable-Object-Thread führt begrenzte Etappen aus. Task-ID, Events, Freigaben und Thread sind verknüpft; Stop oder Fehler blockieren die Aufgabe.
5. Schreibende/externe Aktionen warten auf Freigabe. Ein erfolgreicher Agentenlauf verschiebt die Aufgabe nach `review`; der Mensch prüft und führt sie durch QA zu `done`.
6. Ergebnis, Event-Spur und Endstatus werden aus D1 im Board angezeigt. Eine automatische Delegation oder QA-Runtime ist noch nicht aktiv.

Ein Modell darf Vorschläge liefern, aber weder seine eigene Berechtigung erweitern noch die Autorisierung oder den Statusübergang selbst festlegen.

### Graphansichten

Die Visualisierung besteht aus drei fachlich getrennten Sichten:

1. **Office-Karte:** Menschen, Agenten, Fähigkeiten und verfügbare Werkzeuge.
2. **Wissensgraph:** Dokumente, Themen, Projekte und belegte Beziehungen.
3. **Arbeits-/Run-Graph:** Aufgaben, Schritte, Übergaben, Ergebnisse, Freigaben und Fehler.

Die Kanten stammen aus fachlichen Beziehungen und Run-Ereignissen. Die Position eines Knotens ist zunächst nur eine gespeicherte Ansichtspräferenz. Sie darf weder Ausführung noch Berechtigungen steuern. Erst ein ausdrücklich geplanter Workflow-Editor dürfte versionierte, validierte Workflow-Definitionen veröffentlichen.

### Wissensbibliothek

Eine Quelle besitzt Eigentümer, Herkunft, Zeitstempel, Version, Datenklasse, Umfang und Status. Jede Antwort mit Wissensbezug soll auf konkrete Quellen/Abschnitte verweisen.

- Bestehende, freigegebene Betriebs- und Produktdokumentation bleibt in Git die kanonische Quelle.
- Neue interne Dateien können später privat gespeichert werden. Rohdatei und extrahierte Chunks bleiben unterscheidbar.
- Phase eins nutzt PostgreSQL-Volltextsuche. Semantische Suche kommt erst hinzu, wenn ein Qualitätsvergleich zeigt, dass sie nötig ist.
- Bei Embeddings werden Provider, Modell-ID, Version, Dimension und Chunking-Version gespeichert. Ein Modellwechsel braucht ein Reindexing-Konzept.
- Importierte oder vom Agenten vorgeschlagene Fakten werden als ungeprüft markiert. Agenten dürfen nicht stillschweigend Richtlinien oder freigegebenes Wissen überschreiben.
- Erinnerungen eines Threads bleiben getrennt von gemeinsamem, kuratiertem Wissen.

## Persistierter Organisationskatalog

ADR 0027 bildet Abteilungen, Rollenprofile, Agent-Definitionen und Agent-Instanzen als getrennte D1-Entitäten ab. Rollen beschreiben fachliche Verantwortung und Fähigkeiten, nicht Tool-Rechte. Die Definition `chef-v1` verweist auf den bestehenden Registry-Key `chef`; weitere Profile sind noch nicht ausführbar. Die Office-Ansicht rendert weiterhin nur aktive Runtime-Instanzen aus `/api/agents`, nicht jedes Rollenprofil.

## Konzeptionelle Module

Noch keine Tabellennamen oder Migrationen; die fachlichen Objekte sind zunächst:

| Modul | Verantwortliche Konzepte |
| --- | --- |
| Identity & policy | bestehende Admin-Identität, Rollen, Ressourcenumfang und Tool-Berechtigungen |
| Workers | Agentenidentität, Version, Fähigkeiten, Modellprofil, Status und Richtlinien |
| Work | Aufgaben, Zuweisungen, Priorität, Status, Ergebnisse und Abhängigkeiten |
| Runs | Ausführung, Schritte, Ereignisse, Tool-Aufrufe, Fehler, Limits und Wiederaufnahme |
| Approvals | vorgeschlagene Aktion, Antragsteller, Prüfer, Entscheidung und Audit-Ereignis |
| Knowledge | Quelle, Dokumentversion, Abschnitte/Chunks, Belege, Scopes und Suchindizes |
| Graph | stabile Objektidentitäten und typisierte, belegbare Beziehungen |
| Provider adapters | Sprachmodell, Embedding, Runner und später externe Integrationen |

Für referenzierbare Graphknoten braucht es stabile Objekt-IDs und typisierte Kanten. Fachliche Entitäten bleiben normalisiert; ein universelles JSON-Objektmodell darf die Domäne nicht ersetzen.

## Abhängigkeitsrichtung

Vorgeschlagene Grenze innerhalb des bestehenden Monorepos:

~~~text
apps/portal/src/features/office/
  UI und Portal-Adapter für office, workers, work, graph, knowledge
packages/server/src/office/
  Policies, Validierung, Use Cases, Repositories und Providerports
tooling/
  lokale Bedienung/Diagnose nur falls später benötigt
~~~

Die Beispielpfade sind Planung, keine jetzt anzulegenden Source-Verzeichnisse. Das aktuelle Feature-Prinzip gilt weiter: Ein Feature importiert kein anderes Feature. Gemeinsame Office-Use-Cases liegen im Serverpaket; Fachlogik wandert nicht in layout.tsx oder React-Flow-Knoten.

## Nichtziele der ersten Version

- keine frei laufenden Agentenschwärme;
- keine automatische Veröffentlichung, E-Mail, Zahlung, Rollenänderung oder Produktionsänderung;
- keine öffentliche Wissensbibliothek und kein Training eines eigenen Basismodells;
- kein Wechsel von Next.js/Vercel oder Neon, solange kein konkreter Engpass besteht;
- keine Graphdatenbank, Vektorplattform oder Message-Broker ohne gemessenen Bedarf;
- kein Workflow-Canvas, der seinen eigenen ausführbaren Zustand ungeprüft speichert.
