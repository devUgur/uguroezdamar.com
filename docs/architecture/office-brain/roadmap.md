# Office Brain – Roadmap

- Status: Gesamtvorhaben Vorschlag; synchronisierte Agentenpräsenz ist eine separat akzeptierte und implementierte Scheibe (ADR 0025)
- Ziel: erst einen sichtbaren und sicheren Arbeitsfluss belegen, danach Worker und Infrastruktur erweitern

## Phase 0 — Arbeitsfälle und Grenzen festlegen

**Ergebnis:** knapper Produktvertrag für das Office und eine messbare POC-Aufgabe.

- Drei echte, wiederkehrende Arbeitsfälle mit Input, erwartetem Ergebnis und Owner aufschreiben.
- Für jeden Fall festlegen: read-only oder schreibend, Datenklasse, nötige Quellen und menschliche Entscheidung.
- Rollen, erste Worker-Profile, Werkzeug-Allowlist und maximale Ausgaben/Run definieren.
- Datenaufbewahrung, Providerkonto/-region und Budgetfreigabe klären.

**Gate:** mindestens ein kleiner, wertvoller Arbeitsfall passt in einen begrenzten Einzelagentenlauf. Kein Multi-Agent-Schwarm als Startanforderung.

## Phase 1 — Office-Shell und Sichtbarkeit

**Ergebnis:** geschützte Portalübersicht für Agentenkatalog, Aufgabenstatus, Run-Ereignisse und erste Graphansicht.

- Bestehende Admin-Session und Rollen nutzen.
- Zunächst nur lesbare Demo-/Testdaten oder einen ausdrücklich freigegebenen kleinen Datensatz anzeigen.
- Der Graph visualisiert gespeicherte Objekte und typisierte Beziehungen; keine Ausführung wird durch Ziehen eines Knotens ausgelöst.
- Keine Modellprovider, Embeddings oder zusätzlichen Cloud-Dienste voraussetzen.

**Gate:** Owner kann Aufgabe, Worker, Status und Beziehungen verstehen; Graph funktioniert mit Tastatur und bei schmalen Viewports; Rechte und leere/fehlerhafte Zustände sind sichtbar geprüft.

### Bereits separat umgesetzt: Agentenbüro und gemeinsame Präsenz

Das bestehende `/agents`-Feature ist nicht der Aufgaben-/Graph-Shell aus dieser Roadmap. Seine 2D- und 3D-Figuren nutzen einen serverautoritativen Bewegungsplan aus `OfficePresence` in `apps/api`; D1-Ereignisse bestimmen die Aktivität, Live-Updates gehen über den bestehenden Hub. Jeder Browser erhält beim WebSocket-Verbinden einen Snapshot und rendert dieselbe Bewegung. Freie Agenten wandern kontinuierlich, solange mindestens ein Büro geöffnet ist; ohne Abonnenten pausieren die Alarme. Die Kamera bleibt individuell. Die Portalansicht meldet eine fehlende Snapshot-Synchronisierung sichtbar, statt eine erfolgreiche Live-Synchronisierung vorzutäuschen.

**Abnahme für diesen Slice:** Dev-Preview in zwei Browsern parallel auf Agentenbewegungen und Aktivitätswechsel prüfen; WebSocket-Neuverbindung, 2D-Rückfall, Reduced Motion und getrennte Kamerasicht manuell prüfen. Produktionsfreigabe bleibt getrennt.

## Phase 2 — Ein einzelner beaufsichtigter Worker

**Ergebnis:** ein Agent erledigt eine begrenzte read-only Aufgabe und liefert ein Ergebnis mit Quellen/Tool-Spur.

- Zentraler ModelPort mit festen Profilaliasen und Provider-Key ausschließlich serverseitig.
- Explizite, typisierte Werkzeuge; keine beliebigen URLs, Shell-Kommandos oder generischen SQL-Werkzeuge.
- Laufzeit-, Schritt-, Token- und Kostenobergrenzen; Run abbrechen können.
- Status und Nutzungsdaten persistieren; menschliche Bewertung von Ergebnisqualität und Kosten.

**Gate:** akzeptable Erfolgsrate im vereinbarten Testfall, reproduzierbares Kostenprofil und keine nicht freigegebenen Schreibaktionen.

## Phase 3 — Kuratierte Wissensbibliothek

**Ergebnis:** kontrollierte Dokumente mit Herkunft, Version, Scope und zitierbaren Abschnitten.

- Zuerst bestehende Git-Dokumente referenzieren und PostgreSQL-Volltext evaluieren.
- Kleine, freigegebene interne Testquelle ergänzen, wenn der Fall sie benötigt.
- Bewertungssatz aus echten Fragen und Sollquellen aufbauen.
- Erst nach Retrieval-Auswertung pgvector aktivieren oder andere Suchtechnik vergleichen.
- Agentenschreibvorschläge als Review-Warteschlange führen.

**Gate:** Antworten zeigen passende, zugängliche Quellen; fremde Scopes liefern keine Treffer; Neuimport und Löschung sind nachvollziehbar.

## Phase 4 — Dauerhafte Aufgaben und Freigaben

**Ergebnis:** länger dauernde Arbeit kann sicher pausieren, fortsetzen, abbrechen und nach einem Laufzeitfehler wiederaufgenommen werden.

- Vercel-Request und Worker-Run über RunPort entkoppeln.
- Cloudflare Workflows und eine zur bestehenden Hostingplattform passende Alternative als kleinen POC vergleichen.
- Neon bleibt die Quelle für Runstatus und fachliche Daten.
- Retry-/Idempotenzverhalten, Webhook-Authentifizierung, Secrets und Datenzugriff belegen.

**Gate:** gemessener Vorteil gegenüber kurzen Portal-Runs, inklusive tatsächlicher Tarif-/Betriebskosten und erfolgreichem Resume-/Approval-Test.

## Phase 5 — Team aus Agenten und Integrationen

**Ergebnis:** weitere spezialisierte Worker arbeiten nach ausdrücklicher Zuweisung und über nachvollziehbare Übergaben.

- Agenten spezialisieren sich erst nach nachgewiesenem Bedarf, etwa Recherche, Planung oder Qualitätsprüfung.
- Übergabe enthält Aufgaben-ID, Quellen, erlaubte Scopes und versionierte Ergebnisse.
- Externe Integrationen kommen einzeln als minimal berechtigte Tools hinzu.
- Modellwechsel werden mit festem Evaluationssatz, Kostenvergleich und Rollback überprüft.

**Gate:** zusätzliche Agenten verbessern die Abnahmequote oder Laufzeit messbar und bleiben innerhalb der freigegebenen Budget-/Berechtigungsgrenzen.

## Vor jeder Implementierungsphase

1. Issue mit Scope, Datenklassen, Sicherheitsauswirkung und Kostenmessung anlegen.
2. Für dauerhafte Technologie-/Datenmodell-/Hostingentscheidungen einen ADR-Entwurf in decisions/ ergänzen.
3. Aktuelle offizielle API-/Lizenz-/Preisquellen erneut prüfen.
4. Datenmigrationen, Secrets, Cloudzugriffe und Deployment als getrennte Freigaben behandeln.
5. PR mit Tests, Preview, Rollen-/Negativfällen und Owner-Abnahme schließen.
