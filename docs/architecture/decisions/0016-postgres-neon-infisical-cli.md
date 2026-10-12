# ADR 0016: Postgres auf Neon mit Drizzle, Infisical als Secret-Quelle und eine Projekt-CLI

- Status: accepted
- Datum: 2026-10-12
- Beteiligte: Projektverantwortliche
- Ersetzt: die Datenbankwahl aus [ADR 0013](0013-cms-content-and-server-rendering.md); das Inhaltsmodell (CMS für Projekte/Profil/Karriere, MDX für Blog) bleibt gültig.

## Kontext

1. Der MongoDB-Atlas-Cluster wurde vom Anbieter entfernt; sein Hostname löst nicht mehr auf. Es gibt keinen Datenbestand mehr, der zu übernehmen wäre.
2. Zugangsdaten lagen in mehreren lokalen `.env`-Dateien und wurden in einer Agentenausgabe offengelegt.
3. Index-Anlage, Admin-Seeding und Datenkorrekturen liefen über einzelne `.mjs`-Skripte ohne gemeinsames Modell; Integrationstests brauchten einen laufenden MongoDB-Dienst und wurden lokal übersprungen.
4. Das Schwesterprojekt viralsync.io betreibt bereits Infisical (EU), Neon und eine eigene CLI. Zwei verschiedene Betriebsmodelle zu pflegen kostet mehr, als es nützt.

## Entscheidung

1. **Datenbank:** PostgreSQL auf Neon, Region `aws-eu-central-1`, ein Projekt `uguroezdamar.com` mit den Branches `prod` und `dev`.
2. **Zugriff:** Drizzle ORM mit `postgres.js`. Das Schema liegt in `packages/server/src/db/schema.ts`, Migrationen als SQL in `packages/server/drizzle/`. Zur Laufzeit wird die gepoolte Verbindung (`DATABASE_URL`, `prepare: false`) genutzt, für Migrationen die direkte (`DATABASE_URL_DIRECT`).
3. **Schema:** relationale Spalten für alles, wonach gefiltert oder sortiert wird; `jsonb` nur für eingebettete Listen (Links, Bilder, Apps, Tags). IDs sind UUIDs, öffentlich als `id` (nicht mehr `_id`). Kontaktanfragen haben eine fortlaufende ID für die Cursor-Paginierung.
4. **Secrets:** Infisical (eu) ist die einzige Quelle. `tooling/cli/src/secrets-manifest.ts` ist die einzige Liste der Variablen. Es gibt keine `.env`- und keine `.env.example`-Dateien mehr.
5. **CLI:** `pnpm ugur` bündelt Einrichtung, Secrets, Datenbank und Admin-Pflege ([Betriebsdokumentation](../../operations/secrets.md)). Werte werden nie ausgegeben; ändernde Befehle sind Probeläufe bis `--apply`.
6. **Tests:** Repository-Tests laufen gegen PGlite mit den echten Migrationen. `setDb()` im Server-Paket ist die einzige Einspeisestelle.

## Alternativen

- **Neuer MongoDB-Atlas-Cluster:** kleinster Code-Umbau, aber dieselbe Abhängigkeit von einem Free-Tier, das bei Inaktivität entfernt wird, kein Branching für Previews und ein zweites Betriebsmodell neben viralsync.io. Abgelehnt.
- **Neon-Branch im bestehenden viralsync.io-Projekt:** spart ein Projekt, koppelt aber Daten, Zugriffsrechte und Wiederherstellung zweier Produkte. Abgelehnt.
- **Doppler, Vercel-Env oder verschlüsselte Dateien im Repository:** jeweils ein weiteres Werkzeug ohne Vorteil gegenüber dem bereits genutzten Infisical. Abgelehnt.

## Konsequenzen

- Verbesserungen gegenüber der MongoDB-Schicht: Fremdschlüssel (Sessions enden mit dem Konto), atomare Einladungsannahme in einer Transaktion, atomares Rate-Limit per `INSERT … ON CONFLICT`, Suche in Kontaktanfragen ohne vom Nutzer gesteuerte Regex, Slug-Eindeutigkeit für Karriereeinträge, ungültige IDs führen zu „nicht gefunden“ statt zu einem Fehler.
- Der Legacy-Pfad für SHA-256-Passworthashes ist entfernt; ohne Altdaten gibt es nichts zu migrieren. `verifyPassword` meldet `needsRehash`, wenn ein Argon2id-Hash schwächere Parameter nutzt.
- Abgelaufene Rate-Limit-Einträge werden beim nächsten Zählvorgang gelöscht; es gibt keinen TTL-Index mehr.
- Inhalte (Projekte, Profil, Karriere, Admin-Konten) müssen neu angelegt werden.
- `@ugur/server` exportiert `getDb()` synchron und zusätzlich `schema`, `setDb` und `isUuid`. Direkter Datenbankzugriff bleibt auf `packages/server` beschränkt.
- Offen: Neon- und Infisical-Projekt anlegen, Secret Sync zum Hosting einrichten, Backup-/Restore-Probe auf Neon (Point-in-Time-Restore) dokumentieren.
