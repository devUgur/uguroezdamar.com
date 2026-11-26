# Office Brain – Sicherheit, Daten und Kosten

- Status: Planung
- Dieses Dokument erweitert noch keine verbindlichen Security- oder Operations-Regeln. Anforderungen werden vor der ersten Implementierung als ADR/Änderung an die geltenden Richtlinien übernommen.

## Berechtigungsmodell

- Jeder menschliche Zugriff bleibt an die bestehende Admin-Session und serverseitige Portal-Rolle gebunden.
- Ein Agent erhält einen eigenen technischen Ausführungskontext, aber keine Admin-Session und keine pauschalen Zugangsdaten.
- Werkzeuge sind serverseitig registriert und erlauben nur benannte Operationen. Versteckte UI-Schaltflächen sind keine Rechteprüfung.
- Der QA-Reviewer besitzt nur Repo-/PR-/CI-Lesewerkzeuge. Seine Allowlist enthält weder Commit, PR-Erstellung, Memory-Schreibzugriff noch Statusänderungen.
- QA startet nur über `POST /api/tasks/:id/review`; `qa` kann nicht per Task-PATCH gesetzt werden. Ungültiges oder fehlendes Prüfergebnis wird `needs_human`; ausschließlich eine menschliche Owner-Aktion setzt `done`.
- Jeder Tool-Aufruf prüft Rolle, Ressource, Scope, Status, Limits und Freigabepflicht.
- Lesen, Entwurf und Ausführen sind getrennte Berechtigungsstufen.
- Menschen geben Aktionen mit Außenwirkung ausdrücklich frei. Freigabe wird an konkrete, unveränderliche Tool-Argumente und einen Run gebunden; eine spätere Änderung erfordert eine neue Freigabe.
- Agenten können keine Rollen, eigenen Modell-/Budgetlimits, Tool-Allowlist oder Freigaberegeln ändern.

## Datenklassen und Provenienz

Vor dem Import wird festgelegt, was in die Bibliothek darf. Für jede Wissensquelle werden mindestens Quelle, Owner, Inhaltsscope, Datenklasse, Version, Importstatus, Prüfer und Lösch-/Aufbewahrungsregel mitgeführt.

- Öffentliche Portfolioinhalte können aus dem bereits versionierten Git-/MDX-Stand referenziert werden.
- Interne Arbeitsnotizen und private Dokumente bleiben privat und erhalten ihren eigenen Scope.
- Zugangsdaten, Passwörter, Session-Tokens und Provider-Secrets gehören nie in Prompts, Logs oder Wissenschunks.
- Personenbezogene Kunden-/Kontaktinhalte werden nicht standardmäßig in Modellkontext oder Langzeitwissen übernommen.
- Modellantworten ohne Quellenbeleg gelten als Vorschlag, nicht als geprüfter Fakt.
- Für Quelltexte, Tool-Argumente und Outputs gilt eine explizite Aufbewahrungsdauer. Rohantworten und vollständige Promptmitschnitte sind nicht automatisch erforderlich.

## Agenten- und Toolgrenzen

Jeder Run erhält konfigurierbare Höchstwerte für Modellschritte, Tool-Aufrufe, Zeit, Input-/Output-Tokens und geschätzte Kosten. Ein fehlendes oder überschrittenes Limit beendet den Run kontrolliert. Wiederholungen sind begrenzt und müssen idempotente Seiteneffekte oder deduplizierbare Schlüssel verwenden.

Ein Run speichert mindestens Agent-/Prompt-/Toolversion, Provider und Modell-ID, Start-/Endstatus, Tokenmesswerte, Tool-Ergebnisse in angemessen redigierter Form, Freigaben, Quellen und Fehlerklasse. Chain-of-thought wird nicht als Audit- oder Wissensdatensatz gespeichert.

## Ausgaben begrenzen

- Modellproviderkosten werden je Run und Zeitraum erfasst; Modellpreise werden als veränderliche Konfiguration mit Prüfdatum behandelt.
- Vor jeder neuen Providerbindung wird ein monatliches Maximalbudget festgelegt.
- Günstiges Profil ist Standard; teurere Profile brauchen ein fachliches Qualitätsargument und kontrollierte Eskalation.
- Kontext wird durch relevante, zitierte Abschnitte begrenzt statt ganze Bibliotheken an jeden Run zu senden.
- Agenten-Fan-out ist zunächst aus. Jeder zusätzliche Agent muss einen belegten Nutzen gegenüber einem sequenziellen Lauf zeigen.
- Retrieval startet ohne Embedding-Ausgaben mit PostgreSQL-Volltext. Embedding-Erzeugung und Re-Indexierung dürfen nicht unbemerkt alle Dokumente neu berechnen.
- Betriebsmetriken umfassen Kosten/Run, Erfolgsrate, menschliche Eingriffe, Laufzeit und Kosten je akzeptiertem Ergebnis.

## Betrieb und Wiederanlauf

Für Agenten-Work-Items und -Events ist D1 im API-Control-Plane maßgeblich (ADR 0026); bestehende Portal-Domänen bleiben in Neon. Laufzeitprozesse sind ersetzbar und dürfen keinen ungesicherten Zustand nur im Arbeitsspeicher halten. Zustandswechsel sind atomar; Hintergrundarbeit arbeitet mit Idempotenzschlüsseln und begrenzten Retries. Geplante Worker-Plattformen schreiben über einen kontrollierten API-Adapter, nicht durch direkte Umgehung der Use Cases.

Vor produktiven Agentenaktionen sind mindestens erforderlich:

- getestete Wiederherstellung der zugrunde liegenden Daten;
- nachvollziehbarer Abbruch und Wiederaufnahme eines Runs;
- Auditierung von menschlicher Freigabe und tatsächlicher Aktion;
- Budget-/Tool-Limits und Fehleralarme;
- dokumentierte Datenlöschung und Zugriffsprüfung.

## Kostenmodell, zunächst ohne Zahlenversprechen

Größte variable Ausgaben sind voraussichtlich Modellaufrufe und erzeugte Embeddings. Infrastrukturkosten hängen von den vorhandenen Vercel-/Neon-Tarifen, Speichernutzung, Laufzeit und Limits ab. Konkrete Preiszahlen würden schnell veralten; eine POC-Messung soll folgende Werte erfassen:

| Messwert | Wozu |
| --- | --- |
| Modellkosten pro Run und Modellprofil | Budget und Auswahl |
| Eingabe-/Ausgabetokens pro akzeptiertem Ergebnis | Kontext und Agentenloop optimieren |
| Anzahl Tool-Aufrufe und Retries | Fehlerschleifen begrenzen |
| Run-Dauer und Anteil Wiederaufnahmen | Runner-Entscheidung |
| Speicher-/Suchvolumen | Entscheidung über Blob- oder Suchdienste |
| Anteil Ergebnisse mit menschlicher Nacharbeit | tatsächlicher Nutzen statt Demo-Eindruck |
