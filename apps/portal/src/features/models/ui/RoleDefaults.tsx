import { Button } from "@ugur/ui";
import { setRoleModel } from "../actions";
import type { Catalog } from "../types";

const ROLES: Record<string, string> = {
  "chef-smart": "Chef-Agent und QA-Reviewer",
  coder: "Entwickler-Rollen",
  "worker-cheap": "Hilfsaufgaben (günstig)",
};

/** The model each role tries first. Without a choice the built-in order applies; unavailable providers are skipped. */
export function RoleDefaults({ catalog, canManage }: { catalog: Catalog; canManage: boolean }) {
  const available = catalog.providers.filter((provider) => provider.available && provider.models.length);
  return (
    <ul className="flex flex-col gap-3">
      {Object.entries(catalog.aliases).map(([alias, chain]) => {
        const chosen = catalog.defaults.find((entry) => entry.alias === alias);
        const order = chain
          .map((target) => `${catalog.providers.find((provider) => provider.id === target.provider)?.shortLabel ?? target.provider} ${target.model}`)
          .join(" → ");
        return (
          <li key={alias} className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <div>
              <h3 className="font-medium">
                {ROLES[alias] ?? alias} <span className="font-mono text-xs text-muted-foreground">{alias}</span>
              </h3>
              <p className="text-xs text-muted-foreground">Eingebaute Reihenfolge: {order}</p>
            </div>
            <form action={setRoleModel} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="alias" value={alias} />
              <label className="sr-only" htmlFor={`role-${alias}`}>
                Standardmodell für {alias}
              </label>
              <select
                id={`role-${alias}`}
                name="choice"
                defaultValue={chosen ? `${chosen.provider}::${chosen.model}` : ""}
                disabled={!canManage}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Eingebaute Reihenfolge</option>
                {available.map((provider) => (
                  <optgroup key={provider.id} label={`${provider.label}${provider.trainsOnData ? " (wertet Daten aus)" : ""}`}>
                    {provider.models.map((model) => (
                      <option key={model.id} value={`${provider.id}::${model.id}`}>
                        {model.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {canManage ? <Button type="submit">Übernehmen</Button> : null}
            </form>
          </li>
        );
      })}
    </ul>
  );
}
