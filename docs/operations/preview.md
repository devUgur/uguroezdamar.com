# Hosting, Preview und Release

**Zweck:** Wie Site und Portal bei Vercel eingerichtet werden, wie ein Stand vor dem Merge als Vorschau geprüft wird und wie er in die Produktion kommt. Entscheidung: [ADR 0020](../architecture/decisions/0020-vercel-hosting.md).

**Stand 13.10.2026:** Beide Projekte sind angelegt und eingerichtet, die Umgebung Preview hat ihre Variablen. `pnpm ugur smoke` gegen die Vorschau des Commits `e821bec` hat alle 19 Prüfungen bestanden, einschließlich Client-Adresse und Commit. Die Umgebung Production ist noch leer und liefert auf den `vercel.app`-Adressen den alten Stand von `main` aus; die Domain zeigt weiter auf Render.

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

Die zwei Projekte bestehen seit dem 13.10.2026: `uguroezdamar-com` (Root Directory `apps/site`) und `uguroezdamar-portal` (`apps/portal`), beide mit diesem Repository verbunden, Produktions-Branch `main`, Node.js 24.x. Die Namen stehen in `tooling/cli/src/lib/vercel.ts`.

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
- **Entwürfe:** Lokale Entwicklung und geschützte Vercel-Preview-Deployments zeigen Projekte mit `draft: true`. Der Build erkennt Preview über `VERCEL_ENV=preview` plus `VERCEL_URL`; Production filtert Drafts auch bei explizitem `includeDrafts: true`. Derzeit bestätigt `pnpm ugur hosting status` `all_except_custom_domains`, sodass Preview-URLs durch Deployment Protection geschützt sind. Sitemap und `robots` schließen Draft-Seiten unabhängig davon aus. Fällt der Schutz weg, darf kein Draft-Preview ausgerollt werden. Details: [ADR 0022](../architecture/decisions/0022-protected-draft-previews.md).
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
