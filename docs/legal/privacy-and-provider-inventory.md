# Datenschutz- und Anbieterinventar

> **Status: technische Bestandsaufnahme, keine Rechtsfreigabe.** Stand 22.10.2026. Diese Datei hält umgesetzte Datenflüsse, vom Betreiber bestätigte Angaben und noch offene Provider-/Rechtsprüfungen getrennt. Die öffentlichen Datenschutz- und Impressumsseiten bleiben als Entwürfe markiert; diese Dokumentation behauptet keine vollständige DSGVO-Konformität.

## Vom Betreiber bestätigte Angaben aus ViralSync

Der Betreiber bestätigte am 22.10.2026, die für ViralSync gepflegte natürliche Personenidentität, Anschrift und Rollen-Kontakte auch für die Portfolio-Rechtsseiten zu verwenden. Quelle im getrennten ViralSync-Repository: `sites/marketing/src/features/legal/legal-config.ts` und `docs/LAUNCH.md` (Release-A-Angaben). Die übernommene Anschrift lautet Stockumer Straße 219, 44225 Dortmund, Deutschland. Rechtliche Anfragen laufen über `legal@viralsync.io`, Datenschutzanfragen über `privacy@viralsync.io`; die Telefonnummer aus den Betreiberangaben wird im Impressum veröffentlicht. Die dortige Betreiberakte führt den Anbieter als natürliche Person und behauptet keine eingetragene Gesellschaft. Eine erneute rechtliche Prüfung des Tätigkeits-/Gewerbe- und DDG-Status bleibt offen.

Die ViralSync-Betriebsdokumentation beschreibt die Rollenadressen `privacy@viralsync.io` und `legal@viralsync.io` als über Cloudflare Email Routing an das kontrollierte Gmail-Postfach weitergeleitet. Gewöhnliche Korrespondenz soll spätestens 90 Tage nach Bearbeitung aus dem aktiven Postfach gelöscht werden; Google hält gelöschte Nachrichten standardmäßig weitere 30 Tage im Papierkorb, kontospezifische Einstellungen können abweichen. Für das Portfolio wird diese bekannte Rollenadresse für Datenschutzanfragen verwendet. Die Provider-Verträge, der Google-Kontotyp und die tatsächlichen Retention-Einstellungen sind weiterhin anhand der Konten zu prüfen. Diese E-Mail-Infrastruktur wird nicht mit der separaten allgemeinen Kontaktadresse `ugur.oezdamar@itc-studenten.de` gleichgesetzt; deren Mailprovider und Löschroutine sind offen.

ViralSync ist ein separates SaaS-Projekt. Dessen App/API, Stripe, Resend, Social-Provider, Kundenkonten, Tokens und KI-Verarbeitung gehören nicht zum Portfolio und werden nicht in dessen öffentliche Datenschutzhinweise übernommen.

## Verifizierte Datenflüsse im Repository

| Vorgang | Daten und Zweck | Aktueller technischer Weg | Aufbewahrung / Löschung |
| --- | --- | --- | --- |
| Öffentlicher Seitenaufruf | HTTP-Anfrage und technische Verbindungsdaten für Auslieferung und Betrieb | Next.js Site auf Vercel; Cloudflare ist laut Hosting-Entscheidung DNS-only | Vercel-/Cloudflare-Protokollfristen und konkrete Anbieterbedingungen sind im Betreiberkonto zu verifizieren |
| Theme-Auswahl | Auswahl `light`, `dark` oder `system`, damit die Darstellung erhalten bleibt | `next-themes` im Browser (local storage); kein Analytics-Script oder Werbetracker im Site-Quellcode gefunden | Bis Browserdaten gelöscht oder Einstellung geändert wird; tatsächliche Key-/Storage-Details vor Release im Browser bestätigen |
| Kontaktformular | Name, E-Mail, Nachricht für Bearbeitung einer Anfrage; Quellkennung `website` | Same-origin Route → Zod-Validierung → Neon PostgreSQL; kein automatischer E-Mail-Versand | 90 Tage ab Eingang; bei ausdrücklicher Markierung „processed“ wird die Frist auf 90 Tage ab dieser Bearbeitung verlängert. Unbearbeitete Anfragen laufen ebenfalls spätestens 90 Tage nach Eingang ab. Täglicher Vercel-Cron löscht abgelaufene Datensätze; ein Ausfall kann die Löschung verzögern. Einzelne Anfragen können vorher im geschützten Portal gelöscht werden. |
| Direkte allgemeine E-Mail-Anfragen | Absenderadresse, Nachricht und ggf. Anhänge zur Beantwortung | Auf der Kontaktseite veröffentlichte Adresse `ugur.oezdamar@itc-studenten.de`; Mailprovider, Zugriff und Synchronisierung sind nicht aus dem Repository belegt | Anbieter und Löschfristen noch vom Betreiber zu bestätigen |
| Datenschutzanfragen per E-Mail | Absenderadresse und Nachricht zur Bearbeitung von Betroffenenanfragen | `privacy@viralsync.io` über Cloudflare Email Routing an das kontrollierte Gmail-Postfach; als Betreiberpraxis ist die Löschung gewöhnlicher Korrespondenz spätestens 90 Tage nach Bearbeitung dokumentiert | Gmail-Papierkorb standardmäßig bis zu 30 Tage nach Löschung; Kontotyp, Vertragsbedingungen, tatsächliche Retention-Einstellungen und Transfergarantien offen |
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

1. Anschrift und natürliche Personenidentität sind für die Portfolio-Veröffentlichung am 22.10.2026 vom Betreiber aus den ViralSync-Rechtsangaben übernommen worden. Tätigkeits-/Gewerbestatus, DDG-Anwendbarkeit und zusätzliche berufliche Pflichtangaben rechtlich prüfen; keine Gesellschaftsform oder Registerangabe erfinden.
2. Verantwortlichkeit und Datenschutzkontakt sind auf den Seiten benannt. Prüfen, ob ein Datenschutzbeauftragter bestellt werden muss und ob die LDI NRW im konkreten Fall die zuständige Aufsichtsbehörde ist.
3. Rechtsgrundlage je Kontaktvorgang final prüfen: vorvertragliche Schritte nach Art. 6 Abs. 1 lit. b DSGVO gegenüber allgemeinen Nachrichten und Art. 6 Abs. 1 lit. f DSGVO; Interessenabwägung und Formularinformation an der Erhebungsstelle freigeben.
4. Vercel und Neon: tatsächlich genutzte Tarife/Standorte, Auftragsverarbeitungsverträge, Unterauftragsverarbeiter, Drittlandverarbeitungen und anwendbare Transfergarantien aus den Kontoeinstellungen/Vertragsunterlagen prüfen. DNS-Konfiguration allein belegt keine Datenstandorte.
5. Die allgemeine Kontaktadresse `ugur.oezdamar@itc-studenten.de`: Mailprovider, Speicherort, Zugriff und Löschfristen bestätigen. Für `privacy@viralsync.io` die dokumentierte Cloudflare Email Routing → Gmail-Weiterleitung, Google-Kontotyp, Vertragsbedingungen und tatsächliche Retention-Einstellungen anhand der Konten verifizieren.
6. Vercel-/Neon-/Portal-Logs, Supportzugriffe und Datenbank-Backups: tatsächliche Fristen, Zugriff, internationale Verarbeitung und Löschpfade verifizieren. Für Backupdaten dokumentieren, wann sie endgültig auslaufen.
7. Tägliche Cron-Ausführung in der Site-Production aktiv und erfolgreich prüfen. Vercel dokumentiert, dass Cron-Aufrufe nur in Production laufen, die Ausführung zeitlich abweichen kann und bei Fehlern nicht automatisch erneut versucht wird; deshalb Monitoring/Runbook ergänzen.
8. Theme-Cookie und localStorage im produktiven Browser verifizieren und die Ausnahme nach § 25 TDDDG rechtlich bewerten; kein Consent-Banner allein aufgrund einer Annahme ergänzen.
9. Rechtsberatung bzw. qualifizierte Prüfung der finalen Datenschutz- und Anbietertexte. Bis dahin Draft-Hinweise beibehalten; keine Konformitätsaussage treffen.

## Keine generischen AGB ohne Vertragsangebot

Der Betreiber hat am 22.10.2026 bestätigt: Das Portfolio bietet derzeit keine Vertrags- oder Checkout-Leistungen an; generische AGB sollen deshalb nicht veröffentlicht werden. Diese Bestätigung gilt für uguroezdamar.com. Sie trifft keine Aussage über ViralSync oder andere Projekte. Sobald auf dem Portfolio konkrete kostenpflichtige Leistungen oder Online-Verträge angeboten werden, ist vor deren Veröffentlichung ein separates, angebotsbezogenes Vertrags-/Widerrufs-/Verbraucherrecht-Review erforderlich. Projekt-Casestudies sind keine Leistungszusagen.

## Offizielle Quellen für die Prüfung

- [DSGVO, Verordnung (EU) 2016/679, insbesondere Art. 5, 6, 12–14, 17, 28 und 32 (EUR-Lex)](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679)
- [TDDDG § 25 – Zugriff/Speicherung auf Endeinrichtungen](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [DDG § 5 – allgemeine Informationspflichten](https://www.gesetze-im-internet.de/ddg/__5.html)
- [LDI NRW – Beschwerdeformular](https://www.ldi.nrw.de/beschwerde)
- [BfDI: Informationspflichten nach Art. 13 DSGVO](https://www.bfdi.bund.de/SharedDocs/Downloads/DE/Broschueren/INFO1.pdf?__blob=publicationFile&v=27)
- [Vercel: Cron Jobs – Einrichtung und Produktion](https://vercel.com/docs/cron-jobs/quickstart)
- [Vercel: Cron Jobs verwalten, Secret und fehlende Wiederholungsversuche](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel: Cron-Ausführungsgrenzen und Zeitgenauigkeit](https://vercel.com/docs/cron-jobs/usage-and-pricing)

Die Dokumentation beschreibt den vorgefundenen technischen Stand und ist keine Rechtsberatung oder Bestätigung einer vollständigen DSGVO-Konformität.
