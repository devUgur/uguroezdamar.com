# ADR 0029: Projekte als Repository-Freigabe und Schutz privater Inhalte

- Status: accepted
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0024](0024-agent-platform-on-cloudflare.md), [ADR 0027](0027-agent-organization-catalog.md)

## Kontext

Die Agenten sollen nicht nur dieses Repository bearbeiten, sondern auch weitere Repositories des Owners. Das GitHub-Konto des Owners hat 22 eigene Repositories (viele privat) und gehört zu zwei Organisationen mit weiteren privaten Repositories, darunter eigene Produkte mit getrennten Konten und Geheimnissen.

Zwei Risiken wachsen mit dem Zugriff:

1. Ein breiter Token macht jedes sichtbare Repository für einen Agenten erreichbar, auch wenn er dort nie arbeiten soll.
2. Liest ein Agent ein privates Repository, geht dessen Code an das Sprachmodell. Die Gratis-Version von Gemini darf Anfragen auswerten (ADR 0024). Privater Code oder Kundencode würde so an einen Anbieter gehen, der ihn verwenden darf.

Ein feingranularer GitHub-Token hat genau einen Besitzer, also das Konto oder eine einzelne Organisation. Ein Token für alles ist daher nicht möglich.

## Entscheidung

1. **Registrieren statt freigeben.** Ein Projekt (`projects`) ist ein Repository, an dem Agenten arbeiten dürfen. Nur registrierte, aktive Projekte sind les- und schreibbar. Der Token darf mehr sehen als das; die Registrierung entscheidet. Der Owner wählt im Portal (`/projects`) aus den Repositories des Kontos.
2. **Besitzer-Freigabe.** Die Variable `GITHUB_OWNERS` (derzeit `devUgur`) nennt die GitHub-Konten, deren Repositories Projekte werden können. Organisationen bleiben ausgeschlossen, bis sie einzeln entschieden werden (ein eigener Token je Organisation oder eine GitHub App). Die API prüft das selbst und vertraut dem Portal nicht.
3. **Sichtbarkeit und Standardbranch kommen von GitHub**, nie vom Aufrufer. Archivierte Repositories lassen sich nicht registrieren.
4. **Schreibregel je Projekt** (`write_mode`):
   - `dev-first`: Commits auf `dev`, Release per Pull Request `dev` → Standardbranch. Gilt für dieses Repository.
   - `pr-only` (Standard für jedes neue Projekt): nur Branches `agent/…`, Änderungen per Pull Request in den Standardbranch. Nie direkt auf den Standardbranch.

   Ein Repository ohne registriertes Projekt bekommt die strengste Regel. Commits und Pull Requests bleiben freigabepflichtig.
5. **Private Repositories nur mit Modellen ohne Datenauswertung.** Jeder Modellanbieter trägt `trainsOnData`; fehlt die Angabe, gilt „wertet aus“. Bei `visibility = private` filtert der Router solche Anbieter aus, auch bei einem im Thread fest gewählten Modell. Bleibt keiner übrig, schlägt der Lauf mit einer klaren Meldung fehl, statt zu einem auswertenden Anbieter zu wechseln. Aktuell erlaubt sind Workers AI und Modal; Gemini (Gratis-Stufe) und OpenRouter sind gesperrt.
6. **Projekt entfernen** archiviert die Zeile. Threads und Aufgaben behalten ihren Verlauf; ein Lauf in einem entfernten Projekt endet mit einer Meldung. Das Hauptprojekt lässt sich nicht entfernen.
7. **Token.** Ein feingranularer Token (Besitzer: das eigene Konto, Zugriff auf alle Repositories, Rechte nur Contents und Pull requests lesen und schreiben sowie Checks lesen). Kein `Workflows`, kein `Administration`. Der Token der lokalen `gh`-Anmeldung wird nie verwendet.

## Alternativen

- **Alle sichtbaren Repositories automatisch freigeben:** verworfen. Ein kompromittierter Prompt oder Fehler träfe jedes Repository, auch fremde Produkte.
- **Einen Token je Repository:** verworfen, zu viele Secrets. Die Registrierung im Backend leistet dasselbe feiner.
- **Organisationen sofort einbeziehen:** zurückgestellt. Sie brauchen eigene Tokens und eine Entscheidung zur Trennung der Produkte.
- **Repositories vom Agenten anlegen lassen:** zurückgestellt. Das braucht vermutlich `Administration: Read and write`, das auch Einstellungen und Löschen umfasst. Erst wenn das Recht geprüft ist und eine eigene Freigabe-Stufe feststeht.

## Konsequenzen

- Migration `0009_project_repositories.sql` ergänzt `visibility`, `default_branch` und `write_mode`; das Hauptprojekt wird `public` und `dev-first`.
- Ein Thread arbeitet im Repository seines Projekts; im Chat lässt sich das Projekt wechseln, solange der Agent nicht läuft. Sieht oder liest der Agent private Repository-Inhalte (Namen aus `github_repositories_list`, Dateien in einem privaten Projekt), wird der Thread dauerhaft „privat“ (`markPrivate`, im Durable Object gespeichert): danach antworten nur Modelle ohne Datenauswertung, ohne Fallback auf einen auswertenden Anbieter. Der Owner muss dafür nichts einstellen; die Schritte vor dem ersten Zugriff enthalten keine privaten Inhalte.
- Ein Thread arbeitet im Repository seines Projekts. Der Chat-Start in `/projects` legt ihn mit dem Projekt an.
- Die Datenschutzregel ist durch Tests abgesichert, darunter ein Fall, der beim Aushebeln der Filterung scheitert (`tests/api-projects.test.ts`).
- Das Anlegen von Repositories, die Organisationen sind offen.

## Rückprüfung

Neu entscheiden, wenn Organisations-Repositories einbezogen werden, wenn Gemini auf eine bezahlte Stufe ohne Auswertung wechselt (dann `trainsOnData: false`), oder wenn Agenten Repositories anlegen sollen.
