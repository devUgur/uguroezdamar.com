# ADR 0003: Sonner Toasts für Request/Response-Feedback

## Status
Angenommen (2025-03-05)

## Kontext
- Nutzer sollen unmittelbares Feedback bei Aktionen wie Speichern oder Upload erhalten, ohne nur auf Fehlermeldungen im Formular zu achten.
- Ein einheitliches Toast-System verbessert die UX und reduziert Abhängigkeit von inline Error-State.

## Entscheidung

### UI-Paket (packages/ui)
- **Sonner** wird über `pnpm ui:add sonner` im Paket `@ugur/ui` bereitgestellt (Komponente in `src/ui/sonner.tsx`).
- **Export:** `Toaster` und `toast` werden aus `@ugur/ui` exportiert (`toast` von `sonner` re-exportiert), damit Apps keine eigene Sonner-Installation brauchen.

### Portal
- **Layout:** `<Toaster position="bottom-right" richColors closeButton />` wird im Root-Layout innerhalb von `ThemeProvider` gerendert (für Theme-Anpassung).
- **Verwendung:** Bei relevanten Request/Response-Aktionen:
  - **Erfolg:** `toast.success("…")` (z. B. „Projekt gespeichert“, „Bild hochgeladen“ / „N Bilder hochgeladen“).
  - **Fehler:** `toast.error("…")` zusätzlich zu optionalem `setError` im Formular.

### Betroffene Flows
- Speichern eines Projekts (POST/PATCH): Erfolg- und Fehler-Toast.
- Bild-Upload(s) pro App: Erfolg (Einzahl/Mehrzahl) und Fehler-Toast; Multi-Upload wird unterstützt (mehrere Dateien auf einmal).

## Konsequenzen
- Konsistentes Feedback über alle relevanten Aktionen.
- Sonner ist zentrale Abhängigkeit in `@ugur/ui`; andere Apps können `toast` und `Toaster` aus demselben Paket nutzen.
