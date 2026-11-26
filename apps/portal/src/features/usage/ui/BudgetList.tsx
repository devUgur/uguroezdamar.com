import { cn } from "@ugur/core";
import { usd } from "../format";
import type { AgentBudget } from "../types";

/** Today's spend of each agent against its daily budget; from 80 percent the bar turns into a warning. */
export function BudgetList({ budgets }: { budgets: AgentBudget[] }) {
  if (!budgets.length) return <p className="text-sm text-muted-foreground">Keine aktiven Mitarbeiter.</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {budgets.map((budget) => {
        const width = Math.min(100, Math.round(budget.ratio * 100));
        return (
          <li key={budget.agentId} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{budget.agent}</span>
              <span className={cn("tabular-nums", budget.warning ? "text-destructive" : "text-muted-foreground")}>
                {usd(budget.spentUsd)} von {usd(budget.budgetUsd)}
              </span>
            </div>
            <progress
              value={width}
              max={100}
              aria-label={`Tagesbudget ${budget.agent}`}
              className={cn(
                "h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full",
                budget.warning ? "[&::-moz-progress-bar]:bg-destructive [&::-webkit-progress-value]:bg-destructive" : "[&::-moz-progress-bar]:bg-primary [&::-webkit-progress-value]:bg-primary",
              )}
            />
          </li>
        );
      })}
    </ul>
  );
}
