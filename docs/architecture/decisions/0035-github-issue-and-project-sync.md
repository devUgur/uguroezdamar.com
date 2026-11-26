# ADR 0035: GitHub-Issues und Projects V2

- Status: accepted for Issue sync; Projects V2 is gated
- Datum: 2026-11-26
- Ergänzt: ADR 0026, ADR 0031 und ADR 0032

## Entscheidung

1. D1 bleibt führend für Aufgabenstatus, Zuweisung, QA und Owner-Abnahme. Eine Aufgabe kann owner-gestützt mit genau einem GitHub-Issue des zugehörigen Repository-Projekts verknüpft werden.
2. Titel, Beschreibung und Abnahmekriterien werden beim manuellen Sync aus D1 in das Issue geschrieben. Nach dem Verknüpfen spiegeln signierte GitHub-Issues-Webhooks neuere Titel-/Body-Änderungen zurück nach D1. GitHub darf weder QA überspringen noch eine Aufgabe auf Done setzen.
3. D1 speichert Issue-Nummer, URL, Open/Closed-Zustand und letzten GitHub-Zeitstempel. Doppelte Webhook-Deliveries sind bereits auf KV-Ebene dedupliziert; ältere Issue-Zeitstempel werden ignoriert.
4. Schreibzugriff ist nur über die owner-geschützte Portalaktion mit github:write möglich. Die API nutzt den bestehenden kurzlebigen Installationstoken. GitHub App benötigt Issues: Read and write und das Webhook-Event Issues.
5. Projects V2-Synchronisierung ist noch nicht aktiviert. Queries benötigen read:project; Mutationen benötigen project. Ein App-Token benötigt dafür entsprechende GitHub-App-Projects-Berechtigungen; das einzelne CLI-Konto mit fehlendem Scope reicht nicht als Serverzugang. Vor Aktivierung sind Projekt-ID, Feldzuordnung, Statuskonflikte und Owner-Konto festzulegen. GitHub Projects V2 Webhooks befinden sich laut aktueller Dokumentation in Public Preview.

## Grenzen

- Ein geschlossenes GitHub-Issue bleibt im D1-Aufgabenfluss sichtbar; es erledigt die Agentenaufgabe nicht.
- Konfliktregel für gemischte lokale Bearbeitung: D1 überschreibt GitHub beim manuellen Push; eine neuere GitHub-Webhook-Änderung überschreibt den D1-Text. Die UI zeigt den letzten GitHub-Zustand und Owner kann erneut D1 → GitHub spiegeln.
- Vor Dev-Abnahme muss die GitHub App tatsächlich aktualisiert und für das Repository erneut autorisiert werden. Production bleibt bis zur separaten Freigabe unverändert.
