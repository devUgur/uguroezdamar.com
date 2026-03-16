# ADR 0011: Navigationspunkte in Produktion deaktiviert

## Status
Angenommen (2025-03-16)

## Kontext
- Die öffentliche Site (Marketing-Layout) zeigt im Header Links zu About, Work, Projects und Contact.
- Für den Produktionsstart soll der Benutzer vorerst nur die Hauptseite nutzen; Unterseiten wie `/contact` oder `/about` sollen nicht über die Navigation erreichbar sein.

## Entscheidung

1. **Nav-Links nur in Nicht-Produktion klickbar**
   - In `packages/ui/src/layout/Header.tsx` wird `process.env.NODE_ENV === "production"` ausgewertet.
   - In Produktion werden die Nav-Einträge als nicht klickbare `<span>`-Elemente mit gleichem Styling gerendert (`cursor-default`, `aria-disabled="true"`, `title="Coming soon"`).
   - In Development/Test bleiben die Links wie bisher funktionsfähig.

2. **Direkte URL-Zugriffe**
   - Routen wie `/contact`, `/about` etc. sind in Produktion weiterhin per direkter URL aufrufbar. Eine spätere Einschränkung (z. B. Middleware-Redirect auf `/`) kann bei Bedarf ergänzt werden.

## Konsequenzen
- In Produktion kann der Benutzer nicht über die Navigation zu Unterseiten wechseln und bleibt faktisch auf der Hauptseite.
- Lokale Entwicklung und Tests sind unverändert nutzbar.
- Wenn die Unterseiten freigegeben werden, reicht die Umkehrung der Bedingung (oder Entfernung der Produktionsprüfung) im Header.
