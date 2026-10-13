# Hosting, Preview und Release

**Zweck:** Wie Site und Portal bei Vercel eingerichtet werden, wie ein Stand vor dem Merge als Vorschau geprüft wird und wie er in die Produktion kommt. Entscheidung: [ADR 0020](../architecture/decisions/0020-vercel-hosting.md).

**Stand 13.10.2026:** Im Repository vorbereitet, bei Vercel noch nichts angelegt. Lokal geprüft: Produktionsbuild beider Apps mit den `dev`-Secrets gestartet, `pnpm ugur smoke` gegen beide bestanden. Die Prüfungen zur Client-Adresse und zum ausgelieferten Commit laufen nur gegen ein Deployment und sind offen.

## Aufbau

| Baustein | Ort |
| --- | --- |
| Zwei Vercel-Projekte aus einem Repository | Root Directory `apps/site` bzw. `apps/portal`; `vercel.json` je App legt die Region `fra1` fest (nahe am Neon-Projekt) |
| Vorschau | Vercel baut jeden Branch und jeden Pull Request als Preview mit eigener Adresse |
| Produktion | `main`; ein Build geht erst nach manueller Freigabe live |
| Secrets | Infisical: `prod` → Umgebung Production, `dev` → Umgebung Preview |
| Health-Endpunkt | `/api/health` in beiden Apps: Commit, Datenbank, in der Site zusätzlich die erkannte Client-Adresse |
| Prüfung über HTTP | `pnpm ugur smoke --site <url> --portal <url> [--commit <sha>]` |
| DNS | bleibt bei Cloudflare, nur als DNS (ohne Proxy) |

## Der Weg eines Standes

1. **Pull Request öffnen.** GitHub Actions prüft den Code (`validate`). Vercel baut für beide Projekte eine Vorschau gegen die Stage `dev` und schreibt die Adressen in den Pull Request.
2. **Vorschau prüfen:** `pnpm ugur smoke` gegen die beiden Vorschau-Adressen, dazu von Hand, was der Lauf nicht abdeckt.
3. **Mergen.** Das Ruleset von `main` verlangt einen Pull Request und den grünen Check.
4. **Freigeben.** Vercel baut `main` als Produktions-Deployment, weist ihm die Domain aber nicht zu. Es steht als *Staged* in der Liste, bis du es im Dashboard über *Promote* live schaltest. Das braucht keinen neuen Build.
5. **Zurück:** *Instant Rollback* im Dashboard setzt die Domain auf das vorherige Deployment.

Veröffentlichen, Mergen und Ausliefern bleiben drei getrennte Entscheidungen.

## Einmalig einrichten

1. **Projekte anlegen.** In Vercel *Add New → Project*, dieses Repository importieren, einmal mit Root Directory `apps/site`, einmal mit `apps/portal`. Framework wird als Next.js erkannt; Build- und Installationsbefehl bleiben auf dem Standard. Unter *Settings → Build and Deployment* prüfen, dass Node.js 24.x gewählt ist.

2. **Produktion nicht automatisch live schalten.** Je Projekt unter *Settings → Environments → Production → Branch Tracking* den Schalter **Auto-assign Custom Production Domains** ausschalten.

3. **Secrets verbinden.** In Infisical je Projekt zwei *Secret Syncs* zu Vercel anlegen: Umgebung `prod` → Production, Umgebung `dev` → Preview. Welche Variablen eine App liest, steht in `tooling/cli/src/secrets-manifest.ts`. Die Adressvariablen (`NEXT_PUBLIC_SITE_URL`, `SITE_URL`, `APP_URL`) gibt es nur in `prod`; eine Vorschau nimmt ihre Adresse aus `VERCEL_URL`.

4. **Vorschau-Schutz für den Smoke-Lauf öffnen.** Vorschauen sind standardmäßig nur für angemeldete Vercel-Nutzer erreichbar; das soll so bleiben. Je Projekt unter *Settings → Deployment Protection → Protection Bypass for Automation* ein Secret erzeugen und in Infisical ablegen:

   ```bash
   pnpm ugur secrets set VERCEL_BYPASS_SITE --stage dev
   pnpm ugur secrets set VERCEL_BYPASS_PORTAL --stage dev
   ```

   Der Smoke-Lauf liest beide im Speicher aus Infisical und sendet sie als Header; sie erscheinen in keinem Befehl.

5. **Erste Vorschau prüfen.** Einen Pull Request öffnen oder einen Branch pushen, die beiden Vorschau-Adressen aus dem Pull Request nehmen:

   ```bash
   pnpm ugur smoke --site https://<site-vorschau>.vercel.app --portal https://<portal-vorschau>.vercel.app --commit <sha>
   ```

6. **Domain umstellen, erst wenn die Produktion bei Vercel geprüft ist.** In Vercel `uguroezdamar.com` und `www` dem Site-Projekt, `portal.uguroezdamar.com` dem Portal-Projekt zuweisen. Bei Cloudflare die DNS-Einträge auf die von Vercel genannten Ziele ändern und den Proxy ausschalten (graue Wolke, *DNS only*). Danach den Smoke-Lauf gegen die echten Adressen wiederholen. Erst dann die Dienste bei Render löschen.

## Was der Smoke-Lauf belegt

- Beide Apps antworten und melden den erwarteten Commit (`VERCEL_GIT_COMMIT_SHA`).
- Beide erreichen die Datenbank. Der Health-Endpunkt lädt das Server-Paket und damit das native Modul `argon2`; antwortet er, ist das Modul im Deployment ladbar. Den Login selbst prüft der Lauf nicht.
- Die Site sieht eine Client-Adresse, und selbst gesetzte Header (`x-vercel-forwarded-for`, `x-forwarded-for`, `x-real-ip`) werden nicht übernommen. Davon hängt das Rate-Limit des Kontaktformulars ab; schlägt eine der beiden Prüfungen fehl, darf die Domain nicht umgestellt werden.
- Startseite, Projektkatalog, Weiterleitung von `/work` und Sitemap funktionieren.
- Der Kontakt-Endpunkt lehnt falschen Content-Type, fremde Herkunft, ungültige Eingaben und ein gefülltes Honeypot-Feld ab.
- Das Portal zeigt die Login-Seite und verweigert anonymen Aufrufern die Admin-API.

Der Lauf speichert nichts. Von Hand zu prüfen: Login, Einladung annehmen, Rollen ändern und eine echte Kontaktanfrage bis in die Übersicht des Portals.

## Hinweise

- **Proxy vor Vercel:** Liegt Cloudflare als Proxy vor Vercel, sieht die App für jeden Besucher dieselbe Adresse, und das Rate-Limit trifft alle gemeinsam. Deshalb *DNS only*.
- **Daten der Vorschau:** Vorschauen schreiben in den Neon-Branch `dev`. Dort liegen nur Testdaten.
- **Entwürfe:** Eine Vorschau ist ein Produktionsbuild; Projekte mit `draft: true` erscheinen dort nicht, nur auf dem lokalen Dev-Server.
- **Plan:** Der kostenlose Hobby-Plan ist auf nicht-kommerzielle Nutzung beschränkt. Vor der Umstellung die aktuellen Bedingungen prüfen.

## Lokal dasselbe prüfen

Ohne Vercel lässt sich der Produktionsbuild gegen die Stage `dev` starten:

```bash
pnpm ugur run -- pnpm build
pnpm ugur run -- pnpm --filter @ugur/site exec next start -p 3200
pnpm ugur run -- pnpm --filter @ugur/portal exec next start -p 3201
pnpm ugur smoke --site http://localhost:3200 --portal http://localhost:3201
```

Gegen `localhost` überspringt der Smoke-Lauf die Prüfungen zur Client-Adresse und zum Commit, weil es dort weder Proxy noch Deployment gibt.
