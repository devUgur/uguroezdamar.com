"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, toast } from "@ugur/ui";
import { loadAgentSettings, saveAgentSettings } from "../../actions";
import type { AgentSettingsForm } from "../../types";
import { Section } from "./ConfigParts";

const FIELD = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const SEPARATOR = "::";
const EFFORT_LABEL = { low: "niedrig (schnell, günstig)", medium: "mittel", high: "hoch (gründlich, teurer)" } as const;

interface AgentSettingsPanelProps {
  agentId: string;
  /** Called after a save, so the configuration below shows the new chain and limits. */
  onSaved: () => void;
}

/**
 * The owner's levers for one employee: which model it tries first, how hard it thinks, how many steps a run may take
 * and its daily budget. Everyone else sees the values read-only.
 */
export function AgentSettingsPanel({ agentId, onSaved }: AgentSettingsPanelProps) {
  const [form, setForm] = useState<AgentSettingsForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setForm(null);
    loadAgentSettings(agentId)
      .then((loaded) => !cancelled && setForm(loaded))
      .catch((failure: unknown) => !cancelled && setError(failure instanceof Error ? failure.message : "Einstellungen konnten nicht geladen werden."));
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (!form) return <p className="text-sm text-muted-foreground">{error ?? "Einstellungen werden geladen …"}</p>;
  const { settings, catalog, canManage } = form;
  const providers = catalog.providers.filter((provider) => provider.available && provider.models.length);

  function submit(data: FormData) {
    const choice = String(data.get("model") ?? "");
    const [provider, ...model] = choice.split(SEPARATOR);
    const number = (key: string) => {
      const value = String(data.get(key) ?? "").trim().replace(",", ".");
      return value ? Number(value) : null;
    };
    const effort = String(data.get("effort") ?? "");
    startTransition(async () => {
      const result = await saveAgentSettings(agentId, {
        model: choice && provider ? { provider, model: model.join(SEPARATOR) } : null,
        effort: effort === "low" || effort === "medium" || effort === "high" ? effort : null,
        maxSteps: number("maxSteps"),
        dailyBudgetUsd: number("dailyBudgetUsd"),
        version: settings.version,
      });
      if (!result.ok || !result.settings) {
        toast.error(result.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setForm({ ...form!, settings: result.settings });
      toast.success("Einstellungen gespeichert. Sie gelten ab dem nächsten Lauf.");
      onSaved();
    });
  }

  return (
    <Section title="Einstellungen">
      <form action={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
          Modell (Denkvermögen)
          <select name="model" defaultValue={settings.model ? `${settings.model.provider}${SEPARATOR}${settings.model.model}` : ""} disabled={!canManage} className={FIELD}>
            <option value="">Rolle entscheidet (Standard-Reihenfolge)</option>
            {providers.map((provider) => (
              <optgroup key={provider.id} label={`${provider.label}${provider.trainsOnData ? " · wertet Daten aus" : ""}`}>
                {provider.models.map((model) => (
                  <option key={model.id} value={`${provider.id}${SEPARATOR}${model.id}`}>
                    {model.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Denkaufwand
          <select name="effort" defaultValue={settings.effort ?? ""} disabled={!canManage} className={FIELD}>
            <option value="">Standard des Anbieters</option>
            {(Object.keys(EFFORT_LABEL) as (keyof typeof EFFORT_LABEL)[]).map((key) => (
              <option key={key} value={key}>
                {EFFORT_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Schritte je Lauf (4–60)
          <input name="maxSteps" type="number" min={4} max={60} step={1} defaultValue={settings.maxSteps ?? ""} placeholder="24" disabled={!canManage} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Tagesbudget in $
          <input name="dailyBudgetUsd" type="number" min={0} max={100} step={0.5} defaultValue={settings.dailyBudgetUsd ?? ""} placeholder="Standard" disabled={!canManage} className={FIELD} />
        </label>
        <div className="flex items-end">
          {canManage ? (
            <Button type="submit" disabled={pending}>
              {pending ? "Speichert …" : "Speichern"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Ändern darf nur der Owner.</p>
          )}
        </div>
      </form>
      <p className="text-xs text-muted-foreground">
        Der Denkaufwand wirkt bei Claude, OpenAI, Gemini und xAI; andere Anbieter ignorieren ihn. In Projekten mit strenger Datenrichtlinie wird ein auswertendes Modell übersprungen.
        {settings.updatedBy ? ` Zuletzt geändert von ${settings.updatedBy}.` : ""}
      </p>
    </Section>
  );
}
