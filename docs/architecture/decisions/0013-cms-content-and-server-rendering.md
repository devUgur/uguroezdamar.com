# ADR 0013: CMS-Projekte mit serverseitiger Next.js-Auslieferung

- Status: angenommen — Datenbankwahl ersetzt durch [ADR 0016](0016-postgres-neon-infisical-cli.md), Hosting durch [ADR 0017](0017-render-hosting.md)
- Datum: 2026-10-12
- Beteiligte: Projektverantwortliche

## Kontext

Das Portal kann Projekte in MongoDB bearbeiten, während die Site statisch exportiert wurde und Projekt-MDX als stiller Fallback veröffentlichte. Die Kontakt-POST-Route benötigt ebenfalls einen Server. Die öffentliche Website zeigte beim Audit weiterhin das Testprojekt „My Project“, den Hello-World-Artikel und einen leeren Work-Bereich; der ViralSync-Link lieferte 404.

Das vorhandene Netlify-Projekt ist in `netlify.toml` als primärer Site-Deploy mit Next.js-Plugin eingerichtet. Netlify dokumentiert Unterstützung für App Router, SSR, Route Handlers und Revalidation. Render war zusätzlich als reine Static Site konfiguriert.

## Entscheidung

- MongoDB/CMS ist die kanonische Quelle für Projekte, Profil und Karriere. Nur Datensätze mit Status `published` und ohne `isSecret: true` sind öffentlich.
- Die Site verwendet serverfähigen Next.js-Betrieb. `output: "export"` wird entfernt. Seiten, die CMS-Daten lesen, werden dynamisch gerendert; dadurch wird eine CMS-Veröffentlichung bei der nächsten Anfrage sichtbar.
- Netlify bleibt das kanonische Produktionsziel. Das Render-Blueprint wird als serverfähige Alternative an dasselbe Laufzeitmodell angepasst und darf nicht parallel als konkurrierende Produktionsquelle betrieben werden.
- Blogartikel bleiben Git-/MDX-Inhalte. Eine Redaktion über das Portal wird erst zugesagt, wenn deren Schreib- und Publish-Pfad tatsächlich implementiert ist.
- CMS-Projekttexte werden als eingeschränktes Markdown ohne rohes HTML oder ausführbare MDX-Ausdrücke gerendert. Die MDX-Kompilierung bleibt auf reviewte Blogdateien aus Git begrenzt.
- Projekt-MDX-Fallbacks und Beispielinhalte werden nicht mehr automatisch öffentlich ausgeliefert. Fehlende Daten zeigen einen klaren leeren Zustand oder einen Betriebsfehler, nie Demo-Inhalte.
- Case-Study-URLs verwenden normalisierte Kleinbuchstaben-Slugs. Die bestehende ViralSync-URL mit Großschreibung wird auf den kanonischen Slug weitergeleitet.

## Alternativen

- Git/MDX plus statischer Export als einzige Inhaltsquelle: abgelehnt, weil das bestehende Portal bereits redaktionelle Projekt- und Profilpflege bietet und der Kontaktfluss einen Laufzeitendpunkt benötigt.
- MongoDB im Build laden und bei jedem Publish neu bauen: abgelehnt, weil dies weiterhin Build-/Inhaltskopplung und unklare Fehlerzustände erzeugt.
- Microservices oder separates CMS: abgelehnt, da die vorhandenen Next.js-Apps und MongoDB für den Umfang ausreichen.

## Konsequenzen

- Produktionsumgebungen müssen `MONGODB_URI` zur Laufzeit setzen und mit geringsten nötigen Rechten auf dieselbe Datenbank zugreifen wie das Portal.
- Projektänderungen sind unmittelbar sichtbar, sobald sie als `published` gespeichert sind; Entwürfe und geheime Projekte bleiben ausgeschlossen.
- Die Site nutzt SSR für CMS-Routen; Build-Time-Projektparameter und Export-Fallbacks entfallen.
- Netlify ist der primäre Deploy; ein alternativer Render-Service benötigt getrennte Secrets und eine bewusst konfigurierte Domain.
- Eine Migration vorhandener Daten auf kleingeschriebene Slugs ist vor Release zu prüfen. Doppelte Slugs müssen vor dem Index-Update aufgelöst werden.

## Verifikation und Rückprüfung

- Netlify Preview muss Projekt veröffentlichen, Entwurf verbergen, Projekt zurückziehen und Änderungen ohne Site-Rebuild anzeigen.
- Kontakt-POST muss in der Produktionslaufzeit einen Request sicher speichern.
- Öffentliche Listen und Slug-Abfragen schließen unveröffentlichte und als geheim markierte Projekte aus.
- CMS-Markdown rendert kein rohes HTML und führt keine JSX-/MDX-Ausdrücke aus.
- Offizielle Plattformreferenzen: [Next.js Static Exports](https://nextjs.org/docs/app/guides/static-exports), [Netlify Next.js](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) und [Render Next.js Deploy](https://render.com/docs/deploy-nextjs-app).
