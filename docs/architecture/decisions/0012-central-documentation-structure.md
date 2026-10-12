# ADR 0012: Zentrale technische Dokumentation unter `docs/`

- Status: angenommen
- Datum: 2026-10-12
- Beteiligte: Projektverantwortliche

## Kontext

Architekturentscheidungen lagen unter `.cursor/adr/`, während Betriebs-, Sicherheits- und Qualitätsplanung erst aufgebaut wurde. Dadurch war nicht klar, wo die verbindliche Projektdokumentation lebt und ob Editor-/KI-Kontext als dauerhafte technische Quelle gilt.

## Entscheidung

- `docs/` ist der zentrale Ort für gepflegte, toolunabhängige Projekt- und Engineering-Dokumentation.
- ADRs liegen unter `docs/architecture/decisions/` und behalten ihre Nummern sowie historischen Status.
- `PLAN.md` ist die operative Roadmap. `docs/audits/` enthält datierte Befunde und Beleggrenzen.
- `.cursor/` und `.github/instructions/` bleiben tool-/editorbezogene Hilfen und müssen auf `docs/` verweisen, statt eigene widersprüchliche Regeln zu etablieren.
- Der frühere Dokumentationskompass (ADR 0008) bleibt als historische Entscheidung erhalten, gilt aber für die Ablageorte als abgelöst.

## Alternativen

- ADRs unter `.cursor/adr/` belassen: abgelehnt, da sie an ein konkretes Tool gebunden sind und nicht alle Projektrollen abdecken.
- Zwei gleichberechtigte Dokumentationsorte pflegen: abgelehnt, da dies zu konkurrierenden Wahrheiten führt.

## Konsequenzen

- Alle bestehenden ADRs sind nach `docs/architecture/decisions/` verschoben; ihre Nummern und Inhalte bleiben erhalten.
- README und Dokumentationsindex verweisen auf den neuen kanonischen Ort.
- Historische ADRs können weiterhin alte Pfade benennen, sofern klar ist, dass sie ihren damaligen Zustand beschreiben.
- Größere Inhalte werden schrittweise aus Tool-Konfigurationen in die zentrale Dokumentation überführt.

## Verifikation und Rückprüfung

- Repository-Links auf ADRs zeigen auf `docs/architecture/decisions/`.
- Bei neuer Dokumentation wird geprüft, ob sie toolunabhängig ist und unter `docs/` gehört.
- Diese Entscheidung wird bei einer grundlegenden Änderung der Repository-Governance erneut geprüft.
