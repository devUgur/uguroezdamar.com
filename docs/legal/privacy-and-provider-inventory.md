# Datenschutz- und Anbieterinventar

> **Stand: 22.10.2026.** Der Betreiber hat am 22.10.2026 ausdrücklich bestätigt, dass die vorangegangenen Prüfungen und Freigaben für die Veröffentlichung abgeschlossen sind. Die öffentlichen Hinweise geben den daraus freigegebenen Portfolio-Datenfluss wieder. Diese Projektdokumentation ist keine unabhängige Rechtsberatung oder Zertifizierung einer DSGVO-Konformität.

## Geltungsbereich und Betreiberangaben

Diese Bestandsaufnahme bezieht sich ausschließlich auf uguroezdamar.com. Sie übernimmt die natürliche Personenidentität, Anschrift und Rollen-Kontakte, die der Betreiber zuvor zur Verwendung für das Portfolio bestätigt hat: Ugur Özdamar, Stockumer Straße 219, 44225 Dortmund, Deutschland; rechtliche Anfragen `legal@viralsync.io`, Datenschutzanfragen `privacy@viralsync.io` und die bestätigte Telefonnummer. Eine Gesellschaft oder ein Registereintrag wird nicht behauptet.

Das Portfolio bietet nach Bestätigung des Betreibers kein Checkout und keine kostenpflichtigen Vertragsleistungen. Generische AGB werden daher nicht veröffentlicht. ViralSync ist ein separates SaaS-Projekt. Dessen App/API, Stripe, Resend, Social-Provider, Kundenkonten, Tokens und KI-Verarbeitung gehören nicht zum Portfolio.

## Datenflüsse und Aufbewahrung

| Vorgang | Daten und Zweck | Technischer Weg | Aufbewahrung und Löschung |
| --- | --- | --- | --- |
| Seitenaufruf | Verbindungsdaten zur Auslieferung und Absicherung | Next.js auf Vercel; Cloudflare-DNS ist DNS-only | Runtime-Logs im aktuellen Vercel Hobby-Tarif: bis zu eine Stunde. |
| Theme-Auswahl | Auswahl `light`, `dark` oder `system` | `next-themes` im Browser, lokale Speicherung; kein Theme-Cookie | Bis Änderung oder Löschung der Browserdaten. |
| Kontaktformular | Name, E-Mail, Nachricht | Same-origin Route → Zod-Validierung → Neon PostgreSQL; kein E-Mail-Versand | 90 Tage ab Eingang; nach „processed“ 90 Tage ab Bearbeitung. Täglicher geschützter Cron löscht abgelaufene Datensätze. Während eines Cron-Ausfalls kann die physische Löschung später erfolgen; abgelaufene Einträge werden zuvor aus dem Portal ausgeblendet. |
| Allgemeine E-Mail | Absender, Nachricht und freiwillige Anhänge | Kontaktadresse auf der Kontaktseite; Bearbeitung durch den Betreiber | Gewöhnliche Korrespondenz wird spätestens 90 Tage nach Bearbeitung aus dem aktiven Postfach gelöscht; gesetzliche Pflichten und konkrete Rechtsansprüche bleiben vorbehalten. |
| Datenschutz-E-Mail | Absender und Nachricht | `privacy@viralsync.io` → Cloudflare Email Routing → Gmail-Postfach | Aktive Korrespondenz spätestens 90 Tage nach Bearbeitung; Gmail-Papierkorb nach Standardverhalten bis zu 30 Tage. |
| Kontaktformular-Spamschutz | Pseudonymisierter Client-Schlüssel und Zähler | Client-Adresse aus `x-vercel-forwarded-for`, HMAC mit `CONTACT_RATE_LIMIT_SECRET`; kein roher IP-Wert in dieser Tabelle | Fünf Anfragen pro 10-Minuten-Fenster; abgelaufene Schlüssel werden bei späteren Anfragen entfernt. |
| Admin-Anmeldung | Fehlgeschlagene Anmeldung: rohe Quell-IP; Session: Admin-E-Mail, IP, Browserkennung | Geschütztes Portal und Neon | Fehlversuche älter als 24 Stunden werden beim täglichen Cron gelöscht. Sessions werden nach Ablauf gelöscht. Verwendete oder abgelaufene Einladungen werden ebenfalls täglich gelöscht. Ein Cron-Ausfall kann physische Löschungen verzögern. |
| Externe Links | Daten, die der Browser bei bewusstem Aufruf überträgt | GitHub und verifizierte Projekt-Websites | Verarbeitung durch den jeweils verlinkten Dienst. |

## Infrastruktur und Grenzen

- **Vercel:** Site und Portal, Region `fra1`; die Site-Runtime-Logs werden laut aktuellem Hobby-Tarif bis zu eine Stunde aufbewahrt. Die Produktions- und Portal-Projekte sind getrennte Vercel-Projekte.
- **Neon:** PostgreSQL in Frankfurt (`aws-eu-central-1`); der verifizierte Free-Tarif stellt ein Point-in-Time-Recovery-Fenster von bis zu sechs Stunden bereit. Gelöschte Daten können innerhalb dieses Fensters wiederherstellbar sein.
- **Cloudflare:** DNS für die Portfolio-Domain ohne Website-Proxy; Email Routing leitet die Datenschutz-Rollenadresse weiter.
- **Google:** Gmail-Zielpostfach für die weitergeleitete Datenschutzadresse. Gelöschte Nachrichten verbleiben nach Standardverhalten bis zu 30 Tage im Papierkorb.
- Die Tarif- und Retention-Angaben beziehen sich auf den bei der Prüfung festgestellten Stand und müssen bei wesentlichen Änderungen der Konten oder Anbieter erneut geprüft werden.

## Technische Schutzmaßnahmen

- Kontaktanfragen: JSON bis 16 KiB; serverseitige Validierung; Name bis 120, E-Mail bis 320 und Nachricht bis 5.000 Zeichen; Rate-Limit von fünf Anfragen je 10-Minuten-HMAC-Bucket und Honeypot.
- Admin-Zugriff: geschütztes Portal; Sitzungsablauf; Login-Schutz; Aufbewahrungsjob entfernt abgelaufene Sessions, verwendete/abgelaufene Einladungen und Login-Versuche älter als 24 Stunden.
- Der tägliche Endpunkt `/api/cron/purge-contact-requests` erfordert `CRON_SECRET` und führt Kontakt- und Admin-Datenbereinigung aus. Fehler werden ohne SQL-Parameter, IP-Adressen oder Kontaktinhalte protokolliert. Vercel-Cron-Aufrufe werden nicht automatisch wiederholt; der Laufstatus ist daher zu überwachen.
- Datenbank-Recovery kann Datensätze innerhalb des konfigurierten Recovery-Fensters enthalten. Eine Löschung in der Live-Datenbank bedeutet nicht zwingend sofortige Entfernung aus Wiederherstellungspunkten.
- Der Portfolio-Quellcode enthält nach Prüfung keine Analyse- oder Werbetracker. Das Theme wird in `localStorage`, nicht in einem Cookie gespeichert.

## Rechtliche und redaktionelle Pflege

- Die Portfolio-Rechtsseiten wurden nach ausdrücklicher Betreiberfreigabe am 22.10.2026 ohne Entwurfskennzeichnung veröffentlicht.
- Der Betreiber hat bestätigt, dass das Portfolio aktuell keine Vertrags-/Checkout-Leistungen anbietet; deshalb gibt es keine generischen AGB.
- Bei Änderungen an Betreiberdaten, Kontaktwegen, Anbietern, Tarifen, Speicherfristen, Datenflüssen oder kommerzieller Nutzung sind Inventar und öffentliche Hinweise vor dem nächsten Release erneut abzugleichen.
- Rechtliche Grundlagen sind im Code und in den Hinweisen knapp nach Verarbeitungszweck dargestellt. Eine neue, unabhängige Compliance-Aussage darf daraus nicht abgeleitet werden.

## Referenzen

- [DSGVO, Verordnung (EU) 2016/679, insbesondere Art. 5, 6, 12–14, 17, 28 und 32 (EUR-Lex)](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679)
- [TDDDG § 25 – Zugriff/Speicherung auf Endeinrichtungen](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [DDG § 5 – allgemeine Informationspflichten](https://www.gesetze-im-internet.de/ddg/__5.html)
- [LDI NRW – Beschwerdeformular](https://www.ldi.nrw.de/beschwerde)
- [Vercel: Cron Jobs verwalten](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
