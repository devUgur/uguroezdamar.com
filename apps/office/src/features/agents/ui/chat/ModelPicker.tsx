"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue, toast } from "@ugur/ui";
import { chooseModel } from "../../actions";
import type { ModelCatalog, ModelChoice } from "../../types";

interface ModelPickerProps {
  threadId: string;
  value: ModelChoice | null;
  catalog: ModelCatalog;
  /** The agent's alias, shown for the default choice. */
  defaultAlias: string;
  /** Strict data policy in play: providers that may evaluate prompts are shown but cannot be chosen. */
  privateContent: boolean;
  onChanged: () => void;
}

const DEFAULT = "default";
const SEPARATOR = "::";

/** Provider and model for this thread. Only providers with a key list their models; keys are set under /models. */
export function ModelPicker({ threadId, value, catalog, defaultAlias, privateContent, onChanged }: ModelPickerProps) {
  const [pending, startTransition] = useTransition();
  const current = value ? `${value.provider}${SEPARATOR}${value.model}` : DEFAULT;

  function change(next: string) {
    const [provider, model] = next === DEFAULT ? [] : next.split(SEPARATOR);
    startTransition(async () => {
      const result = await chooseModel(threadId, provider && model ? { provider, model } : null);
      if (!result.ok) toast.error(result.error ?? "Modell konnte nicht gesetzt werden.");
      else onChanged();
    });
  }

  return (
    <Select value={current} onValueChange={change} disabled={pending}>
      <SelectTrigger className="h-9 w-64 rounded-md" aria-label="Modell">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={DEFAULT}>Automatisch ({defaultAlias})</SelectItem>
        </SelectGroup>
        {catalog.providers
          .filter((provider) => provider.available && provider.models.length)
          .map((provider) => (
            <SelectGroup key={provider.id}>
              <SelectLabel>{provider.label}</SelectLabel>
              {provider.models.map((model) => (
                <SelectItem key={model.id} value={`${provider.id}${SEPARATOR}${model.id}`} disabled={privateContent && provider.trainsOnData}>
                  {provider.shortLabel} · {model.label}
                  {provider.trainsOnData ? (
                    <span className="ml-2 text-xs text-muted-foreground">{privateContent ? "gesperrt: strenge Datenrichtlinie" : "wertet Daten aus"}</span>
                  ) : null}
                  {model.note ? <span className="ml-2 text-xs text-muted-foreground">{model.note}</span> : null}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        {catalog.providers.some((provider) => !provider.available) ? (
          <SelectGroup>
            <SelectLabel className="font-normal text-muted-foreground">Weitere Anbieter: Schlüssel unter „Modelle &amp; Schlüssel“ hinterlegen</SelectLabel>
          </SelectGroup>
        ) : null}
      </SelectContent>
    </Select>
  );
}
