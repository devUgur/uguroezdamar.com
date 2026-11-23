# Cloudflare: DNS und Kontotrennung

**Zweck:** Cloudflare-Zugriffe pro Produkt trennen und die DNS-Zone dieses Portfolios sicher für Vercel verwalten.

## Zuständigkeiten

| Dienst | uguroezdamar.com | ViralSync | Gemeinsame Ebene |
| --- | --- | --- | --- |
| GitHub | Repository `devUgur/uguroezdamar.com` | eigenes Repository | Das persönliche GitHub-Konto darf beide Repositories bedienen. GitHub ist Identität und Quellcode-Quelle, kein gemeinsamer Secrets- oder Laufzeitbereich. |
| Vercel | Site- und Portal-Projekt mit eigenen Roots, Umgebungen und Deployments | eigenes Vercel-Projekt | Eine Vercel-Anmeldung bzw. ein Team kann mehrere Projekte verwalten. Projekte, Domains, Umgebungsvariablen und Freigaben bleiben getrennt. |
| Cloudflare | Zone `uguroezdamar.com`, nur DNS für Vercel | eigene ViralSync-Zone und Dienste | Keine gemeinsame Authentifizierung oder Zone voraussetzen. |
| Infisical | Profil/Projekt für Portfolio | getrenntes Geschäftsprofil/Projekt | Keine Secret-Werte oder Service-Tokens teilen. |
| Neon | Datenbank und Branches für Portfolio | eigener Datenbankbereich | Keine Connection-Strings oder Daten teilen. |

Die Produktions-App läuft bei Vercel ([ADR 0020](../architecture/decisions/0020-vercel-hosting.md)). Cloudflare ist für dieses Projekt DNS-Verwaltung, kein Worker-Hosting. ViralSync darf denselben GitHub-Zugang oder dieselbe Vercel-Anmeldung verwenden; das hebt keine Projekt-, Domain-, Umgebungs- oder Daten-Grenze auf.

## Lokale Anmeldung

`pnpm ugur setup` richtet in diesem Checkout ein eigenes Wrangler-Profil `uguroezdamar` ein und bindet es an den Repository-Pfad. Das Profil erhält nur `account:read`, `user:read` und `zone:read`. Beim ersten Login muss im Browser das Cloudflare-Konto ausgewählt werden, das tatsächlich die Portfolio-Zone `uguroezdamar.com` besitzt. Das Setup zeigt anschließend `wrangler whoami` an und verlangt die ausdrückliche Bestätigung des Zoneneigentümers.

Wrangler-Profile sind lokale, experimentelle CLI-Einstellungen und werden nicht committet. Prüfen lässt sich die Zuordnung mit:

```powershell
pnpm exec wrangler auth list
pnpm exec wrangler whoami
```

Beide Befehle im Portfolio-Checkout ausführen. `whoami` muss das Portfolio-Konto zeigen; `auth list` muss `uguroezdamar` an diesen Checkout binden. Im ViralSync-Checkout muss dessen eigene Cloudflare-Identität aktiv sein. Das globale Wrangler-Profil `default` ist reserviert und kann keinem Verzeichnis zugeordnet werden. Ein `CLOUDFLARE_API_TOKEN` überschreibt Profile und darf nicht als gemeinsamer lokaler Fallback verwendet werden.

Wrangler kann bei einem Profil mit bewusst eingeschränkten Rechten warnen, dass optionale Worker-/Pages-/Produkt-Scope fehlen. Das ist hier erwartet: keine zusätzlichen Scopes freigeben, solange das Portfolio Cloudflare nur für DNS verwendet.

Für ViralSync ist ein eigenes benanntes Profil im ViralSync-Repository einzurichten und dort an dessen Pfad zu binden. Wird dieses Profil neu angelegt, beim OAuth-Login ausdrücklich das ViralSync-Geschäftskonto auswählen und den Zugriff auf die tatsächlich benötigten Ressourcen beschränken. Das Portfolio-Profil darf dort nicht verwendet werden.

## DNS-Änderungen und Freigabe

Die Wrangler-OAuth-Oberfläche bietet für die derzeit verwendete CLI `zone:read`, aber keinen passenden DNS-Schreib-Scope. Das lokale Portfolio-Profil kann daher Zuständigkeit und Lesestatus prüfen, aber keine Records ändern. DNS-Änderungen nur mit der Cloudflare-Oberfläche des bestätigten Portfolio-Zoneninhabers ausführen. Falls später ein automatisierter DNS-Schreibpfad nötig wird, dafür einen separaten API-Token mit **Zone:DNS:Edit** nur für `uguroezdamar.com` anlegen und in einem produktbezogenen Secret-Store verwalten; den Token nicht in Wrangler-Profile, `.env`-Dateien, GitHub-Logs oder ein anderes Produkt übernehmen.

Vor dem DNS-Cutover:

1. Im Portfolio-Konto die Zone `uguroezdamar.com` und die Vercel-Ziele für Apex, `www` und `portal` verifizieren.
2. Nur die von den zugehörigen Vercel-Projekten empfohlenen Records setzen; für diese Architektur Cloudflare-Proxy deaktiviert lassen (DNS only), damit die Site die echte Client-Adresse für das Kontakt-Rate-Limit erhält.
3. Vercel-Domain-Verifikation abwarten und anschließend `pnpm ugur smoke --site https://uguroezdamar.com --portal https://portal.uguroezdamar.com` ausführen.
4. Die Änderung samt Record-Namen, Zeitpunkt und Verifikation in `docs/operations/preview.md` festhalten; keine Token-Werte oder persönlichen Zugangsdaten dokumentieren.

Der aktuelle Release- und DNS-Status steht in [Hosting, Preview und Release](preview.md). Ein Cloudflare-Login allein ist keine Freigabe, die Produktion umzuschalten.
