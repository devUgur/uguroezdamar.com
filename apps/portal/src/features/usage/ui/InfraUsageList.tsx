import { cn } from "@ugur/core";
import type { InfraUsage } from "../types";

const number = new Intl.NumberFormat("de-DE");

/** Today's Cloudflare usage of the agent platform against the daily limits; from 70 percent a measure warns. */
export function InfraUsageList({ usage }: { usage: InfraUsage | null }) {
  if (!usage?.available) return <p className="text-sm text-muted-foreground">{usage?.reason ?? "Keine Verbrauchsdaten."}</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {usage.measures.map((measure) => {
        const width = Math.min(100, Math.round(measure.share * 100));
        return (
          <li key={measure.key} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{measure.label}</span>
              <span className={cn("tabular-nums", measure.warn ? "text-destructive" : "text-muted-foreground")}>
                {number.format(measure.used)} von {number.format(measure.limit)}
              </span>
            </div>
            <progress
              value={width}
              max={100}
              aria-label={`${measure.label} heute`}
              className={cn(
                "h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full",
                measure.warn ? "[&::-moz-progress-bar]:bg-destructive [&::-webkit-progress-value]:bg-destructive" : "[&::-moz-progress-bar]:bg-primary [&::-webkit-progress-value]:bg-primary",
              )}
            />
          </li>
        );
      })}
    </ul>
  );
}
