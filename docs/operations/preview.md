# Preview-Umgebung

**Zweck:** Site und Portal als serverseitige Next.js-Dienste bei Render ausprobieren, bevor die Produktion umgestellt wird. Die Preview nutzt die Stage `dev` (Neon-Branch `dev`, Infisical-Umgebung `dev`) und berührt keinen Produktionsdienst.

**Stand 13.10.2026:** Im Repository vorbereitet, bei Render noch nicht angelegt. Lokal geprüft: Produktionsbuild beider Apps mit den `dev`-Secrets gestartet, `pnpm ugur smoke` gegen beide bestanden (17 Prüfungen). Die zwei Prüfungen zur Client-Adresse laufen nur gegen einen Dienst hinter dem Hosting-Proxy und sind deshalb offen.

## Aufbau

| Baustein | Ort |
| --- | --- |
| Blueprint nur für die Preview | [`render.preview.yaml`](../../render.preview.yaml): zwei Web-Dienste, Branch `dev`, Plan `free`, Region Frankfurt |
| Health-Endpunkt | `/api/health` in beiden Apps: Commit, Datenbank, in der Site zusätzlich die erkannte Client-Adresse |
| Prüfung über HTTP | `pnpm ugur smoke --site <url> --portal <url> [--commit <sha>]` |
| Auslöser | Ein Push auf `dev`; Render liefert aus, sobald die CI für diesen Commit grün ist |

`render.preview.yaml` ist bewusst getrennt von [`render.yaml`](../../render.yaml): Ein Blueprint-Sync legt an und ändert, was in der Datei steht. In der Preview-Datei steht kein Produktionsdienst.

## Einmalig einrichten

1. **Branch `dev` anlegen.** Er zeigt auf den Stand, der in die Preview soll, zum Beispiel:

   ```bash
   git push origin chore/preview-environment:dev
   ```

2. **Blueprint anlegen.** Im Render-Dashboard *New → Blueprint*, dieses Repository wählen und als Blueprint-Pfad `render.preview.yaml` eintragen. Render fragt die Werte mit `sync: false` einmal ab:

   | Dienst | Variable | Wert |
   | --- | --- | --- |
   | beide | `DATABASE_URL` | gepoolte Verbindung des Neon-Branches `dev` (aus Infisical `dev`) |
   | Site | `NEXT_PUBLIC_SITE_URL` | Adresse des Site-Dienstes, z. B. `https://uguroezdamar-preview.onrender.com` |
   | Site | `CONTACT_RATE_LIMIT_SECRET` | aus Infisical `dev` |
   | Portal | `APP_URL` | Adresse des Portal-Dienstes |
   | Portal | `SITE_URL` | Adresse des Site-Dienstes |
   | Portal | `ADMIN_API_KEY` | aus Infisical `dev` |

   Ist ein Dienstname schon vergeben, hängt Render ein Suffix an die Adresse. Dann zuerst die tatsächlichen Adressen ablesen und die drei Adressvariablen danach setzen; `NEXT_PUBLIC_SITE_URL` wirkt erst nach einem neuen Build.

3. **Adressen in Infisical hinterlegen**, damit Infisical die Quelle bleibt:

   ```bash
   pnpm ugur secrets set NEXT_PUBLIC_SITE_URL --stage dev
   pnpm ugur secrets set SITE_URL --stage dev
   pnpm ugur secrets set APP_URL --stage dev
   pnpm ugur secrets audit --stage dev
   ```

   Lokale Läufe sind davon nicht betroffen: `pnpm dev` ersetzt die drei Adressen durch `localhost`.

4. **Secret Sync (empfohlen).** In Infisical je Dienst einen *Secret Sync* von der Umgebung `dev` zum Render-Dienst anlegen. Danach werden Werte nicht mehr im Render-Dashboard gepflegt. `sync: false` in der Blueprint-Datei ist kein solcher Sync: Es hält nur den Wert aus der Datei heraus.

5. **Prüfen:**

   ```bash
   pnpm ugur smoke --site https://<site>.onrender.com --portal https://<portal>.onrender.com --commit <sha>
   ```

## Was der Smoke-Lauf belegt

- Beide Dienste antworten und melden den erwarteten Commit (`RENDER_GIT_COMMIT`).
- Beide erreichen die Datenbank.
- Die Site sieht eine Client-Adresse, und ein selbst gesetzter Header `cf-connecting-ip` wird nicht übernommen. Davon hängt das Rate-Limit des Kontaktformulars ab; schlägt eine der beiden Prüfungen fehl, darf die Produktion nicht umgestellt werden.
- Startseite, Projektkatalog, Weiterleitung von `/work` und Sitemap funktionieren.
- Der Kontakt-Endpunkt lehnt falschen Content-Type, fremde Herkunft, ungültige Eingaben und ein gefülltes Honeypot-Feld ab.
- Das Portal zeigt die Login-Seite und verweigert anonymen Aufrufern die Admin-API.

Der Lauf speichert nichts. Nicht abgedeckt und von Hand zu prüfen: Login, Einladung annehmen, Rollen ändern und eine echte Kontaktanfrage bis in die Übersicht des Portals.

## Betrieb

- **Neuen Stand zeigen:** den gewünschten Commit nach `dev` pushen. Ein Push auf `dev` ist eine Veröffentlichung in die Preview, keine Freigabe für `main` oder die Produktion.
- **Kosten und Verhalten:** Dienste im Plan `free` schlafen ohne Aufrufe ein; der erste Aufruf danach dauert bis zu einer Minute. Der Smoke-Lauf wartet so lange.
- **Daten:** Die Preview schreibt in den Neon-Branch `dev`. Dort liegen nur Testdaten; keine echten Kontaktanfragen oder Konten.
- **Abbauen:** Blueprint und beide Dienste im Render-Dashboard löschen, Secret Syncs in Infisical entfernen. Der Branch `dev` kann bleiben.

## Lokal dasselbe prüfen

Ohne Render lässt sich der Produktionsbuild gegen die Stage `dev` starten:

```bash
pnpm ugur run -- pnpm build
pnpm ugur run -- pnpm --filter @ugur/site exec next start -p 3200
pnpm ugur run -- pnpm --filter @ugur/portal exec next start -p 3201
pnpm ugur smoke --site http://localhost:3200 --portal http://localhost:3201
```

Gegen `localhost` überspringt der Smoke-Lauf die Prüfungen zur Client-Adresse und zum Commit, weil es dort weder Proxy noch Deployment gibt.
