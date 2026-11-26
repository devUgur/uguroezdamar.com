# Graphify – lokaler Repository-Pilot

Graphify erzeugt einen codebasierten Wissensgraphen für genau dieses Repository. Der Graph ist ein abgeleitetes Artefakt, kein Ersatz für Quellcode, Tests, ADRs oder GitHub als führende Quelle.

## Aktueller Stand

- Pilot: `uguroezdamar.com` (nur dieses Repository)
- Graphify: `0.9.120`, geprüft am 26.11.2026
- Ausführung: lokal mit `uv`; `graphify extract . --code-only`
- Ausgabe: `graphify-out/` (lokal, ignoriert von Git)
- Datenverarbeitung: Code-only-Extraktion, kein Modell-API-Key und kein Upload an Graphify Cloud
- Lauf am 26.11.2026: 2.523 Knoten, 5.948 Beziehungen, 116 Communities

## Einrichtung

Voraussetzungen laut offizieller Dokumentation: Windows, `uv` und Python 3.11.5 bis 3.14. Die Installation von Graphify bleibt in einer isolierten `uv`-Tool-Umgebung:

```powershell
uv tool install --python 3.12 "graphifyy[sql]==0.9.120"
```

Wenn bereits eine andere Graphify-Version installiert ist, prüfe zuerst `uv tool list`. Aktualisiere das Tool auf denselben festgehaltenen Stand, bevor du einen Graphen erzeugst.

## Graph erzeugen

Im Repository-Root:

```powershell
graphify extract . --code-only
```

Der Graph wird aus der lokalen Codebasis erzeugt. `graphify-out/` wird nicht committet und kann lokal neu erzeugt werden. Graphify-Dateien sind nicht vertrauenswürdige Analysehinweise; vor Änderungen gelten weiterhin die realen Quellen und Repository-Regeln.

Auf Windows meldete Graphify `0.9.120` zwei nicht extrahierte `turbo.json`-Dateien. Ein Barrel-Modul lieferte keine Symbole; außerdem meldete der Lauf mehrere kollidierende `ref_*`-Paketknoten. Die SQL-Migrationen wurden mit dem optionalen Parser verarbeitet. Der erzeugte Graph ist daher ein Pilot, keine vollständige Abdeckung. Diese Warnungen müssen bei einer späteren Plattformentscheidung erneut bewertet werden.

## Grenzen und nächster Entscheidungspunkt

## Gemeinsamer Codex-MCP-Zugang

Die projektweite Codex-Konfiguration liegt in .codex/config.toml. Sie verweist auf den offiziellen Graphify OAuth-Server und setzt devUgur/uguroezdamar.com als Repository-Standard. Jedes Teammitglied schließt die Anmeldung mit dem eigenen Graphify-Konto im Browser ab. Der ausgewählte Workspace muss das Repository enthalten und indexiert haben. Die Konfiguration enthält keine Zugangsdaten und erzeugt keinen Graphify-Index.

Der gehostete Dienst verarbeitet die dort indexierten Repository-Inhalte. Graphify-Plan, Workspace-Zugriff, Datenschutzbedingungen und die Freigabe privater Inhalte sind vor dem Teilen mit weiteren Mitgliedern zu prüfen. Portal-Agenten sind nicht automatisch mit diesem MCP verbunden.

- Kein Index privater Fremd-Repositories im lokalen OSS-Pilot.
- Keine automatische Übertragung des lokalen OSS-Graphen an Graphify Cloud und keine Portal-Agent-Worker-Anbindung; Codex nutzt den gehosteten MCP-Index.
- Keine CI-Indexierung, bis Nutzen, Ausschlussregeln, Branch-/Commit-Bindung und Umgang mit privaten Inhalten geprüft wurden.
- Die OSS-Version kann den Graph lokal per stdio oder als geschützten Streamable-HTTP-Server bereitstellen. HTTP verlangt einen API-Key; das bleibt ein lokaler Fallback.
- Der Graphify-Release `0.9.120` ergänzt unter anderem ein `affected`-MCP-Tool. Das allein rechtfertigt noch keine zusätzliche Laufzeit im Cloudflare-Worker.

Nach einem Vergleich mit konkreten Entwicklungsaufgaben wird entschieden, ob der Pilot in weitere Repositories übertragen wird. Eine zentrale API-Anbindung braucht ein eigenes ADR, Zugriffsscope, Datenaufbewahrung und Betriebs-/Kostenentscheidung.

## Offizielle Quellen

- [Graphify-Installation](https://docs.graphify.com/open-source/installation)
- [Graphify OSS MCP-Server](https://docs.graphify.com/open-source/mcp-server)
- [Graphify CLI Releases](https://github.com/Graphify-Labs/graphify/releases)
- [Graphify MCP für Codex](https://graphify.com/mcp)
- [Graphify v0.9.120](https://github.com/Graphify-Labs/graphify/releases/tag/v0.9.120)
