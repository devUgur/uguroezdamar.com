# ADR 0004: Selected Work (Homepage) – apps, images, Galerie

## Status
Angenommen (2025-03-05)

## Kontext
- Die Sektion „02 — Selected Work“ auf der Startseite (localhost:3000) soll die neue Projektstruktur abbilden: `apps[]` und `images[]` (Projekt- und App-Ebene).
- Alle Bilder sollen sichtbar sein; alle verfügbaren Informationen (Apps, Tech, Links, Tags) effizient und modern dargestellt werden.

## Entscheidung

### Datenmodell (Site)
- **SelectedWorkProject** erweitert um: `imagesByKind: Partial<Record<DeviceType, WorkImage[]>>`, `apps: WorkApp[]`, `links`, `tech`, `tags`.
- **Work.tsx:** `imagesByKind`: pro Device-Type (web/mobile/desktop/cli) die Liste der Bilder (aus `project.images` mit passendem `kind` + Bilder der App mit diesem `kind`). Fallback: ein Eintrag mit `coverImageUrl`/`previewImageUrl`. `deviceImages` wie zuvor für erste URL pro Typ. Jahr aus `yearFrom`/`yearTo`/`ongoing`/`publishedAt`.

### UI (WorkClient)
- Zwei Spalten (lg): links Meta (Types, Titel, Beschreibung, Jahr/Role/Stack, Tech-Tags, Apps, Links), rechts **ein Hauptbild** im Device-Mockup (wie zuvor).
- **Nur ein Bild sichtbar:** Das angezeigte Bild hängt vom gewählten App-Kind (Web/Mobile/Desktop/CLI) ab; Anzeige in der gewohnten Mockup-Form (Browser, Handy, Terminal etc.).
- **Diashow/Stepper:** Pro App-Kind können mehrere Bilder existieren. Der Nutzer sieht nur das aktuelle Bild im Mockup und kann mit Vor/Zurück-Pfeilen und Punkten (Dots) durch die Bilder dieses Typs blättern. Anzeige „1 / n“ optional.
- Wenn nur ein Bild pro Typ: kein Stepper. WorkGallery (Grid/Lightbox) bleibt optional z. B. für Projekt-Detailseiten.

### Best Practices
- Responsives Grid/Strip; Accessibility (focus, aria-label, dialog); Next/Image mit sinnvollen `sizes`; keine Löschung bestehender Dateien, nur Erweiterung.

## Konsequenzen
- Homepage zeigt alle Projekt- und App-Bilder sowie Apps/Tech/Links konsistent.
- MDX-Adapter setzt `apps: []` für einheitliches Shape; MongoDB-Projekte mit `apps`/`images` werden voll genutzt.
