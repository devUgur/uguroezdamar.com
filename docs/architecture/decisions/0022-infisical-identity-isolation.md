# ADR 0022: Infisical-Identitäten und Projekte je Produkt trennen

- Status: accepted
- Datum: 2026-10-21
- Beteiligte: Projektverantwortliche
- Ergänzt: [ADR 0016](0016-postgres-neon-infisical-cli.md) für die Secret- und Zugriffsgrenzen.

## Kontext

ViralSync und uguroezdamar.com sind eigenständige Produkte und bei Infisical mit unterschiedlichen E-Mail-Konten angemeldet. Auf Entwicklerrechnern wird die Infisical-CLI für beide Projekte verwendet. Ein einzelner globaler Login oder eine globale Standard-Organisation kann dazu führen, dass ein Repository das falsche Konto verwendet. Der bisherige `403` zeigte, dass die Projekt-ID allein keine ausreichende Authentifizierungszuordnung darstellt.

## Entscheidung

1. Jedes Produkt verwendet einen eigenen Infisical-Login, eine eigene Organisation und ein eigenes Secrets-Management-Projekt. Environments, Secret-Werte, Neon-Zugangsdaten, Service-Tokens und Berechtigungen werden nicht zwischen ViralSync und uguroezdamar.com geteilt.
2. Die lokale Infisical-CLI verwendet für dieses Repository das benannte Profil `uguroezdamar`. ViralSync behält ein eigenes Profil.
3. Das Profil `uguroezdamar` wird lokal an den Checkout gebunden. Es wird nicht als aktives globales Profil vorausgesetzt und nicht in Git gespeichert.
4. Das Repository verlangt Infisical CLI v0.43.145 oder neuer. Die CLI prüft das gebundene Profil vor Secret-Zugriffen und verweigert den Zugriff, wenn das Profil fehlt, nicht unterstützt wird oder auf ein anderes Konto-Profil zeigt. Projektkonfiguration wird im aktuellen `.infisical.yaml`-Format gepflegt.
5. `pnpm ugur setup` kann die benannte Anmeldung interaktiv anlegen und binden. Beim Browser-Login muss der Betreiber ausdrücklich die Portfolio-Mail verwenden. Re-Link prüft Projektzugriff für `dev` und `prod`, bevor `.infisical.yaml` ersetzt wird.
6. CI und Hosting erhalten jeweils nur produktbezogene, eng begrenzte Identitäten/Zugriffe. Persönliche CLI-Sessions werden nicht in CI verwendet.

## Alternativen

- **Ein Infisical-Konto für beide Produkte:** abgelehnt, weil die Produkte unterschiedliche Geschäftsidentitäten und Berechtigungsgrenzen haben.
- **Globalen Standard-Login umschalten:** abgelehnt, weil Terminal- und Arbeitsverzeichnis-Kontext leicht verwechselt werden und der Fehler erst beim API-Aufruf auffällt.
- **Secrets kopieren oder Projekt-ID im Repository pro Maschine ändern:** abgelehnt, weil dadurch Datenzugriff, Review und Wiederherstellung unsicher bzw. nicht reproduzierbar werden.

## Konsequenzen

- Die erstmalige Einrichtung benötigt eine aktuelle CLI und eine einmalige interaktive Anmeldung pro Produkt.
- Profile und Verzeichnisbindungen sind lokale Authentifizierungszustände und werden nicht committet; `.infisical.yaml` enthält nur die gemeinsame, nicht geheime Projekt-ID, Stage-Zuordnung und EU-Domain.
- Bei einem abgelaufenen Portfolio-Login authentifiziert der Betreiber das existierende Profil gezielt erneut (`infisical login --profile uguroezdamar`).
- Fehlerdiagnosen nennen das erwartete Profil und den Bind-Befehl, ohne Tokens oder Secret-Werte auszugeben.

## Verifikation und Rückprüfung

- `infisical profile current` im Repository muss `uguroezdamar` anzeigen.
- `pnpm ugur secrets audit` muss die Namen der `dev`- bzw. `prod`-Secrets lesen können, ohne Werte auszugeben.
- `pnpm ugur dev` darf bei fehlendem oder falschem Profil keine App starten.
- Diese Entscheidung wird überprüft, falls Infisical die lokale Profilverwaltung ändert oder die Produkte später unter eine gemeinsame organisatorische Identität überführt werden.
