# ADR 0019: Projekte, Profil und Werdegang als Dateien im Repository

- Status: accepted
- Datum: 2026-10-13
- Beteiligte: Projektverantwortliche
- Ersetzt: das Inhaltsmodell aus [ADR 0013](0013-cms-content-and-server-rendering.md) (CMS für Projekte, Profil und Karriere). Die Server-Laufzeit der Site und MDX für den Blog bleiben.

## Kontext

1. Das Portfolio zeigt wenige, ausgewählte Projekte, die sich selten ändern. Dafür unterhielt das Projekt ein CMS mit Formularen, Datei-Uploads, Vorschau-Abruf und Veröffentlichungslogik.
2. Dieses CMS hatte Fehler mit Folgen: Das Projektformular überschrieb beim Speichern Links, Bilder und Reihenfolge mit leeren Werten; die Vorschau-Route rief konfigurierbare Adressen serverseitig ohne Schutz gegen interne Ziele ab und konnte einen Provider-Schlüssel in eine öffentliche Bildadresse schreiben.
3. Jede öffentliche Seite war `force-dynamic` und fragte bei jedem Aufruf die Datenbank ab. Ein Datenbankfehler erschien als leere Seite.
4. Site und Portal sind getrennte Deployments. Das Portal konnte den Cache der Site nicht invalidieren; ein Publish-Vertrag zwischen beiden fehlte.

## Entscheidung

1. **Quelle:** Projekte liegen als `apps/site/content/projects/<slug>.mdx`, Profil, Berufserfahrung und Ausbildung in `apps/site/content/profile.ts`. Git ist die einzige Quelle; es gibt keinen Rückfall auf die Datenbank.
2. **Schema:** `apps/site/src/content/projects.ts` validiert das Frontmatter mit Zod und lehnt unbekannte Schlüssel ab. Ein ungültiger Inhalt lässt Build und Tests scheitern, statt still zu fehlen.
3. **Entwürfe:** `draft: true` ist nur auf einem lokalen Dev-Server sichtbar und nie Teil eines Produktionsbuilds oder der Sitemap. Veröffentlichen heißt: Rolle und eigene Beiträge ergänzen, `draft: false` setzen, Pull Request mergen.
4. **Schutz privater Arbeit:** Nur ein öffentliches Repository darf verlinkt werden; das Schema erzwingt das. Texte zu privaten Projekten werden einzeln freigegeben, nichts wird aus einem README übernommen.
5. **Rendering:** Alle Inhaltsseiten werden beim Build erzeugt. Dynamisch bleibt nur `/api/contact`.
6. **Leere Abschnitte:** Ohne Profil- oder Ausbildungsdaten entfällt der Abschnitt auf der Startseite; die Nummerierung der übrigen Abschnitte folgt der tatsächlichen Reihenfolge.
7. **Neon** bleibt für Kontaktanfragen, Rate-Limit, Admin-Konten und Sessions.

## Alternativen

- **CMS behalten und reparieren:** Bearbeiten ohne Deployment, dafür Formular-Korrektur, abgesicherter Vorschau-Abruf, Caching und ein signierter Publish-Aufruf vom Portal zur Site. Für fünf bis zehn Case Studies mehr Code und Betrieb als Nutzen. Abgelehnt.
- **Beide Quellen nebeneinander:** zwei Wahrheiten für dieselben Inhalte. Abgelehnt.
- **GitHub-Metadaten zur Laufzeit abrufen:** macht die Projektliste von einem fremden Dienst abhängig und kann private Repositories offenlegen. Abgelehnt; ein kuratierter Abruf beim Build bleibt möglich.

## Konsequenzen

- Eine Inhaltsänderung braucht einen Pull Request und ein Deployment. Dafür ist jeder Stand versioniert und reviewbar.
- Die Site zeigt ihre Inhalte auch ohne Datenbank; ein Datenbankausfall betrifft nur das Kontaktformular.
- Bilder liegen unter `apps/site/public/projects/<slug>/` und laufen durch die Bildoptimierung von Next.js.
- Das Projekt-, Karriere- und Profil-CMS im Portal, die Upload- und Vorschau-Routen, die Blog-Ansicht des Portals und die zugehörigen Server-Module sind entfernt. Das Portal verwaltet Admin-Konten und zeigt Kontaktanfragen.
- Die Tabellen `projects`, `career_entries` und `profiles` entfallen mit der Migration `0001_retire_content_cms`. Sie ist zerstörend und wird je Stage erst nach Datensicherung, getestetem Restore und Freigabe angewendet (`pnpm ugur db migrate --stage <stage>`).
- `R2_*`, `PREVIEW_USE_STORAGE`, `SCREENSHOT_*` und `REVALIDATE_SECRET` sind im Secrets-Manifest zurückgezogen.
- Die alte Weiterleitung `/projects/ViralSync` ist entfernt: Next.js vergleicht Weiterleitungsquellen ohne Rücksicht auf Groß- und Kleinschreibung, sie leitete `/projects/viralsync` auf sich selbst um.

## Verifikation und Rückprüfung

Stand 13.10.2026: `pnpm check` und der Produktionsbuild der Site sind grün. Der Build erzeugt alle Seiten statisch; die beiden Entwürfe (ViralSync, Video Lab) sind darin nicht enthalten und auf dem lokalen Dev-Server als „Draft“ sichtbar. `tests/content-projects.test.ts` prüft Schema, Entwurfsregel und Sitemap.

Erneut prüfen, wenn Inhalte ohne Deployment geändert werden müssen oder jemand ohne Git-Zugang sie pflegen soll.
