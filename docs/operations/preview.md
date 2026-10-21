# Hosting, Preview und Release

**Zweck:** Wie Site und Portal bei Vercel eingerichtet werden, wie ein Stand vor dem Merge als Vorschau geprüft wird und wie er in die Produktion kommt. Entscheidung: [ADR 0020](../architecture/decisions/0020-vercel-hosting.md). Cloudflare-Kontotrennung und DNS-Verfahren stehen unter [Cloudflare](cloudflare.md) und [ADR 0023](../architecture/decisions/0023-cloudflare-dns-and-account-boundaries.md).

**Stand 21.10.2026:** Main-Commit `f92be7d` wurde nach grüner CI manuell auf beide Vercel-Production-Projekte promotet. `pnpm ugur hosting status` bestätigt die aktuellen Production-Aliases auf diesem SHA, manuelles Promote, `all_except_custom_domains`, passende Smoke-Bypasses und die erforderlichen Variablennamen. Der Smoke gegen beide Staged-Production-Deployments und anschließend gegen die aktuellen Production-Aliases bestand jeweils alle 19 Prüfungen (Health, Datenbank, erwarteter SHA, Client-IP-Schutz, öffentliche Site-Routen, Kontakt-Validierungen und anonyme Portal-Sperren).

Die eigentlichen Domains sind noch nicht umgestellt: öffentliche DNS-Abfragen zeigen `uguroezdamar.com` weiterhin auf Render (`216.24.57.16`, `216.24.57.18`), `www` auf `uguroezdamar-com.onrender.com` und `portal` auf `portal-uguroezdamar-com.onrender.com`. Die drei Hostnamen sind den Vercel-Projekten zugewiesen, Vercel meldet ihre DNS-Konfiguration jedoch noch als ungültig. Der verfügbare Wrangler-Zugang ist dem ViralSync-Konto zugeordnet und hat keine DNS-Schreibberechtigung für diese Domain; dessen Default-Profil wird nicht für das Portfolio verwendet. Nach Anmeldung mit dem Cloudflare-Konto, das die Portfolio-Zone verwaltet, die von Vercel empfohlenen DNS-Einträge setzen (DNS only, Proxy aus), die Vercel-Verifikation wiederholen und den Smoke gegen die echten Hostnamen ausführen. Erst dann zeigt die bisherige Domain den neuen Vercel-Stand.

Der historische Smoke gegen den früheren Production-SHA `f60a1a4` schlug bei 7 von 15 Prüfungen fehl (Site-Health 404, Site-Home/Katalog 500, Portal-Health 401 durch Deployment Protection); diese Fehler wurden auf dem neuen Main-Stand behoben. Der frühere Lauf bleibt als Historie dokumentiert, nicht als aktueller Production-Status.

Der frühere Preview-Smoke für Commit `8ad2053` schlug fehl: 14 von 15 Prüfungen erhielten eine 302-Weiterleitung der Deployment Protection bzw. einen 401. Das Infisical-Profil wurde seitdem korrekt zugeordnet und die Bypass-Secrets stimmen mit Vercel überein. Preview-Smoke am `141276d` bestand 19/19; Production-Smoke am `f92be7d` bestand ebenfalls 19/19. Logs wurden nur auf Status und Fehlerklasse ausgewertet; Request-Inhalte wurden nicht ausgegeben.

## Aufbau

| Baustein | Ort |
| --- | --- |
| Zwei Vercel-Projekte aus einem Repository | Root Directory `apps/site` bzw. `apps/portal`; `vercel.json` je App legt die Region `fra1` fest (nahe am Neon-Projekt) |
| Vorschau | Vercel baut jeden Branch und jeden Pull Request als Preview mit eigener Adresse |
| Produktion | `main`; ein Build geht erst nach manueller Freigabe live |
| Secrets | Infisical bleibt die Quelle; `pnpm ugur hosting env` kopiert `prod` → Production und `dev` → Preview |
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

## Einrichtung

Die zwei Projekte sind `uguroezdamar-com` (Root Directory `apps/site`) und `uguroezdamar-portal` (`apps/portal`), beide mit diesem Repository verbunden, Produktions-Branch `main`, Node.js 24.x. Die Namen stehen in `tooling/cli/src/lib/vercel.ts`.

Alles Weitere läuft über die CLI. Sie nutzt die angemeldete Vercel-CLI (`vercel login`) und zeigt nur Namen, nie Werte.

| Befehl | Wirkung |
| --- | --- |
| `pnpm ugur hosting status` | vergleicht beide Projekte mit dem, was das Repository erwartet: Root Directory, Freigabe, Schutz, Variablen je Umgebung |
| `pnpm ugur hosting setup --apply` | schaltet das automatische Live-Schalten aus und legt je Projekt ein Bypass-Secret für den Smoke-Lauf an (in Infisical `dev` als `VERCEL_BYPASS_SITE` / `VERCEL_BYPASS_PORTAL`) |
| `pnpm ugur hosting env --stage dev --apply` | kopiert die Secrets, die eine App liest, aus Infisical `dev` in die Umgebung Preview |
| `pnpm ugur hosting env --stage prod --apply` | dasselbe aus `prod` in die Umgebung Production |

Ohne `--apply` sind `setup` und `env` Probeläufe. Welche App welchen Schlüssel liest, steht im Feld `apps` in `tooling/cli/src/secrets-manifest.ts`; nur diese Schlüssel werden kopiert. `DATABASE_URL_DIRECT` (Migrationen) erreicht den Hoster nie.

Infisical bleibt die Quelle. Nach einer Rotation `hosting env` erneut ausführen und neu ausliefern: Ein laufendes Deployment behält seine alten Werte.

**Domain umstellen, erst wenn die Produktion bei Vercel geprüft ist.** In Vercel `uguroezdamar.com` und `www` dem Site-Projekt, `portal.uguroezdamar.com` dem Portal-Projekt zuweisen. Bei Cloudflare die DNS-Einträge auf die von Vercel genannten Ziele ändern und den Proxy ausschalten (graue Wolke, *DNS only*). Danach den Smoke-Lauf gegen die echten Adressen wiederholen. Erst dann die Dienste bei Render löschen.

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
- **Entwürfe:** Lokale Entwicklung und geschützte Vercel-Preview-Deployments zeigen Projekte mit `draft: true`. Der Build erkennt Preview über `VERCEL_ENV=preview` plus `VERCEL_URL`; Production filtert Drafts auch bei explizitem `includeDrafts: true`. `pnpm ugur hosting status` bestätigt derzeit `all_except_custom_domains`; Preview-URLs sind durch Deployment Protection geschützt. Sitemap und `robots` schließen Draft-Seiten unabhängig davon aus. Fällt der Schutz weg, darf kein Draft-Preview ausgerollt werden. Details: [ADR 0022](../architecture/decisions/0022-protected-draft-previews.md).
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
