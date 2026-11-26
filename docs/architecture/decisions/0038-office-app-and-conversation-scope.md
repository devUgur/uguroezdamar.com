# ADR 0038: Office als eigene App, Gesprächsbereich Firma oder Projekt, kostenloser Prüfweg

- Status: accepted
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0024](0024-agent-platform-on-cloudflare.md), [ADR 0025](0025-synchronisierte-agentenpraesenz.md), [ADR 0036](0036-isolated-workstations-and-previews.md), [Plan](../../product/agent-company-plan.md) Stufe 4

## Kontext

- **Gespräche waren an ein Repository gebunden.** Jedes Gespräch hing an einem Projekt; ohne Angabe war es `uguroezdamar` mit dessen Repository. Wer mit dem Chef-Agenten über die Firma, Prioritäten oder ein neues Produkt sprechen wollte, arbeitete trotzdem „in“ einem Repository und wählte es im Chat-Kopf um.
- **Das Büro saß als Unterseite im Portal.** Die 3D-Ansicht teilte sich den Platz mit der Portal-Navigation.
- **Prüfen ging nur mit der Workstation.** Bauen und Testen lief allein über `sandbox_run` (Container, ADR 0036). Das braucht Workers Paid und ist noch nicht gebucht.

## Entscheidung

1. **Bereich eines Gesprächs:**
   - **Firma (Standard):** `threads.project_id` ist `NULL`, ohne Repository.
     - Agenten lesen dort nur mit ausdrücklichem `repo=owner/name`.
     - Werkzeuge mit `requiresProject` lehnt die Schleife ab, bevor eine Freigabe entsteht: Commit, Pull Request, Preview.
     - `knowledge_search` verweist auf die Projekte, weil das Wissen je Projekt indexiert ist.
   - **Projekt (innere Schicht):** wie bisher mit Repository, Wissen und Datenrichtlinie.
   - **API:** `POST /api/threads` ohne `projectId` legt ein Firmengespräch an. `PATCH` mit `projectId: null` wechselt zurück auf die Firma.
   - **Verbrauch:** Ereignisse und Verbrauchszeilen speichern die Firmenebene als `NULL`, nie als leere Zeichenkette.
2. **Das Office ist eine eigene Vollbild-App** unter `/office` im Portal-Projekt:
   - **Login:** derselbe wie im Portal, eine eigene Route-Gruppe `(office)` ohne Portal-Shell.
   - **Links:** die Navigation; zuerst der Bereich (Firma, dann jedes Projekt als `?project=`), darunter die Wege zurück ins Portal.
   - **Mitte:** das Büro im Vollbild.
   - **Rechts:** Widgets für den Bereich: Verbrauch heute, offene Freigaben, offene Aufgaben.
   - **Chat:** Ein Chat aus dem Office übernimmt den Bereich der Navigation. Im Chat gibt es dort keine Repository-Wahl mehr, nur eine Anzeige.
   - **Portal-Chat:** `/chat` behält die Wahl, mit „Ganze Firma“ als erster Option.
   - **Alte Links:** `/agents` leitet auf `/office` weiter.
3. **Subdomain `office.uguroezdamar.com`:**
   - Sie zeigt auf dasselbe Vercel-Projekt wie das Portal.
   - Der Proxy schreibt auf diesem Host nur `/` auf `/office` um; alle anderen Pfade sind das Portal.
   - Das Session-Cookie gilt je Host (`sameSite: strict`, ohne `Domain`). Auf der Subdomain meldet man sich deshalb einmal eigens an. Das ist bewusst so: ein Cookie für die ganze Domain würde auch die öffentliche Site erreichen.
4. **Prüfen ist austauschbar (`code_verify`):**
   - **Ein Werkzeug, zwei Wege:**
     - **Workstation**, wenn sie eingerichtet ist (`WORKSTATION`, ADR 0036).
     - **CI des Repositories (sonst):** nach dem Push liest das Werkzeug die Check-Runs des Commits. Es wartet bis zu dreimal 10 Sekunden und meldet `passed`, `failed`, `pending` oder `no_ci`.
   - **Bei Fehlern:** Das Werkzeug liefert das Ende des Job-Logs. Dafür braucht die GitHub App das Recht „Actions: Read“. Ohne dieses Recht liefert es Annotationen und Zusammenfassung des Checks („Checks: Read“). Zeitstempel und tokenartige Zeichenketten werden entfernt.
   - **Kosten:** Der CI-Weg ist für öffentliche Repositories frei und für private bis 2.000 Minuten im Monat.
   - **Agenten:** Chef und Reviewer kennen nur noch `code_verify`; `sandbox_run` bleibt als Werkzeug erhalten. Der Wechsel auf die Workstation ändert weder Prompt noch Werkzeugliste.

## Folgen

- **Firma als Standard:** Neue Gespräche aus dem Office beginnen auf Firmenebene. Wer Code ändern will, wählt links das Projekt. Das Gespräch des Agenten in diesem Bereich wird fortgesetzt oder neu angelegt.
- **Bestehende Gespräche** behalten ihr Projekt, weil die Spalte bei ihnen gesetzt ist.
- **Einrichtung der Subdomain (Owner, einmalig):**
  1. Im Vercel-Projekt des Portals die Domain `office.uguroezdamar.com` hinzufügen.
  2. In Cloudflare-DNS einen CNAME `office` auf das von Vercel genannte Ziel anlegen, „DNS only“.
- **Volle CI-Logs** brauchen in der GitHub App das Recht „Actions: Read“. Ohne dieses Recht bleibt `code_verify` nutzbar, nur mit weniger Detail.
