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

Voraussetzungen: Node 24, pnpm, [Infisical CLI](https://infisical.com/docs/cli/overview) v0.43.145 oder neuer (Named Profiles und `.infisical.yaml`; `winget install infisical.infisical` bzw. `winget upgrade infisical`), Neon CLI (`npm install --global neonctl`).

```bash
pnpm install
pnpm ugur setup
```

**Produktidentitäten sind getrennt:** ViralSync und uguroezdamar.com verwenden getrennte Infisical-Logins. Die CLI-Profile halten beide Logins auf demselben Rechner verfügbar; sie vereinigen weder Konten noch Projekte. Dieses Repository verwendet ausschließlich das lokale Profil `uguroezdamar`; ViralSync behält sein eigenes Profil und sein eigenes Infisical-Projekt. `pnpm ugur setup` richtet das Portfolio-Profil ein und bindet es an diesen Checkout. Wenn der Browser beim Anmelden ein Konto vorauswählt, ausdrücklich mit der für uguroezdamar.com registrierten Geschäfts-/Portfolio-Mail fortfahren bzw. das Konto wechseln.

Die CLI unterstützt Named Profiles und das aktuelle Projektformat `.infisical.yaml` ab v0.43.145. Einmalig wird das Profil angelegt und an dieses Repository gebunden:

```text
infisical login --save-as uguroezdamar --domain=https://eu.infisical.com
infisical profile bind uguroezdamar <repository-path>
infisical profile current
```

`pnpm ugur setup` führt diese Einrichtung interaktiv aus, falls das Profil noch fehlt. Die Verzeichnisbindung wird in der lokalen Infisical-Konfiguration gespeichert, nicht im Git-Repository. Jeder `pnpm ugur`-Zugriff prüft vor einem Secret-Lese- oder Schreibvorgang, dass im Repository das Profil `uguroezdamar` aktiv ist. So kann ein global als Standard ausgewählter ViralSync-Login nicht versehentlich für dieses Repository verwendet werden. Bei einer abgelaufenen Anmeldung das Profil ausdrücklich neu authentifizieren: `infisical login --profile uguroezdamar --domain=https://eu.infisical.com`.

Das Infisical-Projekt selbst wird einmalig in der Web-Oberfläche angelegt (Name `uguroezdamar-com`, Environments `dev` und `prod`). Es muss ein eigenes Projekt dieses Produkts vom Typ **Secrets Management** in der zum Portfolio-Login gehörenden Organisation sein; ein ViralSync-Projekt oder ein anderes fremdes Projekt darf nicht wiederverwendet werden.

`pnpm ugur setup --relink` fragt die Projektwahl erneut ab. Die CLI prüft den ausgewählten Link zunächst in einem temporären Verzeichnis und testet den Zugriff auf `dev` und `prod` unter dem gebundenen Portfolio-Profil. Erst wenn beide Prüfungen erfolgreich sind, ersetzt sie `.infisical.yaml`; Abbruch oder ein falsches Projekt lassen die bisherige Verknüpfung unverändert. Bei `This project does not belong to your selected organization` prüfen, ob `infisical profile current` `uguroezdamar` anzeigt und ob dieses Profil mit dem Portfolio-Login authentifiziert ist. Erneutes Anmelden mit ViralSync löst den Organisationsfehler nicht. `pnpm ugur dev` prüft Profil und Secret-Zugriff vor dem Start und zeigt den nächsten Schritt.

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

Die tägliche Löschung abgelaufener Kontaktanfragen läuft ausschließlich auf Vercel-Production. Dafür ist `CRON_SECRET` nur für Stage `prod` deklariert und wird mit `pnpm ugur secrets generate --stage prod --apply` erzeugt. Anschließend `pnpm ugur hosting env --stage prod --apply` ausführen, damit Vercel Production den Schlüssel erhält, bevor die Site mit dem Cron-Plan ausgerollt wird. Wert nie anzeigen, kopieren oder in Logs übernehmen. `secrets audit --stage prod` prüft nur den Variablennamen; der erste Cron-Lauf und sein Ergebnis müssen in Vercel kontrolliert werden.

Die CLI gibt Secret-Werte nie aus und übergibt sie auch nicht als Prozessargument: `secrets set`, `generate`, `copy`, `import` und `db provision` schreiben den Wert in eine nur für den eigenen Benutzer lesbare Datei in einem privaten Temp-Verzeichnis, reichen sie als `KEY=@datei` an Infisical und löschen sie sofort wieder.

## Täglicher Gebrauch

| Befehl | Wirkung |
| --- | --- |
| `pnpm dev` | Site (Port 3100) mit `dev`-Secrets und localhost-Adressen starten |
| `pnpm dev:portal`, `pnpm dev:all` | nur das Portal (Port 3101) bzw. beide Apps starten |
| `pnpm ugur run -- <cmd>` | beliebigen Befehl genauso ausführen, z. B. `pnpm ugur run -- pnpm build:site` |
| `pnpm ugur smoke --site <url> [--portal <url>]` | Deployment über HTTP prüfen: Commit, Datenbank, Client-Adresse, Ablehnungen; speichert nichts |
| `pnpm ugur hosting status` / `setup` / `env` | Vercel-Projekte prüfen, einrichten und mit den Secrets einer Stage versorgen |
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

- Eigene Zufallswerte (`ADMIN_API_KEY`, `CONTACT_RATE_LIMIT_SECRET`, `CRON_SECRET`): `pnpm ugur secrets generate --rotate --apply`, je Stage, soweit dort deklariert. `CRON_SECRET` gilt nur für `prod`; nach einer Rotation muss `pnpm ugur hosting env --stage prod --apply` vor dem nächsten Cron-Aufruf ausgeführt werden.
- Datenbank: Passwort der Neon-Rolle in der Neon-Konsole zurücksetzen, danach `pnpm ugur db provision --apply --overwrite`.
- R2, Screenshot-Dienst und `REVALIDATE_SECRET`: Der Code nutzt sie seit [ADR 0019](../architecture/decisions/0019-content-from-git.md) nicht mehr; das Manifest führt sie als zurückgezogen. Das R2-Token im Cloudflare-Dashboard widerrufen und die Schlüssel mit `pnpm ugur secrets prune --apply` je Stage entfernen.
- Der frühere MongoDB-Atlas-Cluster existiert nicht mehr (Hostname löst nicht mehr auf). `MONGODB_URI` ist zurückgezogen; `secrets audit` meldet den Schlüssel, falls er wieder auftaucht.

## Hosting und CI

- **Hosting:** Die Laufzeitumgebung bei Vercel bekommt ihre Variablen aus Infisical über `pnpm ugur hosting env --stage <stage> --apply` ([ADR 0020](../architecture/decisions/0020-vercel-hosting.md)): `prod` in die Umgebung Production, `dev` in Preview, je App nur die Schlüssel, die sie liest. Nichts wird im Vercel-Dashboard von Hand gepflegt.
- **CI:** Lint, Typecheck, Tests und Build brauchen keine Secrets. Die Tests laufen gegen ein In-Memory-Postgres (PGlite) mit den echten Migrationen. Erst ein Deploy-Workflow bräuchte Zugriff; dann per GitHub-OIDC-Login bei Infisical, ohne gespeicherte Tokens.
