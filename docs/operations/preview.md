# Hosting, Preview und Release

**Zweck:** Wie Site und Portal bei Vercel eingerichtet werden, wie ein Stand vor dem Merge als Vorschau geprüft wird und wie er in die Produktion kommt. Entscheidung: [ADR 0020](../architecture/decisions/0020-vercel-hosting.md). Cloudflare-Kontotrennung und DNS-Verfahren stehen unter [Cloudflare](cloudflare.md) und [ADR 0023](../architecture/decisions/0023-cloudflare-dns-and-account-boundaries.md).

**Stand 21.10.2026:** PR #29 veröffentlichte die ViralSync- und Video-Lab-Case-Studies. PR #31 ergänzt lokale Font-Assets und den optionalen Cursor-Ring; PR #32 sichert den CLI-Uploadpfad. Main-SHA `9997735b98fe841eda9e346595843b9603be96b9` ist als Vercel-Deployment `dpl_B5qqvyhTbQ3TvSvTHSLHtdng7J3a` manuell promotet. Der Staged-Smoke und die öffentlichen Smokes auf `https://uguroezdamar.com` sowie `https://www.uguroezdamar.com` bestehen jeweils 24/24 mit Commit-Prüfung. Das unveränderte Portal läuft weiter auf `f92be7d` und besteht mit Commit-Prüfung 6/6 auf `https://portal.uguroezdamar.com`. `pnpm ugur hosting status` bestätigt manuelles Promote, `all_except_custom_domains`, passende Smoke-Bypasses und erwartete Variablennamen.

**R3.2/3.3-Release 21.10.2026:** PR #34 wurde nach grüner GitHub-CI und bestandenem Vercel Preview in `main` gemergt. Der Production-Build `dpl_272QXSwFyoY7QduiEkzNmUaEhTSV` für Main-SHA `d17416967842497c5e0eb5ca1a816705f08ae658` bestand den Staged-Smoke mit 84/84 Checks und wurde anschließend manuell promotet. `https://uguroezdamar.com` und `https://www.uguroezdamar.com` bestehen jeweils 84/84 einschließlich Commit-Prüfung. `/de` und die deutschen Inhalts-/Projektseiten sind live; englische URLs bleiben erhalten. Das unveränderte Portal besteht weiterhin 6/6 auf `https://portal.uguroezdamar.com` mit Commit-Prüfung `f92be7d`. Damit ist das R3.2/3.3-Release-Gate für Routing, Metadaten, Projekte und Domain-Bereitstellung erfüllt.

**DNS- und TLS-Abnahme 21.10.2026:** Die autoritativen Cloudflare-Nameserver liefern den Apex auf Vercel, `www` als CNAME `8e330e50605e5449.vercel-dns-017.com` und `portal` als CNAME `b6010c3103a2d7b8.vercel-dns-017.com`. `www` und `portal` lösen direkt als CNAME auf und sind damit DNS-only. Vercel-Zertifikate für `uguroezdamar.com`, `www.uguroezdamar.com` und `portal.uguroezdamar.com` sind ausgestellt; `https://uguroezdamar.com`, `https://www.uguroezdamar.com` und das Portal bestehen HTTPS. Die frühere `_acme-challenge.www`-Anleitung ist erledigt und nicht mehr auszuführen.

Das Portfolio-Infisical-Projekt hat für `dev` und `prod` alle Pflichtschlüssel; `pnpm ugur hosting status` meldet die erforderlichen Vercel-Variablennamen in beiden Projekten und Stages als „in step“. Die Audits melden optionale Admin-Overrides und zurückgezogene Variablennamen. Vor diesem Release fehlten `/projects/viralsync` und `/projects/video-lab` in der Production-Sitemap und antworteten mit 404, weil beide MDX-Einträge Drafts waren. PR #29 veröffentlicht die freigegebenen Case Studies und erweitert den CLI-Smoke um Karten, Sitemap-Routen, Canonicals, Detailseiten, Cover und ViralSync-Ziel-Link. Der Production-Smoke besteht nun 24/24 für die Site. ViralSync hat einen öffentlichen Marketing-Root; einige seiner eigenen Unterrouten sind noch nicht veröffentlicht. Video Lab hat im zugänglichen Vercel-Team kein Projekt und keine öffentliche Live-URL; seine Portfolioseite ist als Projektvorstellung mit synthetischem Storyboard gekennzeichnet.

Der R3-Lokalisierungs-Smoke erweitert diese historischen 24 Prüfungen um beide Sprachvarianten der öffentlichen Informationsseiten und Projektfallstudien. Er prüft HTTP-Status, HTML-`lang`, Canonical und wechselseitige `hreflang`-Ziele. Erwarteter Umfang nach dieser Erweiterung: 81 lokale bzw. 84 gehostete Site-Prüfungen (inklusive Hosting-Adressprüfungen und ViralSync-Ziel-Link); der Portal-Smoke bleibt separat.

### Verbleibende Release-Gates

1. Für echte Kontaktzustellung und Portal-Login manuell Betreiberpostfach, Formulareingang, Einladungsablauf und Berechtigungen bestätigen. Der Smoke prüft Health, Datenbankzugriff, anonyme Ablehnungen und veröffentlichte Projektseiten, aber keinen echten Mailversand oder Owner-Login.
2. Die Secrets-Audits identifizieren zurückgezogene Portfolio-Schlüssel. Vor dem Entfernen über `pnpm ugur secrets prune --stage <stage>` den Dry-Run prüfen; danach je Stage nur die bestätigten Namen mit `--apply` bereinigen und beide Audits erneut ausführen.
3. Video Lab nicht mit ViralSync-Secrets oder Portfolio-Datenbank deployen. Vor einer Live-Preview eigenes Hosting, Laufzeit-/Persistent-Storage, getrennte Verbindungen und Secrets, sichere Mock-/Spend-Gates und eine geschützte Preview einrichten. Danach eine tatsächliche Live-URL in der Draft-Case-Study ergänzen und erst nach Fakten-/Owner-Review veröffentlichen.
4. Die beiden angeforderten Case Studies sind auf Site-SHA `3bc31aa` veröffentlicht. Site-Smoke 24/24 und Portal-Smoke 6/6 sind grün. Video Lab besitzt weiterhin keine öffentliche App-Demo.

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

### CLI-Deploy aus dem Monorepo

Wenn Vercel nach einem Merge keinen gestagten Main-Build erzeugt, den Produktionsstand nicht aus einer Preview befördern. Zuerst `main` auf den vorgesehenen Release-SHA bringen und dann aus dem Repository-Root den passenden Vercel-Projektnamen explizit wählen:

```powershell
vercel deploy --project uguroezdamar-com --prod --skip-domain --yes
```

Der Befehl erzeugt nur einen gestagten Production-Build und weist ihm keine Custom Domains zu. Das Repository-`.vercelignore` schließt lokale Secrets, Vercel-/Infisical-Konfiguration und große lokale Caches aus dem CLI-Upload aus. Vor dem Promote den Deploymentstatus über `vercel inspect <deployment-url>` prüfen und den ausgelieferten SHA mit `pnpm ugur smoke --site <staging-url> --commit <sha>` festpinnen; der Smoke muss die erwartete Revision melden. Erst danach `vercel promote <deployment-url>` verwenden. Der Portal-Deploy erfolgt getrennt aus seinem eigenen Projekt und nur bei Portal-Codeänderungen.

Vercel-CLI-Linkdaten unter `.vercel/` bleiben lokal und werden nicht committet. `vercel link --repo` kann die beiden Repository-Projekte verbinden; die tatsächlich aufgelöste Projekt-ID und das Verzeichnis vor einem Deploy mit `.vercel/repo.json` und `vercel deploy --dry --json` prüfen. Der Dry-Run muss vor dem Upload bestätigen, dass `.turbo`, `.claude`, `.env*` und `.infisical.*` ausgeschlossen sind.

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

**Domains sind auf Vercel live.** `uguroezdamar.com` und `www` sind dem Site-Projekt, `portal.uguroezdamar.com` dem Portal-Projekt zugewiesen. Cloudflare bleibt authoritative DNS; A-/CNAME-Einträge zeigen auf Vercel und sind DNS-only. Die Domain-Aliases bestehen HTTPS und den Portfolio-Smoke. Änderungen an diesen Records werden über die Cloudflare-CLI-/Owner-Identität geprüft und anschließend mit `pnpm ugur smoke` gegen alle drei Hostnamen verifiziert.

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
