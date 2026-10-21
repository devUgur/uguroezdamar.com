# Projektdokumentation

Diese Dokumentation ist die zentrale, gepflegte Referenz für Architektur, Engineering-Standards, Sicherheit, Inhalte und Betrieb von uguroezdamar.com. Der operative Umsetzungsplan steht in [`../PLAN.md`](../PLAN.md); Audit-Beobachtungen stehen im Audit-Archiv und gelten nicht automatisch als verifizierter Ist-Zustand.

## Dokumentenkarte

| Bereich | Inhalt |
| --- | --- |
| [Architektur](architecture/README.md) | Systemkontext, Anwendungen, Pakete, Abhängigkeitsregeln, Architekturentscheidungen |
| [ADRs](architecture/decisions/) | datierte Architekturentscheidungen und deren Status |
| [Engineering-Qualität](engineering/quality.md) | Lint, Typecheck, Tests, Guards, CI und Merge-Gates |
| [Abhängigkeitsmatrix](engineering/dependency-matrix.md) | unterstützte Laufzeiten, Paketstände, Upgrade-Entscheidungen und Pflege |
| [Sicherheit](security/README.md) | Authentifizierung, Autorisierung, Daten, Uploads und Secrets |
| [Content & Portfolio](product/content-and-portfolio.md) | Inhaltsmodell, Publish-Entscheidung und redaktionelle Qualität |
| [Secrets & Entwicklungsumgebung](operations/secrets.md) | Infisical, Secrets-Manifest, `pnpm ugur`-CLI, Datenbank-Befehle, Rotation |
| [Cloudflare und Kontotrennung](operations/cloudflare.md) | Wrangler-Profile je Repository, DNS-Zuständigkeit, Vercel-Cutover und minimale Berechtigungen |
| [Hosting, Preview und Release](operations/preview.md) | Vercel-Projekte, Vorschau je Pull Request, Health-Endpunkt, Smoke-Lauf, Freigabe in die Produktion |
| [Betrieb & Recovery](operations/release-and-recovery.md) | Build, Release, Rollback, Backups und Incident-Ablauf |
| [Audits](audits/2026-10-12-code-and-architecture-audit.md) | Befunde, Quellen und Verifikationsstatus des Audits vom 12.10.2026 |

## Verbindlichkeit und Pflege

- **Normative Vorgaben** stehen in den Engineering-, Security- und Operations-Dokumenten. Begriffe wie „muss“ beschreiben verbindliche Anforderungen.
- **Roadmap-Einträge** in `PLAN.md` sind geplante Arbeit und werden erst nach Umsetzung und Prüfung als erledigt markiert.
- **Audit-Feststellungen** enthalten Datum und Beleglage. Vor einer Änderung wird geprüft, ob sie noch zutreffen.
- **Architekturentscheidungen** mit langfristigen Folgen werden als ADR mit Status, Kontext, Entscheidung und Konsequenzen dokumentiert. Überholte ADRs bleiben als „superseded“ auffindbar.
- Jede Änderung an Deployment, Datenmodell, Authentifizierung, Content-Publishing oder Paketgrenzen aktualisiert die betroffenen Dokumente im selben Änderungs-PR.
- Dokumentation beschreibt den realen Zustand. Keine unbelegten Leistungs-, Sicherheits- oder Verfügbarkeitsversprechen.

## Empfohlene Struktur

```text
docs/
├── README.md
├── audits/                 # datierte Prüfungen und Nachweise
├── architecture/           # Systemübersicht
│   └── decisions/          # ADRs (Architecture Decision Records)
├── engineering/            # Entwicklungs- und Qualitätsstandards
├── operations/             # Release, Betrieb und Recovery
├── product/                # Inhalte, Zielgruppen und Portfolio
└── security/               # Sicherheitsanforderungen und Verfahren
```

Neue Dokumente erhalten einen klaren Zweck, einen Besitzer (Rolle oder Team), einen Aktualisierungsanlass und Links zu verwandten Dokumenten. Duplikate und parallel gepflegte Wahrheiten werden vermieden.
