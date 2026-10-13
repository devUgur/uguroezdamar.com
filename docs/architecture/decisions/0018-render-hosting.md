# ADR 0018: Render als Hosting für Site und Portal

- Status: accepted (vorläufig, bis das Hosting-Inventar abgeschlossen ist)
- Datum: 2026-10-13
- Beteiligte: Projektverantwortliche
- Ersetzt: die frühere Hosting-Angabe aus [ADR 0013](0013-cms-content-and-server-rendering.md) und den R1-Dokumenten, die Netlify als kanonisches Ziel nannte.

## Kontext

Die Dokumentation nannte Netlify als kanonisches Ziel und Render als Alternative. Tatsächlich laufen beide Domains bei Render hinter Cloudflare (Antwort-Header `rndr-id` und `x-render-origin-server`, CNAME des Portals auf `portal-uguroezdamar-com.onrender.com`). Für Netlify gab es nur zwei Konfigurationsdateien, keinen Deploy-Nachweis und keine Checks an Pull Requests. Zwei beschriebene Ziele, von denen nur eines existiert, sind keine Quelle der Wahrheit.

## Entscheidung

1. Site und Portal bleiben bei Render, jeweils als Node-Web-Dienst.
2. [`render.yaml`](../../../render.yaml) ist die Zielkonfiguration und wird nach dem Abgleich mit dem Dashboard zur verbindlichen Deployment-Quelle.
3. Auto-Deploy soll aus sein (`autoDeployTrigger: off`); ausgeliefert wird ein freigegebener Commit aus `main`. Die Datei beschreibt das Ziel. Ob der bestehende Dienst so eingestellt ist, zeigt nur das Dashboard.
4. Laufzeitvariablen sollen per Secret Sync aus Infisical (`prod`) kommen, nicht durch Eintippen im Dashboard. Der Sync ist eine eigene Integration, die in Infisical eingerichtet wird. `sync: false` in `render.yaml` stellt ihn nicht her: Es heißt nur, dass der Wert nicht in der Datei steht. Render fragt ihn bei der ersten Blueprint-Einrichtung ab und ignoriert solche Einträge bei späteren Aktualisierungen und in Preview-Umgebungen.
5. Die Netlify-Konfigurationsdateien wurden entfernt.

## Alternativen

- **Wechsel zu Netlify:** hätte eine neue Einrichtung beider Dienste, der Domains und der Secrets bedeutet, ohne dass heute ein Vorteil belegt ist. Abgelehnt; bei Bedarf als eigene Entscheidung neu zu bewerten.
- **Beide Konfigurationen behalten:** hält den Widerspruch am Leben. Abgelehnt.

## Konsequenzen

- Die Site muss bei Render von einer statischen Seite auf einen Node-Dienst umgestellt werden, bevor der aktuelle Code ausgeliefert wird.
- Der Kontakt-Endpunkt wertet derzeit `x-nf-client-connection-ip` und `x-real-ip` aus; die Client-Adresse hinter Render und Cloudflare ist zu verifizieren und der Handler bei Bedarf anzupassen.
- `main` ist seit dem 13.10.2026 durch ein Ruleset geschützt (nur Pull Requests, Pflicht-Check `validate`, kein Force-Push, keine Löschung). Code veröffentlichen, einen Pull Request mergen und Produktion ausliefern sind drei getrennte Entscheidungen.
- Offen: Hosting-Inventar (Dienstnamen, Typ, Deploy-Branch, PR-Previews), Preview-Dienst, Rollback-Weg bei Render.
