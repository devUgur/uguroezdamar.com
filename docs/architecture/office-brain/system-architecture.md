# Office Brain – Systementwurf

- Status: Vorschlag
- Geltungsbereich: Admin-Portal, Agentensteuerung, Aufgabenfluss, Wissensbibliothek und Visualisierung

## Systemkontext

Das Office erweitert das bestehende Portal, statt eine zweite Verwaltungs-App daneben zu stellen. Das Portal bleibt die Bedienoberfläche und Autorisierungsgrenze. Server Use Cases validieren jede Aktion und speichern ihren Zustand in Neon. Modell- und Ausführungsanbieter hängen hinter schmalen Adaptern.

**Bestand heute:** Agentenchat und Agentenbüro sind bereits ein eigener, in ADR 0024/0025 festgelegter Laufzeitpfad: das Portal auf Vercel ruft `apps/api` auf Cloudflare auf; D1 hält Ereignisse, Durable Objects halten Thread-Verlauf und synchronisierte Office-Bewegungspläne. Diese bestehende Plattform wird nicht in das Neon-Zielbild umgebogen. Neue Office-Brain-Fachmodule müssen ihren Speicherpfad ausdrücklich festlegen und Agentenereignisse über einen klaren Adapter beziehen.

~~~mermaid
flowchart LR
  Owner[Owner / Admin] --> Portal[apps/portal<br/>Office UI und API]
  Portal --> Server[packages/server<br/>Office Use Cases und Rechte]
  Server --> DB[(Neon PostgreSQL<br/>Arbeitsdaten, Graph, Wissen, Ereignisse)]
  Server --> ModelPort[ModelPort<br/>Profil → Provider/Modell]
  ModelPort --> LLM[Modellprovider oder Gateway]
  Server --> RunPort[RunPort<br/>kurze / dauerhafte Ausführung]
  RunPort -. bei nachgewiesenem Bedarf .-> Workflow[optionale durable Worker-Plattform]
  Server --> BlobPort[Artefakt-Adapter]
  BlobPort -. nur wenn Dateien es erfordern .-> Blob[privater Objektspeicher]
  Infisical[Infisical<br/>Provider-Secrets] --> Server
  Infisical --> Workflow
~~~

Die Grafik ist ein Zielbild, keine bereits vorhandene Infrastruktur. Der erste Schritt benötigt nur Portal, vorhandene Servergrenze und Neon. Ein separater Worker oder Objektspeicher bleibt ein späteres Entscheidungstor.

## Laufzeitgrenzen

### Portal als Kontrollzentrum

Die Office-Oberfläche gehört unter eine geschützte Portalroute, konzeptionell etwa /admin/office. Vorgeschlagene Bereiche:

- Übersicht: offene Aufgaben, laufende und wartende Runs, letzte Aktivitäten;
- Workers: Agenten, Fähigkeiten, erlaubte Werkzeuge, Modellprofil und Status;
- Aufgaben: Zuweisung, Priorität, Ergebnis und Freigabeschritte;
- Graph: filterbare Beziehungen zwischen Arbeit und Wissen;
- Wissen: Quellen, Versionen, Zugriffsumfang, Freigabestatus und Zitate;
- Kosten/Aktivität: Modellnutzung, Fehler, Laufzeiten und Kostenabschätzung.

Die Next.js-Seite ruft Queries und Actions ihres eigenen Features auf. UI-Code greift nicht direkt auf Neon zu. Jede Route und Action prüft Session, Rolle, Ressourcenumfang und konkrete Berechtigung serverseitig.

### Agentenlauf

1. Ein Mensch legt eine Aufgabe an oder weist sie einem Worker zu.
2. Der Server prüft die Berechtigung und schreibt Aufgabe sowie Run mit Status queued.
3. Eine versionierte Worker-Definition legt Modellprofil, Werkzeuge, Wissensbereiche, Grenzen und Freigaberegeln fest.
4. Der Runner führt einen klar begrenzten Schritt aus und protokolliert Statusereignisse. Lange Arbeit wird wiederaufnehmbar; ein erneuter Versuch darf Seiteneffekte nicht doppelt auslösen.
5. Schreibende oder externe Aktionen erzeugen eine Freigabeanforderung. Erst ein berechtigter Mensch kann sie bestätigen oder ablehnen.
6. Ergebnis, Quellen, Token-/Nutzungswerte und Endstatus werden gespeichert und in Portal/Graph dargestellt.

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
