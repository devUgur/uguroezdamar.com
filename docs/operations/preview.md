# Hosting, Preview und Release

**Zweck:** Wie Site und Portal bei Vercel eingerichtet werden, wie ein Stand vor dem Merge als Vorschau geprüft wird und wie er in die Produktion kommt. Entscheidung: [ADR 0020](../architecture/decisions/0020-vercel-hosting.md). Cloudflare-Kontotrennung und DNS-Verfahren stehen unter [Cloudflare](cloudflare.md) und [ADR 0023](../architecture/decisions/0023-cloudflare-dns-and-account-boundaries.md).

**Stand 21.10.2026:** Main-Commit `f92be7d` wurde nach grüner CI manuell auf beide Vercel-Production-Projekte promotet. `pnpm ugur hosting status` bestätigt manuelles Promote, `all_except_custom_domains`, passende Smoke-Bypasses und die erforderlichen Variablennamen. Smoke gegen beide Vercel-Production-Aliases: 19/19. Der Live-Smoke auf `https://uguroezdamar.com` besteht alle 13 Site-Prüfungen; der vollständige Smoke mit `https://portal.uguroezdamar.com` besteht 16/17, weil die Portal-Domain noch auf Render zeigt.

**DNS-Snapshot 21.10.2026 nach der Betreiberänderung:** Die autoritativen Cloudflare-Nameserver `linda.ns.cloudflare.com` und `rohin.ns.cloudflare.com` liefern den Apex und `www` auf Vercel. `vercel domains verify` bestätigt beide Hostnamen für `uguroezdamar-com`; `www` zeigt den projektspezifischen CNAME `8e330e50605e5449.vercel-dns-017.com.`. Die DNS-Antwort veröffentlicht den CNAME direkt, passend zu DNS-only ohne Cloudflare-Proxy. HTTPS am Apex liefert 200. HTTPS bei `www` scheitert noch mit einem TLS-Namensfehler; `vercel certs ls` enthält aktuell nur das Zertifikat für den Apex. `vercel certs issue www.uguroezdamar.com --challenge-only` hat eine DNS-Challenge gestartet. Der Challenge-TXT-Eintrag war bei der anschließenden öffentlichen Abfrage noch nicht sichtbar.

Der Portal-Record ist noch nicht umgestellt: Cloudflare liefert `portal.uguroezdamar.com CNAME portal-uguroezdamar-com.onrender.com`; Vercel meldet `invalid-configuration`. Der von Vercel für das Portal-Projekt empfohlene Zielwert ist `b6010c3103a2d7b8.vercel-dns-017.com.`. Das Live-Smoke gegen den Apex besteht alle 13 Site-Prüfungen; beim Portal-Smoke scheitert `/api/health` an HTTP 401. Die beiden Vercel-Production-Aliases bestehen dagegen 19/19 Prüfungen. Erst nach dem Portal-CNAME-Wechsel und dem www-Zertifikat ist der DNS-Cutover abgeschlossen.

Die externe ViralSync-Website `https://viralsync.io` und die Vercel-App `https://app.viralsync.io` antworten derzeit mit HTTP 200. Das Portfolio listet ViralSync dennoch als Draft. Im sichtbaren Vercel-Team gibt es kein Video-Lab-Projekt; `video-lab.mdx` besitzt keine Live-URL und bleibt ebenfalls Draft. Diese Produkt-Deployments und die Veröffentlichung der Portfolio-Cases benötigen getrennte Freigabe und eigene Projektkonfiguration.

### Manuelle Abschlussfolge

1. In Cloudflare den bestehenden `portal`-CNAME `portal-uguroezdamar-com.onrender.com` durch `b6010c3103a2d7b8.vercel-dns-017.com` ersetzen, Proxy aus lassen.
2. Den von `vercel certs issue www.uguroezdamar.com --challenge-only` ausgegebenen `_acme-challenge.www`-TXT-Wert setzen. Den Wert nicht committen; bei Ablauf die Challenge neu erzeugen.
3. Danach ausführen:

   ```powershell
   vercel domains verify portal.uguroezdamar.com
   vercel certs issue www.uguroezdamar.com
   vercel certs ls
   Resolve-DnsName -Name _acme-challenge.www.uguroezdamar.com -Type TXT -Server 1.1.1.1
   pnpm ugur smoke --site https://uguroezdamar.com --portal https://portal.uguroezdamar.com
   ```

   Erwartung: Domain-Verifikation `configured-correctly`, Zertifikat enthält `www.uguroezdamar.com`, TXT ist sichtbar und Smoke 19/19. Zusätzlich HTTPS bei `www` ohne Zertifikatswarnung öffnen.
4. Secrets-Bereinigung wurde nur als Dry-Run ausgeführt: `prod` würde `REVALIDATE_SECRET` und `SITE_URL`, `dev` `REVALIDATE_SECRET` entfernen. Erst nach Bestätigung, dass diese Werte nicht mehr gebraucht werden, je Stage `pnpm ugur secrets prune --stage <stage> --apply` ausführen und Audit wiederholen.
5. Video Lab nicht mit ViralSync-Secrets oder Portfolio-Datenbank deployen. Vor einer Live-Preview eigenes Vercel-Projekt, Runtime-/Persistent-Storage, eigene Verbindungen/Secrets, sichere Mock-/Spend-Gates und eine geschützte Preview einrichten. Danach eine tatsächliche Live-URL in der Draft-Case-Study ergänzen und erst nach Fakten-/Owner-Review veröffentlichen.

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
