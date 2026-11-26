# ADR 0032: Mandantenfähigkeit und One-Click-Verbindung zu GitHub

- Status: accepted als Richtung; Stufe 1 umgesetzt, Stufen 2 bis 4 offen
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Baut auf: [ADR 0024](0024-agent-platform-on-cloudflare.md), [ADR 0029](0029-projects-as-repository-access.md), [ADR 0031](0031-github-app-access.md)

## Kontext

Heute ist die Plattform ein Werkzeug für einen Owner. Das zeigt sich an fünf Stellen:

1. Es gibt genau einen freigegebenen GitHub-Besitzer (`GITHUB_OWNERS`), und die Admin-Konten des Portals (Neon, Rollen `owner`, `admin`, `editor`) gehören alle zu diesem Owner.
2. Das Portal ruft die API mit einem gemeinsamen Service-Token auf und nennt den Admin im Header `x-portal-actor`. Die API kennt keine Mandanten.
3. Die D1-Tabellen (`projects`, `threads`, `tasks`, `approvals`, `events`, `memories`, Organisationskatalog) haben kein Mandantenfeld. Die Durable Objects heißen `thread:<id>`.
4. Die GitHub App ist auf „Only on this account“ eingestellt. `AGENT_GH_APP_ID` und `AGENT_GH_APP_PRIVATE_KEY` gehören zur App des Owners.
5. Modelle, GPU-Zeit und Tagesbudget laufen auf dem Konto des Owners.

Die Idee: Die Plattform wird später als SaaS angeboten. Ein Kunde meldet sich an, klickt „GitHub verbinden“, wählt die Repositories und kann per Chat mit Agenten daran arbeiten, so wie bei den GitHub-Plugins von ChatGPT oder Claude. Dieses ADR legt den Weg dorthin fest, ohne ihn jetzt zu bauen.

## Entscheidung (Vorschlag)

### 1. Ein Mandant ist ein Kunde, eine GitHub-Installation gehört genau einem Mandanten

- Neue Tabelle `tenants` (Id, Name, Status, Plan, Limits) und `tenant_installations` (Mandant, GitHub-Installations-Id, Konto, Auswahl „alle/ausgewählte Repositories“, Status).
- Jede mandantenbezogene Zeile erhält `tenant_id`: `projects`, `threads`, `tasks`, `approvals`, `events`, `memories`, `task_reviews`, Organisationskatalog und Auditlog. Jede Abfrage der API filtert darauf, auch in den Werkzeugen (`policyOf`, `readTarget`, `listRepositories`, `registerProject`).
- Der Owner ist der erste Mandant („Stufe 1“). Alle bisherigen Zeilen werden ihm per Migration zugeordnet. Damit ändert sich für heute nichts.

### 2. Die Besitzer-Freigabe wird aus der Installation abgeleitet

`GITHUB_OWNERS` entfällt als Konfiguration. Ein Besitzer ist freigegeben, wenn die App dort **für diesen Mandanten** installiert ist. Der Kunde bestimmt bei der Installation, welche Repositories die App sieht; die Registrierung (ADR 0029) bleibt die Schreibgrenze innerhalb davon. Installations-Tokens (ADR 0031) sind schon je Konto getrennt; der KV-Schlüssel enthält die Installations-Id und damit den Mandanten.

### 3. „GitHub verbinden“ als Fluss

1. Der Kunde klickt im Portal auf „GitHub verbinden“. Das Portal erzeugt einen kurzlebigen, signierten `state` (Mandant, Nutzer, Ablauf, Einmalwert) und leitet auf die Installationsseite der App weiter.
2. GitHub leitet nach der Installation auf die **Setup URL** der API zurück (`installation_id`, `state`). Die API prüft den `state`, fragt GitHub nach der Installation, prüft, dass sie zu einer Installation der App gehört, und schreibt `tenant_installations`. Eine Installation, die schon einem anderen Mandanten gehört, wird abgelehnt.
3. Der **Webhook** (`installation`, `installation_repositories`, `suspend`, `deleted`) hält den Zustand aktuell und entzieht den Zugang sofort, wenn der Kunde die App deinstalliert. Er ist ab hier Pflicht, nicht mehr optional (siehe 7.).
4. Danach erscheinen die Repositories des Kunden unter „Projekte“, wie heute für den Owner.

Die App muss dafür „Any account“ erlauben. Die Entscheidung, ob eine öffentliche App im GitHub Marketplace gelistet wird, ist davon unabhängig und kommt später.

### 4. Trennung der Daten und Ausführung

- Durable Objects heißen `t:<tenant>:thread:<id>`, KV-Schlüssel beginnen mit dem Mandanten, R2-Pfade ebenso. Ein Mandant kann so nie ein Objekt eines anderen adressieren, selbst bei einem Fehler in der Abfrage.
- Das Portal sendet keinen gemeinsamen Service-Token mehr als alleinige Identität. Es sendet ein **kurzlebiges signiertes Zugangs-Token** (Mandant, Nutzer, Rolle, Ablauf), das die API prüft. Der gemeinsame Token bleibt nur für den Owner-Mandanten und interne Aufrufe.
- Rollen je Mandant: `owner`, `admin`, `editor` wie heute, ohne Rechte über Mandantengrenzen. Die plattformweite Verwaltung (`platform-owner`) ist eine eigene, getrennte Rolle.

### 5. Datenschutz bleibt die harte Regel

Die Sperre aus ADR 0029 gilt für Kundendaten **ohne Ausnahme und ohne Wahl**: Inhalte privater Repositories gehen nur an Modelle, die sie nicht auswerten. Für einen Kunden-Mandanten ist die Gratis-Stufe von Gemini grundsätzlich gesperrt, auch für öffentliche Repositories, weil Prompts Kundencode enthalten können. Erst ein bezahlter Tarif ohne Auswertung hebt das auf (`trainsOnData: false`). Das gehört in die Auftragsverarbeitung und in die Datenschutzerklärung.

### 6. Grenzen und Kosten je Mandant

- Tagesbudget, Schritte, Subrequests und GPU-Minuten werden je Mandant gezählt und begrenzt (`tenants.limits`). Heute zählt `spentToday` je Agent; es wird je Mandant und Agent geführt.
- Cloudflare Workers Free reicht für einen Owner, nicht für Mandanten: 50 externe Subrequests pro Aufruf und die tägliche Anfragegrenze würden bald stören. Ab Stufe 2 läuft die API auf **Workers Paid**. Aufgaben wandern in eine **Queue** mit eigenem Consumer, damit ein langer Lauf keinen anderen blockiert.
- Modal-GPUs sind geteilt. Ihre Kosten fließen in den Tarif ein; ein Mandant ohne Guthaben erhält nur Workers AI.
- Abrechnung (z. B. Stripe, Tarife, Testzeitraum) ist ein eigenes ADR, sobald es Kunden gibt.

### 7. Webhooks werden zur Infrastruktur

Der Empfänger `POST /webhooks/github` prüft die Signatur (HMAC-SHA256, `x-hub-signature-256`, zeitkonstant), verwirft Wiederholungen über `x-github-delivery` und legt die Arbeit auf eine Queue. Für mehrere Umgebungen gibt es je Stufe eine eigene App (Dev, Produktion), weil eine App nur eine Webhook-URL hat.

## Stufenplan

| Stufe | Inhalt | Ergebnis |
| --- | --- | --- |
| 0 (heute) | Ein Owner, GitHub App, Token als Rückfall, Registrierung, Freigaben | Betriebsbereit |
| 1 | Tabelle `tenants`, `tenant_id` überall, Owner als erster Mandant, mandantenbewusste Abfragen und Namensräume | Keine sichtbare Änderung; Grundlage |
| 2 | Verbinden-Fluss, Installationszuordnung, Webhook-Empfänger, Queue, Workers Paid | Ein zweiter, getesteter Mandant (z. B. Testkonto) |
| 3 | Kundenanmeldung und Rollen, signierte Zugangs-Tokens, Grenzen je Mandant | Geschlossene Beta |
| 4 | Abrechnung, Marketplace, Rechtstexte, Betrieb (Alarme, Backups) | Öffentliches Angebot |

Jede Stufe ist einzeln auslieferbar und bricht die vorige nicht.

## Umsetzung Stufe 1 (Stand 2026-11-26)

Gebaut ist die Grundlage; für den Owner ändert sich nichts Sichtbares.

- Migration `0011_tenants.sql`: Tabellen `tenants` (mit dem Mandanten `owner`) und `tenant_installations` (noch leer) sowie `tenant_id` in `projects`, `threads`, `tasks`, `task_reviews`, `approvals`, `events`, `memories`. Alle bestehenden Zeilen gehören über den Spaltenstandard dem Owner.
- `Caller.tenantId` (heute immer `owner`), `ToolContext.tenantId`, `ChatInput.tenantId`, `RunState.tenantId`. Bei Ereignissen ist `tenantId` ein Pflichtfeld, damit ein vergessenes Feld beim Kompilieren auffällt und nicht still beim Owner landet.
- Alle Abfragen auf Mandantentabellen filtern oder schreiben `tenant_id`: Projekte (Liste, Registrieren, Entfernen, Schreibregel im Werkzeug), Threads, Aufgaben, Freigaben, Ereignisse, Notizen, Tagesausgaben je Mandant und Agent.
- Namensräume: Der Owner behält `thread:<id>`, `main` für Hub und Büro, damit vorhandene Threads und ihr Verlauf erreichbar bleiben. Andere Mandanten bekommen `t:<id>:…`.
- Wächter: `tests/api-tenancy.test.ts` liest alle SQL-Zeichenketten der API und verlangt in jeder Anweisung auf einer Mandantentabelle `tenant_id` oder die Kennzeichnung `/* tenant:parent */` (nur über eine schon mandantengeprüfte Elternzeile) bzw. `/* tenant:platform */` (bewusst mandantenübergreifend). Eine neue Abfrage ohne eines von beidem lässt den Test scheitern.
- Tests mit zwei Mandanten (`tests/api-projects.test.ts`): gleiches Repository für zwei Mandanten, getrennte Listen, kein Entfernen über Mandantengrenzen, strengste Schreibregel für fremde Registrierungen.

Bewusst noch nicht mandantenfähig (Stufen 2 und 3):

- Das Personal (`agents`, Organisationskatalog, Tagesbudget je Agent) ist für alle Mandanten gemeinsam. Mandanteneigene Agentenzeilen und Budgets kommen mit den Grenzen je Mandant.
- Projekt-Ids sind global eindeutig (Primärschlüssel); bei Namenskollision bekommt die ID ein Suffix. Eine zusammengesetzte Eindeutigkeit folgt, wenn es zweite Mandanten gibt.
- Der Live-Hub und die Ticketausgabe laufen für den Owner auf `main`; ein Hub je Mandant mit signiertem Zugangs-Token kommt mit der Kundenanmeldung.
- `GITHUB_OWNERS` gilt noch global; die Ableitung aus `tenant_installations` folgt im Verbinden-Fluss.

## Alternativen

- **Eine Bereitstellung je Kunde:** einfache Trennung, aber Betriebs- und Updatekosten wachsen mit jedem Kunden; nicht als Produkt skalierbar. Bleibt eine Option für große Einzelkunden.
- **D1-Datenbank je Mandant:** starke Trennung, aber Verwaltung hunderter Datenbanken und Migrationen je Mandant. Erst bei Bedarf prüfen; `tenant_id` mit Namensräumen reicht zunächst.
- **OAuth-App mit Nutzer-Token statt GitHub App:** Das Token hängt am Menschen, deckt Organisationen schlecht ab und ist breiter berechtigt. Die GitHub App ist das für diesen Zweck vorgesehene Modell.
- **GitHub-MCP-Server direkt:** umgeht Freigaben und die Sperre für auswertende Modelle (siehe ADR 0031).

## Risiken

- Ein vergessener `tenant_id`-Filter wäre ein Datenleck. Dagegen: Namensräume, eine einzige Zugriffsschicht pro Tabelle, Tests mit zwei Mandanten, die jede Route gegen Kreuzzugriff prüfen.
- Kundencode in Prompts: Auftragsverarbeitung, Löschkonzept, Aufbewahrungsfristen, klare Aussage, welche Anbieter Daten sehen.
- Missbrauch (Kosten, Spam-Repositories): Grenzen je Mandant, Sperre bei Auffälligkeit, Freigabepflicht für alles, was schreibt.

## Offene Fragen an den Owner

1. Zielgruppe der Beta: einzelne Entwickler, kleine Teams, Agenturen? Davon hängen Rollen und Organisations-Konten ab.
2. Anmeldung der Kunden: eigenes Konto, nur „Mit GitHub anmelden“, oder beides?
3. Dürfen Kundendaten jemals an auswertende Anbieter gehen? Der Vorschlag lautet nein.
4. Erste Stufe, die gebaut wird: 1 (Grundlage ohne sichtbare Änderung) oder direkt ein Prototyp des Verbinden-Flusses auf dem Owner-Mandanten?

## Rückprüfung

Neu bewerten, wenn die Stufe 2 live geht, wenn die GitHub-App-Limits sich ändern oder wenn ein zweiter Git-Anbieter (GitLab, Bitbucket) unterstützt werden soll.
