# R2-A visuelle Nachweise

Die Screenshots wurden am 12.10.2026 aus dem lokalen Produktionsbuild (`next start`) aufgenommen. Die Vorschau verwendete eine leere, isolierte lokale MongoDB-Datenbank, deshalb zeigen die Projekt-, Profil- und Bildungsbereiche ihre redaktionell ehrlichen Leerzustände.

## Startseite — erster Viewport

| Viewport | Hell | Dunkel |
| --- | --- | --- |
| 375 px | [375 px hell](home-375-light.png) | [375 px dunkel](home-375-dark.png) |
| 768 px | [768 px hell](home-768-light.png) | [768 px dunkel](home-768-dark.png) |
| 1440 px | [1440 px hell](home-1440-light.png) | [1440 px dunkel](home-1440-dark.png) |

## Vollständige Startseite

- [375 px, hell](home-full-375-light.png)
- [1440 px, hell](home-full-1440-light.png)

## Prüfprotokoll

- Viewports 320, 375, 768, 1024, 1440 und 1920 px: `scrollWidth` entsprach jeweils der Viewport-Breite.
- HTTP-Smoke: `/`, `/projects`, `/about`, `/education`, `/blog` und `/contact` lieferten 200; `/work` leitete permanent (308) auf `/projects` weiter.
- Axe auf `/`, `/projects` und `/contact`: keine Verstöße gemeldet.
- Mobile Navigation: öffnet per Button/Tastatur, ist im Accessibility Tree als Navigation verfügbar und schließt mit Escape.
- Der leere CMS-Datenbestand belegt keine Darstellung echter veröffentlichter Projekte. Diese Inhaltsabnahme ist separat erforderlich.
