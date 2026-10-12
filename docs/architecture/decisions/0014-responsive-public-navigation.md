# ADR 0014: Öffentliche Navigation ist responsiv und in Produktion verfügbar

- Status: accepted
- Datum: 2026-10-12
- Beteiligte: Projektverantwortliche

## Kontext

ADR 0011 deaktivierte Links in der Produktionsnavigation, solange Unterseiten noch nicht freigegeben waren. Seit der Content-/SSR-Umstellung sind About-, Work-, Projekte- und Kontakt-Routen Teil des öffentlichen Seitensystems. Die gemeinsame UI zeigte auf Mobilgeräten zwar einen Menü-Button, dieser hatte aber keine Interaktion.

## Entscheidung

- Öffentliche Navigation ist auf Desktop und Mobilgeräten verfügbar.
- Das mobile Menü verwendet einen Button mit `aria-expanded`, `aria-controls` und einem zugänglichen Namen.
- Links schließen das Menü nach der Navigation; Escape schließt es ebenfalls.
- Farben öffentlicher UI-Primitives folgen den Theme-Tokens, damit Kontrast in Hell- und Dunkelmodus erhalten bleibt.
- Das Menü wird im gemeinsam genutzten Header der tatsächlich verwendeten UI implementiert.

## Alternativen

- Die Unterseiten weiter per Navigation verstecken: abgelehnt, weil sie freigegebene öffentliche Routen sind und ein funktionsloses Steuerelement täuschend wäre.
- Einen separaten Mobile-Header pro App einführen: abgelehnt, da die gemeinsame UI bereits die tatsächliche Darstellung besitzt.

## Konsequenzen

- Nutzer können die veröffentlichten Routen über Desktop- und Mobilnavigation erreichen.
- UI-Komponenten verwenden Theme-Tokens anstelle fest verdrahteter Hellmodusfarben.
- ADR 0011 ist superseded.

## Verifikation und Rückprüfung

- Lokaler Browser-Smoke bei 390×844 bestätigt Menü öffnen und Escape-Schließen.
- Axe/WCAG-Audit der Startseite, Blog-, Projekt- und Kontaktseite: null Verstöße nach der Token-Korrektur.
- GitHub Actions CI deckt Lint, Typecheck, Tests und Produktionsbuild ab.
