# ADR 0008: Documentation Compass and Root Cleanup

## Status
Angenommen (2025-03-05)

## Kontext
Das Repo hatte mehrere Meta-Ebenen (ADRs, README, `.github/instructions`, `.cursor/`, optimization-Review, Guards). Für neue Leser und für AI/Tooling war unklar: Was liest man zuerst? Was ist bindend? Was ist historisch? Zusätzlich lag `optimization.md` im Repo-Root und der Restordner `work-items` existierte noch.

## Entscheidung

### 1. Dokumentations-Kompass im README
- **Read first:** README und ADR 0006 (Domain-Glossar, Boundaries, Content Source-of-Truth).
- **Binding:** ESLint und ADRs (`.cursor/adr/`).
- **Tool-/AI-spezifisch:** `.cursor/`, `.github/instructions` – überschreiben die bindenden Regeln nicht.
- **Historisch/Kontext:** z. B. `.cursor/optimization-review.md` – Kontext für Entscheidungen, keine operativen Vorgaben.

### 2. Systemüberblick (60 Sekunden) im README
Kompakte Sektion beantwortet: Was ist site/portal? Wo lebt Content? File-based vs. DB? Was ist kanonisch? Verweis auf ADR 0006 für die vollständige Content-Matrix.

### 3. optimization.md → `.cursor/optimization-review.md`
Die Architektur-Review (8/10, Empfehlungen) wird als Kontext-Dokument in `.cursor/` geführt, nicht mehr im Root. Root bleibt bewusst kuratiert.

### 4. Restordner `work-items` entfernt
Der physische Ordner `apps/site/src/features/work-items` (inkl. leerem `ui/`) wurde entfernt. Feature-Name ist ausschließlich `selected-work` (vgl. ADR 0007).

## Konsequenzen
- Onboarding und Außenwirkung: Klare Reihenfolge und Trennung von bindend vs. Kontext.
- Root: Weniger lose Top-Level-Dateien; optimization-Review bleibt als Referenz unter `.cursor/` erhalten.
