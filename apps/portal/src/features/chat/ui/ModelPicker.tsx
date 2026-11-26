"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue, toast } from "@ugur/ui";
import { chooseModel } from "../actions";
import type { ModelCatalog, ModelChoice } from "../types";

interface ModelPickerProps {
  threadId: string;
  value: ModelChoice | null;
  catalog: ModelCatalog;
  /** The agent's alias, shown for the default choice. */
  defaultAlias: string;
}

const DEFAULT = "default";
const SEPARATOR = "::";

/** Provider and model for this thread. Providers without a key stay visible but cannot be chosen. */
export function ModelPicker({ threadId, value, catalog, defaultAlias }: ModelPickerProps) {
  const [pending, startTransition] = useTransition();
  const current = value ? `${value.provider}${SEPARATOR}${value.model}` : DEFAULT;

  function change(next: string) {
    const [provider, model] = next === DEFAULT ? [] : next.split(SEPARATOR);
    startTransition(async () => {
      const result = await chooseModel(threadId, provider && model ? { provider, model } : null);
      if (!result.ok) toast.error(result.error ?? "Modell konnte nicht gesetzt werden.");
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
          .filter((provider) => provider.models.length)
          .map((provider) => (
            <SelectGroup key={provider.id}>
              <SelectLabel>
                {provider.label}
                {provider.available ? "" : " – kein Schlüssel"}
              </SelectLabel>
              {provider.models.map((model) => (
                <SelectItem key={model.id} value={`${provider.id}${SEPARATOR}${model.id}`} disabled={!provider.available}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
      </SelectContent>
    </Select>
  );
}
