# ADR 0028: Unabhängige QA-Übergabe für Agentenaufgaben

- Status: accepted
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0026](0026-agent-work-management.md), [ADR 0027](0027-agent-organization-catalog.md)

## Kontext

Ein erfolgreicher Coding-Lauf wechselt eine Aufgabe nach `review`. Ein unabhängiger Prüfschritt braucht einen anderen Runtime-Akteur, lesbaren Code-/PR-Diff, CI-Nachweise und einen auditierbaren Rücklauf. Eine Rolle im Katalog allein darf keinen Schreibzugriff oder automatischen Abschluss erzeugen.

## Entscheidung

1. Der `reviewer` ist eine ausführbare, registrierte Agenteninstanz mit eigenem Thread und Tagesbudget. Seine Allowlist enthält ausschließlich Repo-Lese-, PR-Lese- und CI-Lese-Werkzeuge; Commit, PR-Erstellung, Memory-Schreibzugriff und Approvals fehlen.
2. QA startet ausschließlich über `POST /api/tasks/:id/review` für einen Task in `review`. Ein compare-and-swap setzt ihn nach `qa`, legt eine `task_reviews`-Historie an und verbindet Review, Thread, Task und Reviewer.
3. Der Reviewer liest den konkreten PR samt begrenztem Diff und dessen Check-Run. Diffs sind auf 20 Dateien und 30.000 Zeichen begrenzt. Trunkierung, fehlende Checks, fehlende Kriterien oder fehlender PR liefern `needs_human`, niemals ein implizites Bestehen.
4. Das Modell liefert ein JSON-Prüfergebnis (`pass`, `changes_requested`, `needs_human`). Ungültige Ausgaben werden fail-closed als `needs_human` gespeichert. Zusätzlich erzwingt der Server für `pass` vorhandene Abnahmekriterien, nicht abgeschnittene PR-Dateien/Diffs sowie erfolgreich abgeschlossene Check-Runs aus den protokollierten Tool-Ergebnissen. Findings, Evidence, Rohantwort und Status bleiben als Auditdatensatz erhalten.
5. `changes_requested` führt zurück nach `in_progress`; `pass` und `needs_human` bleiben in `qa`. Fehler/Abbruch blockieren die Aufgabe. Kein Reviewer schließt selbst eine Aufgabe ab.
6. `Done` benötigt eine menschliche Portalaktion und eine Abschlussnotiz (20–2.000 Zeichen). Ohne aktuelles QA-`pass` ist die Notiz die dokumentierte manuelle Abnahme. Jeder Statusübergang zu `qa` außerhalb der Reviewer-Route wird abgewiesen.
7. Task- und Review-Events laufen weiter über den bestehenden LiveHub; keine neue Queue oder Durable Object-Klasse wird eingeführt.

## Alternativen

- Derselbe Chef-Agent prüft seine Änderungen: verworfen, da Rollen- und Tool-Grenzen keine unabhängige Prüfung gewährleisten.
- QA darf `Done` selbst setzen: verworfen, da Modellurteil und Owner-Abnahme getrennte Entscheidungen sind.
- Freie JSON-Antwort ungeprüft als bestanden werten: verworfen; Parser und serverseitige Evidenzprüfung sind fail-closed und Statusübergang ist serverseitig beschränkt.
- CI/QA direkt im HTTP-Request synchron ausführen: verworfen; der vorhandene Thread-Durable-Object führt den begrenzten Lauf asynchron in Etappen aus.

## Konsequenzen

- Migration `0008_task_reviews.sql` legt die Review-Historie an und registriert den QA-Reviewer.
- Das Board zeigt Prüfergebnis, Findings, Evidence und QA-Thread; Reviewer-Arbeit erscheint als echte Office-Präsenz.
- Reviews setzen einen konkreten Pull Request und zugängliche Check-Runs voraus. Direkte Branch-Änderungen ohne PR können nicht automatisch als bestanden bewertet werden.
- Der verfügbare Modellprovider und das Tagesbudget begrenzen auch Reviewer-Läufe; QA wird nicht automatisch gestartet.
- Workstation-Isolation, automatische QA-Retry-Regeln und unabhängige Modell-Providerwahl bleiben spätere Entscheidungen.

## Rückprüfung

Neu entscheiden, wenn mehrere QA-Profile, ein formal definierter Artefakt-/Branch-Vertrag oder eine notwendige Workstation-Isolation eingeführt werden.
