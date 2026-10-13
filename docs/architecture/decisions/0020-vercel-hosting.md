# ADR 0020: Vercel als Hosting für Site und Portal

- Status: accepted (Einrichtung offen)
- Datum: 2026-10-13
- Beteiligte: Projektverantwortliche
- Ersetzt: [ADR 0018](0018-render-hosting.md) (Render als Hosting).

## Kontext

1. Seit [ADR 0019](0019-content-from-git.md) sind alle Inhaltsseiten statisch; dynamisch sind nur der Kontakt-Endpunkt und das Portal. Render würde dafür dauerhaft zwei Node-Prozesse betreiben.
2. Im kostenlosen Plan von Render schläft ein Dienst ohne Aufrufe ein; der erste Besucher wartet danach bis zu einer Minute. Für ein Portfolio ist das der ungünstigste Moment. Dauerbetrieb kostet je Dienst.
3. Eine Vorschau je Pull Request musste für Render selbst gebaut werden (eigene Blueprint-Datei, Branch `dev`).
4. Bei Render lief bis zuletzt nur der statische Stand vom März 2026; der aktuelle Code war dort nie ausgeliefert. Es gibt also keinen laufenden Betrieb, der umzuziehen wäre.
5. Das Schwesterprojekt viralsync.io betreibt seine Next.js-App bereits bei Vercel.

## Entscheidung

1. Site und Portal sind zwei Vercel-Projekte aus diesem Repository (Root Directory `apps/site` und `apps/portal`), Region `fra1`.
2. Jeder Pull Request bekommt eine Vorschau gegen die Stage `dev`. Vorschauen bleiben durch Vercel geschützt; der Smoke-Lauf nutzt ein Bypass-Secret aus Infisical.
3. `main` ist der Produktions-Branch. Die automatische Zuweisung der Produktionsdomain ist aus: Ein Build von `main` geht erst nach manueller Freigabe (*Promote*) live.
4. Secrets kommen per Infisical Secret Sync: `prod` → Production, `dev` → Preview.
5. Die Domain bleibt bei Cloudflare, nur als DNS ohne Proxy.
6. Die Client-Adresse für das Kontakt-Rate-Limit kommt aus `x-vercel-forwarded-for`.
7. `render.yaml` und `render.preview.yaml` sind entfernt. Die Dienste bei Render laufen unverändert weiter, bis die Auslieferung bei Vercel geprüft und der DNS-Eintrag umgestellt ist.

## Alternativen

- **Render behalten:** Kaltstart oder laufende Kosten für zwei Dienste, Vorschauen in Eigenbau. Abgelehnt.
- **Cloudflare Workers:** kein Kaltstart und bereits im Einsatz für andere Projekte, verlangt aber einen Adapter für Next.js und den Ersatz des nativen Moduls `argon2` im Portal. Das wäre ein weiterer Infrastruktur-Umbau ohne Nutzen für die Inhalte. Abgelehnt; neu zu bewerten, wenn Vercel nicht mehr passt.
- **Site statisch ausliefern, Kontakt als eigener Dienst:** zwei Systeme für ein Formular. Abgelehnt.

## Konsequenzen

- Vorschau, Freigabe und Rollback sind Funktionen der Plattform; im Repository bleiben `/api/health` und `pnpm ugur smoke`.
- Eine Vorschau hat keine feste Adresse. Sitemap und Einladungslinks fallen dort auf `VERCEL_URL` zurück; die Adressvariablen gibt es nur in `prod`.
- Liegt ein Proxy vor Vercel, sieht die App für alle Besucher dieselbe Adresse. Die DNS-Einträge müssen direkt auf Vercel zeigen.
- Der Hobby-Plan ist auf nicht-kommerzielle Nutzung beschränkt.

## Verifikation und Rückprüfung

Stand 13.10.2026: `pnpm check` und der Produktionsbuild beider Apps sind grün; der lokale Produktionsbuild gegen die Stage `dev` besteht den Smoke-Lauf. Bei Vercel ist noch nichts angelegt.

Offen und erst an einem Deployment prüfbar: dass `argon2` in der Funktion des Portals lädt (Login), dass die Client-Adresse ankommt und sich nicht fälschen lässt, dass Node.js 24 und pnpm 10 so gebaut werden wie in der CI, und dass die Bedingungen des Hobby-Plans zur Nutzung passen.
