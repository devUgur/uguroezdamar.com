# Secrets, Konfiguration und Entwicklungsumgebung

## Das Modell

```text
              secrets-manifest.ts  (welche Schlüssel existieren und wozu)
                        │
Infisical (eu) ── Root "/" von dev · prod ─────────────────────────┐
     │                        │                        │           │
 pnpm dev /            pnpm ugur db …           Secret Sync     GitHub Actions
 pnpm ugur run         (infisical run)          zum Hosting     (nur bei Bedarf, OIDC)
     │                        │                        │
 lokale Prozesse        Neon dev · prod          Laufzeit-Umgebung
```

- **Eine Quelle:** ein Infisical-Projekt auf **eu.infisical.com**, eine flache Ebene `/` pro Stage. Keine `.env`-Dateien auf Platten oder im Repository, keine Werte in GitHub.
- **Eine Liste:** [`tooling/cli/src/secrets-manifest.ts`](../../tooling/cli/src/secrets-manifest.ts) deklariert jeden Schlüssel mit Zweck. Ein nicht deklarierter Schlüssel existiert nicht; `tests/secrets-manifest.test.ts` schlägt fehl, sobald Code eine Variable liest, die dort fehlt.
- **Zwei Stages:** `dev` (lokale Läufe und Previews) und `prod` (`main`). Die Zuordnung zu Infisical-Environment und Neon-Branch steht in [`tooling/cli/src/lib/stages.ts`](../../tooling/cli/src/lib/stages.ts).
- **Nie sichtbar:** Die CLI gibt ausschließlich Schlüsselnamen aus. Werte werden verdeckt eingegeben, im Speicher von Neon nach Infisical übertragen oder zufällig erzeugt.

## Einen Rechner einrichten

Voraussetzungen: Node 24, pnpm, [Infisical CLI](https://infisical.com/docs/cli/overview) (`winget install infisical.infisical`), Neon CLI (`npm install --global neonctl`).

```bash
pnpm install
pnpm ugur setup
```

`setup` öffnet den Browser für die Anmeldung bei Infisical und Neon und verknüpft den Checkout mit dem Infisical-Projekt (`.infisical.json`, enthält nur eine Projekt-ID und wird committet). Das Infisical-Projekt selbst wird einmalig in der Web-Oberfläche angelegt (Name `uguroezdamar-com`, Environments `dev` und `prod`).

Beim allerersten Einrichten des Produkts zusätzlich:

```bash
pnpm ugur db provision --apply        # Neon-Projekt, Branches prod/dev, Connection-Strings → Infisical
pnpm ugur secrets generate --apply    # zufällige Signaturschlüssel und Tokens für dev
pnpm ugur secrets generate --stage prod --apply
pnpm ugur secrets audit               # zeigt, was noch fehlt
pnpm ugur db migrate                  # Tabellen in dev anlegen
pnpm ugur admin create <email>        # erstes Owner-Konto, Passwort per verdeckter Eingabe
```

Danach genügt `pnpm dev`. `pnpm ugur doctor` prüft Werkzeuge, Anmeldungen und Pflichtschlüssel.

Die CLI gibt Secret-Werte nie aus und übergibt sie auch nicht als Prozessargument: `secrets set`, `generate`, `copy`, `import` und `db provision` schreiben den Wert in eine nur für den eigenen Benutzer lesbare Datei in einem privaten Temp-Verzeichnis, reichen sie als `KEY=@datei` an Infisical und löschen sie sofort wieder.

## Täglicher Gebrauch

| Befehl | Wirkung |
| --- | --- |
| `pnpm dev` | Site (Port 3100) mit `dev`-Secrets und localhost-Adressen starten |
| `pnpm dev:portal`, `pnpm dev:all` | nur das Portal (Port 3101) bzw. beide Apps starten |
| `pnpm ugur run -- <cmd>` | beliebigen Befehl genauso ausführen, z. B. `pnpm ugur run -- pnpm build:site` |
| `pnpm ugur secrets audit [--stage prod]` | Infisical gegen das Manifest prüfen (nur Namen) |
| `pnpm ugur secrets set <KEY>` | deklarierten Schlüssel per verdeckter Eingabe setzen |
| `pnpm ugur secrets generate [--rotate] --apply` | zufällige Schlüssel anlegen bzw. rotieren |
| `pnpm ugur secrets copy <KEY…> --from dev --to prod --apply` | Werte zwischen Stages kopieren |
| `pnpm ugur secrets import <datei> --apply` | einmalig: deklarierte Schlüssel aus einer alten `.env` übernehmen |
| `pnpm db:generate`, `pnpm db:check` | Migration erzeugen / prüfen, dass keine fehlt (offline) |
| `pnpm db:migrate [--stage prod]`, `pnpm db:studio` | Migrationen anwenden / Drizzle Studio öffnen |
| `pnpm ugur admin create \| set-password \| list \| unlock` | Admin-Konten pflegen |

Befehle, die Cloud-Ressourcen oder gespeicherte Werte ändern, sind Probeläufe, bis `--apply` gesetzt ist.

Lokale Läufe sind keine dritte Stage: Sie nutzen die Secrets und die Datenbank von `dev` und ersetzen nur die Adressvariablen (`NEXT_PUBLIC_SITE_URL`, `SITE_URL`, `APP_URL`) für den eigenen Prozessbaum. In Infisical stehen deshalb die *gehosteten* Adressen.

## Eine Variable hinzufügen

1. In `secrets-manifest.ts` deklarieren (Schlüssel, Zweck, ggf. `optional` oder `random`).
2. In `packages/server/src/env.ts` lesen, falls der Server sie braucht.
3. Wert setzen: `pnpm ugur secrets set MY_KEY` (oder `secrets generate` für Zufallswerte).
4. `pnpm ugur secrets audit` für beide Stages: kein *Missing*, kein *Unknown*.
5. Manifest zusammen mit dem Code committen, der die Variable liest.

## Rotation und Vorfälle

- Eigene Zufallswerte (`ADMIN_API_KEY`, `CONTACT_RATE_LIMIT_SECRET`, `REVALIDATE_SECRET`): `pnpm ugur secrets generate --rotate --apply`, je Stage. Laufende Deployments erhalten den neuen Wert beim nächsten Sync bzw. Deploy.
- Datenbank: Passwort der Neon-Rolle in der Neon-Konsole zurücksetzen, danach `pnpm ugur db provision --apply --overwrite`.
- R2: neues API-Token im Cloudflare-Dashboard erzeugen, mit `pnpm ugur secrets set R2_ACCESS_KEY_ID` und `R2_SECRET_ACCESS_KEY` eintragen, altes Token widerrufen.
- Der frühere MongoDB-Atlas-Cluster existiert nicht mehr (Hostname löst nicht mehr auf). `MONGODB_URI` ist zurückgezogen; `secrets audit` meldet den Schlüssel, falls er wieder auftaucht.

## Hosting und CI

- **Hosting:** Die Laufzeitumgebung bekommt ihre Variablen über einen Infisical *Secret Sync* zu Render ([ADR 0018](../architecture/decisions/0018-render-hosting.md)), nicht durch Eintippen im Dashboard. Der Sync wird einmalig in Infisical eingerichtet und ist für `prod` noch offen. `sync: false` in `render.yaml` ersetzt ihn nicht.
- **CI:** Lint, Typecheck, Tests und Build brauchen keine Secrets. Die Tests laufen gegen ein In-Memory-Postgres (PGlite) mit den echten Migrationen. Erst ein Deploy-Workflow bräuchte Zugriff; dann per GitHub-OIDC-Login bei Infisical, ohne gespeicherte Tokens.
