# Datenschutz- und Anbieterinventar

> **Status: technische Bestandsaufnahme, keine Rechtsfreigabe.** Stand 21.10.2026. Diese Datei hält umgesetzte Datenflüsse, bestätigte Code-Fakten und noch vom Betreiber zu bestätigende Angaben getrennt. Die öffentlichen Datenschutz- und Impressumsseiten dürfen erst nach Erledigung der Release-Gates als vollständig behandelt werden.

## Verifizierte Datenflüsse im Repository

| Vorgang | Daten und Zweck | Aktueller technischer Weg | Aufbewahrung / Löschung |
| --- | --- | --- | --- |
| Öffentlicher Seitenaufruf | HTTP-Anfrage und technische Verbindungsdaten für Auslieferung und Betrieb | Next.js Site auf Vercel; Cloudflare ist laut Hosting-Entscheidung DNS-only | Vercel-/Cloudflare-Protokollfristen und konkrete Anbieterbedingungen sind im Betreiberkonto zu verifizieren |
| Theme-Auswahl | Auswahl `light`, `dark` oder `system`, damit die Darstellung erhalten bleibt | `next-themes` im Browser (local storage); kein Analytics-Script oder Werbetracker im Site-Quellcode gefunden | Bis Browserdaten gelöscht oder Einstellung geändert wird; tatsächliche Key-/Storage-Details vor Release im Browser bestätigen |
| Kontaktformular | Name, E-Mail, Nachricht für Bearbeitung einer Anfrage; Quellkennung `website` | Same-origin Route → Zod-Validierung → Neon PostgreSQL; kein automatischer E-Mail-Versand | 90 Tage ab Eingang; bei ausdrücklicher Markierung „processed“ wird die Frist auf 90 Tage ab dieser Bearbeitung verlängert. Unbearbeitete Anfragen laufen ebenfalls spätestens 90 Tage nach Eingang ab. Täglicher Vercel-Cron löscht abgelaufene Datensätze; ein Ausfall kann die Löschung verzögern. Einzelne Anfragen können vorher im geschützten Portal gelöscht werden. |
| Direkte E-Mail-Anfragen | Absenderadresse, Nachricht und ggf. Anhänge zur Beantwortung | Externes E-Mail-Postfach; Anbieter, Zugriff und Synchronisierung außerhalb dieses Repositories | Mailanbieter und Löschfristen noch vom Betreiber zu bestätigen |
| Kontakt-Spamschutz | Client-Adresse nur zur Begrenzung missbräuchlicher Formularaufrufe | Vercel-Forwarded-For wird serverseitig mit `CONTACT_RATE_LIMIT_SECRET` als HMAC pseudonymisiert; persistenter Zähler, keine rohe Client-Adresse in dieser Tabelle | Rate-Limit-Schlüssel wird nach etwa 70 Minuten bei einem späteren Zählvorgang entfernt; veraltete Einträge werden beim nächsten erfolgreichen Zählvorgang bereinigt |
| Externe Links | Bei bewusstem Klick werden Browserdaten an die verlinkte Plattform übertragen | z. B. GitHub oder verifizierte Projekt-Websites | Für die jeweilige Plattform gilt deren eigene Datenschutzerklärung |
| Administration | Admin-Konto, Sitzung und sicherheitsbezogene Metadaten | getrenntes Portal und Neon; Admin-Sitzungen können IP/Browserkennung enthalten | Lösch- und Logfristen für Admin-/Sitzungsdaten sind getrennt zu bestimmen und zu dokumentieren |

## Technische Schutzmaßnahmen im Kontaktfluss

- Maximale JSON-Requestgröße: 16 KiB; serverseitige Schema-Prüfung begrenzt Name auf 120, E-Mail auf 320 und Nachricht auf 5.000 Zeichen.
- Rate-Limit: fünf Anfragen je 10-Minuten-IP-HMAC-Bucket; Honeypot gegen einfache Bots.
- Im Portal sind Kontaktanfragen nur mit gültiger Sitzung lesbar; Datensätze mit abgelaufenem `expires_at` werden sofort aus Liste und Zähler ausgeschlossen. Markieren als bearbeitet verlängert die Frist ab diesem Zeitpunkt, Löschen entfernt den Datensatz unmittelbar. Der tägliche Cron löscht abgelaufene Datensätze physisch; ein Cron-Ausfall kann diese physische Löschung verzögern, ohne abgelaufene Anfragen weiter im Portal anzuzeigen.
- Der tägliche Lösch-Endpunkt akzeptiert nur den zeitkonstant verglichenen `CRON_SECRET`-Bearerwert. Vercel-Konfiguration und Produktionssecret müssen gemeinsam ausgerollt sein.
- Kontakt- und Datenbankfehler werden ohne rohe Treiberdetails oder Kontaktinhalte protokolliert.
- Ein Datenbanksnapshot/Backup kann gelöschte Einträge abhängig von der Neon-Aufbewahrung noch enthalten. Backup-Retention und Löschung aus Sicherungen sind vor einer vollständigen Datenschutzaussage zu verifizieren.

## Freigabepunkte des Betreibers

Vor dem nächsten ungeschützten Production-Promote diese Angaben anhand echter Konten und Verträge bestätigen und in beide Sprachfassungen eintragen:

1. Vollständige ladungsfähige Anbieteranschrift sowie Geschäftszweck/Status für die Impressums- und DDG-Prüfung. Das Repository enthält derzeit nur Name, E-Mail-Adresse und den Ort Dortmund; keine Straßenanschrift.
2. Verantwortlicher im Sinne der DSGVO und belastbare Kontaktadresse für Betroffenenrechte. Prüfen, ob ein Datenschutzbeauftragter bestellt werden muss.
3. Rechtsgrundlage je Vorgang: insbesondere Anfragen, die vorvertragliche Maßnahmen erbitten, gegenüber allgemeinen Nachrichten; Zweck und ggf. berechtigtes Interesse ausdrücklich festlegen.
4. Vercel und Neon: tatsächlich genutzte Tarife/Standorte, Auftragsverarbeitungsverträge, Unterauftragsverarbeiter, Drittlandverarbeitungen und anwendbare Transfergarantien aus den Kontoeinstellungen/Vertragsunterlagen prüfen. DNS-Konfiguration allein belegt keine Datenstandorte.
5. Kontakt-E-Mail: tatsächlicher Mailanbieter, Speicherort, Zugriff und Löschfristen für Nachrichten, die außerhalb des Formulars per E-Mail eingehen.
6. Vercel-/Neon-/GitHub- und Portal-Logs, Supportzugriffe sowie Datenbank-Backups: tatsächliche Fristen, Zugriff und Löschpfade verifizieren.
7. Tägliche Cron-Ausführung in der Site-Production aktiv und erfolgreich prüfen. Vercel dokumentiert, dass Cron-Aufrufe nur in Production laufen, die Ausführung zeitlich abweichen kann und bei Fehlern nicht automatisch erneut versucht wird; deshalb Monitoring/Runbook ergänzen.
8. Rechtsberatung bzw. qualifizierte Prüfung der finalen Datenschutz- und Anbietertexte, insbesondere wenn Portfolio-Angebot, Tracking, Kundenprojekte, Newsletter, Analytics oder bezahlte Leistungen dazukommen.

## Keine generischen AGB ohne Vertragsangebot

Der Betreiber hat am 22.10.2026 bestätigt: Das Portfolio bietet derzeit keine Vertrags- oder Checkout-Leistungen an; generische AGB sollen deshalb nicht veröffentlicht werden. Diese Bestätigung gilt für uguroezdamar.com. Sie trifft keine Aussage über ViralSync oder andere Projekte. Sobald auf dem Portfolio konkrete kostenpflichtige Leistungen oder Online-Verträge angeboten werden, ist vor deren Veröffentlichung ein separates, angebotsbezogenes Vertrags-/Widerrufs-/Verbraucherrecht-Review erforderlich. Projekt-Casestudies sind keine Leistungszusagen.

## Offizielle Quellen für die Prüfung

- [DSGVO, Verordnung (EU) 2016/679, insbesondere Art. 5, 6, 12–14, 17, 28 und 32 (EUR-Lex)](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679)
- [TDDDG § 25 – Zugriff/Speicherung auf Endeinrichtungen](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [DDG § 5 – allgemeine Informationspflichten](https://www.gesetze-im-internet.de/ddg/__5.html)
- [BfDI: Informationspflichten nach Art. 13 DSGVO](https://www.bfdi.bund.de/SharedDocs/Downloads/DE/Broschueren/INFO1.pdf?__blob=publicationFile&v=27)
- [Vercel: Cron Jobs – Einrichtung und Produktion](https://vercel.com/docs/cron-jobs/quickstart)
- [Vercel: Cron Jobs verwalten, Secret und fehlende Wiederholungsversuche](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel: Cron-Ausführungsgrenzen und Zeitgenauigkeit](https://vercel.com/docs/cron-jobs/usage-and-pricing)

Die Dokumentation beschreibt den vorgefundenen technischen Stand und ist keine Rechtsberatung oder Bestätigung einer vollständigen DSGVO-Konformität.
