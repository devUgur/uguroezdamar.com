---
name: modal-llm
description: Eigene LLMs auf Modal für die Agenten-API von uguroezdamar.com bereitstellen, ändern, testen oder abschalten. Verwenden, wenn es um apps/api/modal/llm.py, ein neues Open-Weight-Modell, GPU-Kosten, Kaltstarts oder den Anbieter "modal" in der Modellauswahl geht.
---

# Modelle auf Modal

Die Agenten-API (`apps/api`) kann neben Gemini und Workers AI eigene Open-Weight-Modelle auf Modal nutzen. Sie laufen als vLLM-Server mit OpenAI-kompatibler API und Tool-Calls.

## Feste Rahmen

- **Workspace `ugur44ist`**, nie `viralsync-io`. Das globale Modal-Profil wird nicht umgestellt; jeder Befehl läuft mit `MODAL_PROFILE=ugur44ist` (oder `--profile ugur44ist`).
- **Kosten:** GPU-Zeit wird pro Sekunde abgerechnet; nach `SCALEDOWN` (5 min) ohne Anfrage fährt die GPU herunter. Modal-Modelle stehen in keiner Alias-Kette: Sie laufen nur, wenn ein Thread sie ausdrücklich wählt. Das Tagesbudget der Agenten erfasst GPU-Zeit nicht; Kosten zeigt das Modal-Dashboard.
- **Zugang:** Jeder Server verlangt den API-Schlüssel aus dem Modal-Secret `uguroezdamar-llm` (`LLM_API_KEY`). Denselben Wert sendet die API als GitHub-Secret `MODAL_LLM_API_KEY`. Werte nie ausgeben, nie in Argumente oder Dateien im Repo schreiben.
- **Tool-Calls sind Pflicht.** Ein Modell ohne funktionierenden `--tool-call-parser` taugt nicht für den Agenten.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `apps/api/modal/llm.py` | Modal-App `uguroezdamar-llm`, eine Funktion je Modell (`ministral`, `gemma`) |
| `apps/api/src/models/config.ts` | Anbieter `modal`: je Modell `id` (= von vLLM bedienter Name), `baseUrl`, `label`, `note` |
| `.github/workflows/api-deploy.yml` | reicht `MODAL_LLM_API_KEY` an den Worker |

URL-Schema: `https://ugur44ist--uguroezdamar-llm-<funktion>.modal.run/v1`.

## Abläufe

**Deployen:** `MODAL_PROFILE=ugur44ist modal deploy apps/api/modal/llm.py`. Der erste Build (CUDA plus vLLM) dauert einige Minuten. Modal verlangt für L40S und H100 ein Zahlungsmittel im Workspace.

**Freischalten:** Erst nach erfolgreichem Test `MODAL_ENABLED` in `apps/api/wrangler.jsonc` (oben für Produktion, `env.dev` für Dev) auf `"true"` setzen. Vorher erscheint Modal in der Modellauswahl als „nicht verfügbar“ und der Router überspringt es.

**Testen** (kostet GPU-Zeit, also kurz halten): `GET <url>/health` ohne Schlüssel, danach `POST <url>/v1/chat/completions` mit `Authorization: Bearer <Schlüssel>` und einem Werkzeug in `tools`. Den Schlüssel dafür nur im Prozess halten, zum Beispiel aus einer Datei in `RUNNER_TEMP` oder im Scratchpad, die danach gelöscht wird.

**Neues Modell:**
1. Modell mit Tool-Call-Parser in vLLM wählen; offizielle Modal-Beispiele (`modal.com/docs/examples`) haben Vorrang vor Community-Code.
2. GPU nach Gewichten wählen: BF16 braucht etwa 2 Byte je Parameter plus KV-Cache. L40S (48 GB) für ~8B, H100 (80 GB) für ~26B-MoE.
3. Neue Funktion in `llm.py`, Eintrag in `config.ts`, deployen, testen, im Portal-Chat wählen.

**Abschalten:** `MODAL_PROFILE=ugur44ist modal app stop uguroezdamar-llm` und den Anbieter aus `config.ts` entfernen. Das ist eine Entscheidung des Owners.
