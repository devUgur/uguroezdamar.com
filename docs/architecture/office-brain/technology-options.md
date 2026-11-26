# Office Brain – Technologieauswahl

Diese Auswahl bezieht sich auf künftige Office-Brain-Fachmodule. Sie ist kein Vorschlag, die bestehende Agentenruntime oder Präsenz umzubauen: `apps/api` läuft bereits auf Cloudflare Workers mit Durable Objects gemäß ADR 0024/0025.

- Status: Vorschlag; Bibliotheken sind nicht installiert
- Prüfung der Primärquellen: 24.11.2026

## Startvorschlag

| Bereich | Startvorschlag | Warum | Erneut prüfen, wenn |
| --- | --- | --- | --- |
| Weboberfläche | bestehendes Next.js-Portal auf Vercel | Auth, Portal und Hosting sind bereits vorhanden | Worker-Last oder Laufzeitgrenzen die UI-Plattform betreffen |
| System of record | bestehende Portal-Daten in Neon; Agenten-Work-Items in D1 gemäß ADR 0026 | nutzt je Domäne die vorhandene Quelle und vermeidet eine doppelte Aufgabenhaltung | eine neue Domäne braucht eine eigene dokumentierte Datenentscheidung |
| Graphdarstellung | @xyflow/react (React Flow) | React-Komponenten als Knoten, interaktive Kanten, Controls und anpassbare Oberfläche; MIT-Lizenz | ein reiner Lesekatalog ohne Editier-/Flow-Bedarf genügt |
| Modellzugriff | Kandidat: Vercel AI SDK Core mit zentralem Provider-Registry/ModelPort | gemeinsame API für Provider und strukturierte Tool-Schritte; Model IDs bleiben hinter Profilaliasen | Agentenworkflow-Funktionen eine andere Laufzeit erfordern |
| Agenten-Orchestrierung | zuerst ein einzelner begrenzter Agent mit explizitem Toolloop und deterministischen Server-Use-Cases | weniger Infrastruktur, leichter prüfbar und günstiger als frühe Multi-Agent-Fan-outs | reale Arbeit Wiederaufnahme, Parallelität oder viele Handoffs benötigt |
| Dauerhafte Ausführung | vorerst offen; Cloudflare Workflows ist ein Kandidat für lange Jobs und menschliche Freigabepausen | ergänzt später einen dauerhaften Runner, ohne das Portal zu ersetzen | ein POC Laufzeit, Datenzugriff, Betrieb und Kosten mit Vercel vergleicht |
| Dokumentdateien | zunächst Metadaten/Markdown in Neon bzw. Git; privater Objektspeicher nur für echte Binärdateien | vermeidet Storage-/Sync-Dienst in der Lernphase | Uploads, größere Quellen oder Versionierung Binärdateien benötigen |
| Semantische Suche | zuerst PostgreSQL-Volltext; später optional Neon pgvector | wenig Betriebsaufwand; Vektor-Add-on ist auf Neon laut Doku nicht nötig | Retrieval-Evaluation Volltext als unzureichend zeigt |

## Graph-UI

React Flow ist eine UI-Bibliothek, kein Graph-Backend. Die offizielle Dokumentation beschreibt individuelle React-Knoten und Handles; die Bibliothek übernimmt Interaktion wie Ziehen, Zoomen, Selektion und Verbindungen. Für das Portal sollte der React-Flow-Bereich ein klar abgegrenztes Client-Feature bleiben. Zugriffskontrolle, Graphabfrage und Speicherung gehören auf den Server.

Pro-Kopier-/Mehrbenutzerfunktionen können kostenpflichtig sein. Sie sind kein Bestandteil des Startvorschlags. Zuerst reichen die Open-Source-Funktionen mit MIT-Lizenz und eine serverseitig gespeicherte Ansichtspräferenz.

## Modelle und Anbieter

Der Server verwendet stabile interne Profile, keine Modellnamen in vielen Features:

~~~text
fast        → kostengünstiges, geeignetes Modell für Klassifikation/Extraktion
balanced    → Standard für begrenzte Recherche und Entwürfe
reasoning   → nur für Aufgaben, bei denen Qualität den Mehrpreis rechtfertigt
~~~

Ein zentraler Registry-/Adapterpunkt übersetzt das Profil zu einem Provider und einer Modellversion. Modellwahl und API-Schlüssel werden nicht vom Browser, Graph oder Agenten frei bestimmt. Provider-Optionen, die nicht portabel sind, bleiben in diesem Adapter und werden mit Fallback-/Fehlerverhalten dokumentiert.

Das Vercel AI SDK bietet Provider- und Modellmanagement über ein Registry sowie Agenten mit kontrollierter Tool-Schleife. Das passt als Kandidat zur vorhandenen TypeScript-/Next.js-Welt; vor Installation sind API-Stabilität, Pakete, Lizenz, Kostenmessung und ein kleiner POC zu prüfen.

## Frameworkvergleich

| Kandidat | Stärken | Grenzen für dieses Vorhaben | Plan |
| --- | --- | --- | --- |
| Vercel AI SDK | TypeScript-nativ, Provider-Registry, Tools und Agentenloops | ist kein vollständiges Produktdatenmodell oder eigener Office-Speicher | bevorzugter erster Modelladapter-Kandidat |
| Mastra | Agenten, Workflows, Memory, Knowledge und Studio in einem TypeScript-Ökosystem | offizielle Knowledge-Doku markiert Knowledge als Alpha; Studio ersetzt nicht die Portal-Autorisierung und den Datenvertrag | erst in einer isolierten POC-Branch gegen echte Office-Anforderungen testen |
| Cloudflare Agents SDK | langlebige Agent-Objekte, Routing, gespeicherter Zustand und Observability auf Durable Objects | bindet an Cloudflare/Durable Objects und deren Storage-/Runtime-Modell; aktuelles Serverpaket ist Node-orientiert | nicht als erster persistenter Kern; separat bewerten |
| Cloudflare Workflows | dauerhafte Schritte, Wiederholungen, warten auf Events/Freigaben | zusätzlicher Cloud-Runtime- und Datenzugriffsadapter; kein Wissens- oder Office-Datenmodell | möglicher späterer Runner, wenn kurze Ausführung nicht mehr reicht |
| LangGraph | explizite zustandsbehaftete Graph-Orchestrierung | aktuell kein Grund, zusätzlich ein zweites Framework-/Runtime-Ökosystem einzuführen | nur vergleichen, falls komplexe, verzweigte und wiederaufnehmbare Abläufe real auftreten |

**Empfehlung:** keine Frameworkentscheidung erzwingen, bevor ein einziger echter Arbeitsablauf als POC beschrieben ist. Für erste Modellaufrufe ist eine kleine, austauschbare Schnittstelle plus AI-SDK-Kandidat am leichtesten in die bestehende TypeScript-App einzuordnen. Die eigentliche fachliche Wahrheit und Freigabelogik bleibt in eigenem Code.

## Speicher und Suche

1. Dokumente erhalten Version, Urheber/Herkunft, Zugriffsumfang und Status.
2. PostgreSQL-Volltextsuche bildet die erste Messbasis.
3. Wenn ein Testsatz echte semantische Suchlücken nachweist, kann pgvector in der dafür gewählten Wissensdatenbank aktiviert werden; Agenten-Work-Items bleiben in D1.
4. Vektoren werden getrennt nach Embedding-Modell/Version und Dimension identifiziert; Providerwechsel verlangt Neuindexierung oder parallele, versionierte Vektorsätze.
5. Ein externer Graph- oder Vektordienst wird nur eingeführt, wenn eine dokumentierte Last-/Qualitätsmessung PostgreSQL übersteigt.

## Verifizierte offizielle Quellen

- React Flow, Custom Nodes: https://reactflow.dev/learn/customization/custom-nodes
- React Flow, Projekt und Lizenz: https://reactflow.dev/
- AI SDK, Agentenübersicht: https://ai-sdk.dev/docs/agents/overview
- AI SDK, Provider-/Model-Registry: https://ai-sdk.dev/docs/ai-sdk-core/provider-management
- Mastra, Knowledge-Status und Scopes: https://mastra.ai/docs/knowledge/overview
- Cloudflare Agents Runtime: https://developers.cloudflare.com/agents/runtime/
- Cloudflare Workflows, dauerhafte Schritte und Freigaben: https://developers.cloudflare.com/workflows/
- Neon pgvector: https://neon.com/docs/extensions/pgvector

Technologie- und Preisinformationen sind Momentaufnahmen und müssen vor Installation, Vertragsbindung oder Deployment neu geprüft werden.
