# Office Brain – Architekturplanung

- Status: Agentenchat, synchronisierte Präsenz, Aufgabenboard, Repository-Projekte und owner-geschützte Organisationsverwaltung sind umgesetzt; Orchestrierung ist geplant
- Stand: 26.11.2026
- Zweck: Zielbild und gestufter Plan für ein webbasiertes Office aus menschlichem Owner, spezialisierten Agenten, Aufgaben, Werkzeugen und gemeinsamem Wissen

## Ziel

Das Admin-Portal soll später ein sicheres Kontrollzentrum erhalten, in dem der Owner:

- Mitarbeiter/Agenten, Rollen, Fähigkeiten und Verfügbarkeit sieht;
- Aufgaben verteilt und Fortschritt, Übergaben sowie Ergebnisse nachvollzieht;
- Beziehungen zwischen Menschen, Agenten, Aufgaben, Werkzeugen und Wissenseinträgen in einer Graphansicht erkundet;
- eine kuratierte Wissensbibliothek mit Quellen, Versionen und Berechtigungen pflegt;
- Modelle und Anbieter austauscht, ohne die fachlichen Abläufe neu zu schreiben;
- Kosten, Freigaben und Grenzen pro Aufgabe kontrolliert.

„Brain“ meint hier die sichtbare Zusammenführung von Arbeitsabläufen und Wissen. Es soll keine unkontrollierte, autonome Instanz mit unbegrenztem Zugriff werden.

## Leitentscheidungen für die Planung

1. **Bestehende Grenzen gelten:** Das Portal läuft auf Vercel und nutzt Neon für bestehende Portal-Daten. Die Agentenplattform läuft separat gemäß ADR 0024 auf Cloudflare mit D1 und Durable Objects. Infisical verwaltet die Portal-Secrets; für `apps/api` gelten die in ADR 0024 beschriebenen GitHub-Actions-Secrets. Kein neuer bezahlter Dienst ohne belegten Engpass.
2. **Datenquelle folgt der Domäne:** Aufgaben, Zuweisungen und agentenbezogene Ereignisse, die direkt Agentenläufe steuern, liegen gemäß ADR 0026 im API-Control-Plane (D1). Bestehende Portal-Daten bleiben in Neon. Dieselben Fachdaten werden nicht in beiden Systemen gehalten.
3. **Klare App-Grenzen:** Das Portal liefert UI, Session-Prüfung und Server-Adapter. `apps/api` validiert und persistiert Agentenarbeit. `packages/server` bleibt für die bestehenden Neon-Domänen zuständig und erhält keine direkte Abhängigkeit auf die Worker-Datenbank.
4. **Modelle hinter einer eigenen Auswahlgrenze:** Features fragen ein Modellprofil wie fast, balanced oder reasoning an. Nur die zentrale Laufzeit kennt konkrete Provider- und Modell-IDs.
5. **Sichtbare Grenzen statt freier Autonomie:** Agenten bekommen explizite Werkzeuge, Datenbereiche, Zeit-/Schritt-/Kostenlimits und Abbruchmöglichkeiten. Externe oder schreibende Aktionen warten standardmäßig auf menschliche Freigabe.
6. **Wissen ist nicht Gesprächsgedächtnis:** Quellenwissen wird versioniert und belegt. Kurzlebiger Gesprächs- und Run-Kontext unterliegt einer eigenen Aufbewahrung.
7. **Planung und Umsetzung bleiben getrennt:** Die folgenden Dateien beschreiben ein Zielbild. Schema, Secrets, Libraries, Deployment und produktive Daten werden erst durch eigene ADRs, Issues und freigegebene PRs geändert.

## Bestehende Agentenplattform

Das heutige `/agents`-Büro und `/chat` laufen bereits auf der in [ADR 0024](../decisions/0024-agent-platform-on-cloudflare.md) beschriebenen Portal-/Cloudflare-Architektur. [ADR 0025](../decisions/0025-synchronisierte-agentenpraesenz.md) ergänzt einen gemeinsamen, persistenten Bewegungszustand im Cloudflare Durable Object. D1 hält Agentenereignisse und persistierte Work-Items; die Bürobewegung wird daraus serverautoritatv abgeleitet. Kamera, Auswahl und Darstellungsmodus bleiben lokal je Browser. [ADR 0026](../decisions/0026-agent-work-management.md) legt den Work-Control-Plane fest.

Das Aufgabenboard `/work`, der Work-Control-Plane, der Organisationskatalog und die explizite QA-Übergabe an einen getrennten read-only Reviewer sind umgesetzt. Chef-/QA-Übergaben und Ergebnis werden als D1-Events protokolliert; Kosten werden in `/costs` aus Modellaufrufen geschätzt. Aufgaben lassen sich owner-gestützt mit GitHub Issues synchronisieren; Projects V2 wartet auf App-Projektrechte und Feldentscheidung. `/organization/manage` ergänzt owner-geschützte, versionierte Profiländerungen, eingeschränkte Pflege registrierter Instanzen und ein D1-Auditlog gemäß ADR 0030. Runtime-Policy, Tools und neue ausführbare Agenten bleiben codeverwaltet. Automatische Planung/Delegation und unabhängige Workstations bleiben begrenzt; ihre Freigabe richtet sich nach der [Roadmap](roadmap.md), ADR 0027, ADR 0028 und ADR 0030.

Die Portfolio-Ebene `/portfolio` gruppiert Produktprojekte und bereits registrierte Repository-Freigaben gemäß [ADR 0034](../decisions/0034-portfolio-projects-and-repository-access.md). Ein lokaler Graphify-Pilot liegt in [Betriebsdoku](../../operations/graphify.md); die generierten Daten bleiben lokal und werden nicht an einen externen Dienst übertragen.

## Dokumente

- [Systementwurf](system-architecture.md) — Komponenten, Datenfluss, Grenzen und konzeptionelle Domänen
- [Technologieauswahl](technology-options.md) — Empfehlungen, Alternativen und spätere Entscheidungstore
- [Sicherheit und Kosten](security-and-costs.md) — Rechte, Freigaben, Datenklassen, Observability und Budgetkontrollen
- [Roadmap](roadmap.md) — kleine, überprüfbare Umsetzungsphasen mit Abnahmekriterien
- [Geplante ADRs](decisions/README.md) — Entscheidungen, die vor Implementierung einzeln getroffen werden müssen

## Quellen und Gültigkeit

Die Technologiekandidaten wurden am 24.11.2026 anhand ihrer offiziellen Dokumentation geprüft. Anbieterprodukte, Preise und APIs ändern sich; vor jeder Implementierungsentscheidung wird die Quelle erneut geprüft. Externe Quellen und der Unterschied zwischen Vorschlag und bereits bestehender Infrastruktur sind in den jeweiligen Planungsseiten angegeben.
