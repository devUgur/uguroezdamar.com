# ADR 0001: shadcn/Radix Select im UI-Paket

## Status
Angenommen (2025-03-05)

## Kontext
- Im Admin-Bereich (z. B. Projekt anlegen/bearbeiten) wurde das Status-Feld (Draft / Published / Archived) mit einem nativen `<select>` umgesetzt.
- Gewünscht war ein modernes, einheitliches Dropdown (shadcn-kompatibel) und die Möglichkeit, weitere shadcn-Komponenten zentral im Monorepo zu nutzen.

## Entscheidung
- **Select-Komponente** nach shadcn-Vorbild (Radix UI Select) im **shared UI-Paket** `packages/ui` ergänzt.
- Abhängigkeit: `@radix-ui/react-select` (nur im UI-Paket).
- Neue Datei: `packages/ui/src/components/ui/select.tsx` mit Export von `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator`.
- **Projektform (Portal):** Das Status-Feld „Publishing“ nutzt die neue Select-Komponente statt des nativen `<select>`.

## Konsequenzen
- Einheitliches, zugängliches Dropdown für Status und künftige Select-Felder.
- Weitere shadcn-artige Komponenten können in `packages/ui/src/components/ui/` ergänzt und über `@ugur/ui` exportiert werden.
- Die CLI (`pnpm ui:add`) war bei der Installation (pnpm EPERM) fehlgeschlagen; die Select-Komponente wurde manuell angelegt und an die bestehende Design-Sprache (rounded-xl, border, focus-ring) angepasst.
