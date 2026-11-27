# ADR 0025: Synchronisierte Agentenpräsenz mit lokaler Kamera

- Status: accepted
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0024](0024-agent-platform-on-cloudflare.md)

## Kontext

Das Agentenbüro unter `/agents` rendert eine 2D- und eine 3D-Ansicht. Die Figurenbewegung wurde bisher im Browser mit zufälligen Zielen berechnet. Mehrere Browser desselben Owners zeigten deshalb unterschiedliche Positionen. Agentenereignisse waren zwar bereits serverseitig gespeichert und über den Live-Hub verteilt, ein vollständiger Office-Schnappschuss beim Verbinden fehlte.

Die 3D-Kamera ist eine Bedienpräferenz. Jede Browserinstanz soll unabhängig drehen und zoomen können. Eine gemeinsame Kamera würde andere Owner-Ansichten unerwartet verändern.

## Entscheidung

1. Das Agenten-Backend `apps/api` bleibt gemäß ADR 0024 die Laufzeitgrenze. Ein `OfficePresence` Durable Object repräsentiert das eine gemeinsame Agentenbüro und persistiert dessen Bewegungspläne in SQLite.
2. Agentenereignisse bleiben in D1 die Quelle für fachliche Aktivität. Nach dem D1-Schreibvorgang erhält das Office-Objekt die Event-ID und aktualisiert Aktivität, Weg und Revision idempotent. Neue Verbindungen erhalten über `GET /api/office/state` einen vollständigen aktuellen Schnappschuss.
3. Das Office-Objekt veröffentlicht nach Zustandsänderungen vollständige Schnappschüsse über den bestehenden Live-Hub. Eine Revision erlaubt dem Portal, verspätete oder doppelte Schnappschüsse zu verwerfen. Clients berechnen Zwischenbilder aus gemeinsamem Startpunkt, Ziel, Startzeit und Geschwindigkeit; sie senden keine Positionen an den Server.
4. Die 2D- und 3D-Ansicht verwenden dieselben Weltkoordinaten und Bewegungspläne. Die 2D-Ansicht bleibt WebGL-Rückfall.
5. Kamera, Auswahl und Darstellungsmodus sind lokale Browserzustände. OrbitControls werden nicht persistiert oder übertragen. `prefers-reduced-motion` darf die lokale Übergangsanimation verkürzen; es ändert den autoritativen Raumzustand nicht.
6. Es gibt zunächst genau einen Raum (`main`), passend zum aktuellen Produktmodell. Bei mehreren Büros wird die Durable-Object-Identität nach Raum getrennt; die Kamera bleibt jeweils lokal.
7. Die Portal-Session bleibt Zugangsschranke: Der Portal-Server ruft den geschützten Snapshot-Endpunkt mit dem Service-Token auf. Browser erhalten nur das bestehende kurzlebige Einmal-Ticket für den Live-Hub.
8. Der Live-Hub zählt explizite Office-Abonnenten über WebSocket-Attachments. Das Office-Objekt lässt freie Agenten nur wandern, solange mindestens ein Browser `/agents` geöffnet hat. Die Gehgeschwindigkeit beträgt 2,8 Welt-Einheiten pro Sekunde; freie Ziele decken fast die gesamte offene Bodenfläche ab. Beim letzten Verbindungsabbruch werden Bewegungsalarme gestoppt; beim nächsten Abonnenten werden neue gemeinsame Ziele erzeugt.
9. Kann das Portal keinen Snapshot laden, zeigt es eine klar gekennzeichnete lokale Vorschau mit sichtbaren Agenten, statt das Büro leer zu lassen. Freie Figuren laufen in dieser Vorschau deterministisch anhand der Zeit; beschäftigte Figuren sitzen am Platz. Die Vorschau ist visuell gleich abgeleitet, aber keine autoritative Aktivität und beansprucht keine browserübergreifende Live-Synchronisierung. Das Portal wiederholt den Snapshot-Aufruf, solange kein autoritativer Stand vorliegt, und beschreibt bekannte API-Fehler konkret.
10. Die Server-Page lädt Agentenliste und Office-Snapshot parallel und übergibt den Snapshot als Initialzustand an die 3D-Ansicht. So startet der erste sichtbare Frame an der interpolierten autoritativen Position statt an einem lokalen Preview-Punkt. Wenn ein Snapshot später nach einer Störung eintrifft, gleicht die 3D-Figur den Positionsunterschied kurz und weich aus.

## Alternativen

- Zufällige Bewegung pro Browser beibehalten: verworfen, weil sie genau die beobachtete Abweichung erzeugt.
- Position bei jedem Frame übertragen: verworfen, weil es hohe Nachrichtenfrequenz verursacht. Ein gemeinsamer Bewegungsplan reicht für flüssige, vorhersehbare Interpolation.
- Kamera für alle Browser teilen: verworfen, weil sie eine persönliche Bedienpräferenz ist.
- Neon/PostgreSQL als zusätzlicher Präsenzspeicher: verworfen. Der Office-Zustand koordiniert die bestehende Cloudflare-Agentenlaufzeit; ein weiterer Datenpfad wäre unnötig. D1 bleibt Ereignisquelle, das SQLite des Durable Objects hält die aktuelle Raumbewegung.

## Konsequenzen

- Wrangler erhält eine `OfficePresence`-Klasse und SQLite-Migration `v2`; Portal und Worker brauchen einen Dev-Preview-Live-Test.
- Die vorhandene Wrangler-Konfiguration verwendet die imperative `migrations`-Liste; diese Änderung ergänzt sie um `v2`. Ein Wechsel auf die neuere deklarative Klassenverwaltung ist eine separate Migrationsentscheidung.
- Die API spiegelt die kleinen, stabilen 3D-Koordinatenregeln zur Platzierung, da `apps/api` keine Workspace-Pakete importiert. Die Koordinaten sind Teil des internen API-Vertrags und müssen bei Änderungen an `world/layout.ts` synchron angepasst werden.
- Bewegung ist zeitbasiert, nicht framebasiert. Das Durable Object plant Zielwechsel per Alarm nur, solange das Büro geöffnet ist; Browser übertragen keine Animationsdaten. Der Leerlaufzustand erzeugt außerhalb einer geöffneten Office-Ansicht keine periodischen Alarmaufrufe.
- Der Gesamtplan Office Brain bleibt Vorschlag. Diese Entscheidung betrifft ausschließlich das bereits bestehende Agentenbüro, nicht Aufgaben-, Wissens- oder Graphdaten.

## Verifikation und Rückprüfung

- In zwei gleichzeitigen Browsern dieselbe Figur während Leerlauf, Arbeitsbeginn, Warten und Arbeitsende beobachten; beide Ansichten müssen nach dem Snapshot dieselbe Bewegung abspielen.
- Eine WebSocket-Unterbrechung simulieren und prüfen, dass der Snapshot nach der Wiederverbindung den aktuellen Stand herstellt.
- Im Leerlauf prüfen, dass Agenten im geöffneten Büro weiterwandern und beim Schließen des letzten Office-Tabs keine Bewegungsalarme weiterlaufen.
- API-Dev vor der Abnahme aktualisieren; bei absichtlich fehlendem oder unerreichbarem Snapshot müssen Agenten sichtbar bleiben, der Status muss „lokale Vorschau“ nennen und nach Wiederherstellung automatisch auf synchronisierte Präsenz wechseln.
- Die 2D-Rückfallansicht auf dieselben Positionen prüfen; Kameraänderungen in einem Browser dürfen den anderen nicht bewegen.
- Aufheben oder neu entscheiden, falls ein zweiter Raum, gemessene Koordinatenabweichungen oder Präsenzlast eine andere Raum-Partitionierung erfordern.

## Nachtrag 27.11.2026: Leerlauf-Bewegung im Browser

**Anlass:** Das Durable-Objects-Kontingent von Workers Free (100.000 Requests am Tag) war aufgebraucht. Die größten Verursacher im Code:

- **Bewegungs-Alarme:** `OfficePresence` plante die Leerlauf-Bewegung jedes Agenten mit Alarmen, alle 1,5 bis 5 Sekunden, solange ein Office offen war. Jeder Alarm mit Änderung löste zusätzlich einen Broadcast an den `LiveHub` aus.
- **Ereignisse:** Jedes Agenten-Ereignis rief das Office und den Hub auf.
- **Gestreamter Text:** Er ging viermal pro Sekunde an den Hub.

**Änderung:**

- **Gemeinsamer Zustand:** Er umfasst nur noch Tätigkeit (arbeitet, wartet, Fehler, frei), Plätze und Raum.
  - Ihn ändern nur Ereignisse, die eine Tätigkeit ändern können: `user_message`, Freigaben, `message`, `stopped`, `error`, `budget_blocked`.
  - Gespeichert und veröffentlicht wird nur eine echte Änderung.
- **Leerlauf-Bewegung:** Jeder Browser zeichnet sie selbst, aus Uhrzeit (Serverzeit-Abgleich) und Agenten-ID (`localFallbackMotion`).
  - So sieht sie in allen Browsern gleich aus, ohne Server-Alarm.
  - `OfficePresence` setzt keine Alarme mehr und löscht alte.
- **Heartbeat:** Den Ping der Browser beantwortet Cloudflare per `setWebSocketAutoResponse`, ohne das Durable Object zu wecken. Der Abstand beträgt jetzt 30 Sekunden.
- **Streaming:** Gestreamter Text geht einmal pro Sekunde an den Hub.

**Was bleibt:** Die Kamera ist weiterhin lokal; die gemeinsame Wahrheit ist, wer arbeitet und wo sein Platz ist. Wer gerade frei herumläuft, wird nicht mehr serverseitig geführt.
