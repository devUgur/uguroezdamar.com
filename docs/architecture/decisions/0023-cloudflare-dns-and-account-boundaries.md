# ADR 0023: Cloudflare-DNS und Kontogrenzen je Produkt

- Status: accepted
- Datum: 2026-10-21
- Beteiligte: Projektverantwortliche
- Ergänzt: [ADR 0020](0020-vercel-hosting.md) und [ADR 0022](0022-infisical-identity-isolation.md)

## Kontext

uguroezdamar.com und ViralSync sind eigenständige Produkte. Beide verwenden GitHub-Repositories; die Portfolio-Site und das Portal werden aus diesem Repository als getrennte Vercel-Projekte betrieben. Die DNS-Zonen und Cloudflare-Konten sind produktbezogen. Ein vorhandener globaler Wrangler-Login und ein versehentlich aktiver Cloudflare-API-Token können sonst den falschen Account für ein Verzeichnis auswählen.

Für dieses Portfolio ist Cloudflare DNS-Provider. Die Anwendung läuft auf Vercel; ein Wechsel zu Cloudflare Workers ist nicht Teil dieser Entscheidung. Die derzeitige Wrangler-Version stellt OAuth-Scope `zone:read` bereit, aber keinen passenden DNS-Schreib-Scope.

## Entscheidung

1. GitHub-Identität darf projektübergreifend verwendet werden. GitHub verbindet die Quellcode-Repositories; es vereinheitlicht weder Secrets, Datenbanken, Cloudflare-Zonen noch Deployments.
2. Vercel kann ein gemeinsames Konto/Team für mehrere Produkte haben. Site und Portal dieses Repositories bleiben jeweils eigene Vercel-Projekte; ViralSync bleibt sein eigenes Projekt. Domains, Roots, Umgebungsvariablen, Schutzregeln und Produktionsfreigaben sind getrennt.
3. Cloudflare-Identitäten, Zonen und Tokens sind je Produkt getrennt. Dieses Repository verwendet das benannte lokale Wrangler-Profil `uguroezdamar`, gebunden an den Portfolio-Checkout.
4. `pnpm ugur setup` erstellt/bindet das Profil mit `account:read`, `user:read` und `zone:read`, zeigt `wrangler whoami` und verlangt die Bestätigung, dass das angemeldete Konto die Zone `uguroezdamar.com` verwaltet. Das Profil und die Bindung bleiben lokal und werden nicht committet.
5. `CLOUDFLARE_API_TOKEN` überschreibt Wrangler-Profile. Setup verweigert die Profilzuordnung, solange diese Variable in der lokalen Umgebung gesetzt ist.
6. DNS-Einträge werden derzeit manuell in der Cloudflare-Oberfläche des bestätigten Zoneninhabers gepflegt. Automatisierung wird erst ergänzt, wenn dafür ein separater, nur auf `uguroezdamar.com` beschränkter DNS-Edit-Token und ein klarer Änderungs-/Freigabeablauf vorhanden sind.
7. Für Vercel bleibt Cloudflare-Proxy deaktiviert (DNS only), damit die App die Besucheradresse für das Kontakt-Rate-Limit korrekt erhält.

## Alternativen

- **Ein Cloudflare-Konto oder Token für beide Produkte:** abgelehnt, weil Produkt- und Zonengrenzen vermischt werden.
- **Globalen Wrangler-Standard für beide Checkout-Pfade nutzen:** abgelehnt, weil das reservierte `default`-Profil globaler Fallback ist und keinem Verzeichnis gebunden werden kann.
- **DNS-Änderungen mit Wrangler-OAuth ausführen:** abgelehnt, da der benötigte Schreib-Scope dort nicht verfügbar ist.
- **Cloudflare als App-Hosting einführen:** abgelehnt; die bestehende serverfähige Architektur ist auf Vercel festgelegt und ein Workers-Port brächte für den DNS-Cutover keinen Nutzen.

## Konsequenzen

- Ersteinrichtung verlangt eine separate Cloudflare-Browseranmeldung im richtigen Konto.
- Das Setup bestätigt per Betreiberangabe den Zoneninhaber; es ersetzt nicht die Prüfung der DNS-Einträge oder Vercel-Domain-Verifikation.
- Lokale Wrangler-Profile sind experimentell und nicht Teil von CI. CI-Cloudflare-Zugriff wird nicht eingerichtet, solange es keinen begründeten Cloudflare-Deploy-Schritt gibt.
- DNS-Cutover, Verifikation und Smoke-Ergebnis werden in [Hosting, Preview und Release](../../operations/preview.md) dokumentiert.

## Verifikation und Rückprüfung

- `pnpm exec wrangler auth list` im Portfolio-Checkout muss `uguroezdamar` an dessen Pfad zeigen.
- `pnpm exec wrangler whoami` muss nach Prüfung das Konto ausweisen, das die Portfolio-Zone verwaltet.
- `pnpm ugur smoke --site https://uguroezdamar.com --portal https://portal.uguroezdamar.com` muss nach dem DNS-Cutover erfolgreich sein.
- Die Entscheidung wird überprüft, wenn Vercel-Hosting wechselt, Wrangler einen geeigneten DNS-Schreib-Scope anbietet oder die Produkte ihre Kontogrenzen ändern.
