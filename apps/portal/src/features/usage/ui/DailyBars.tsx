import { tokens, usd } from "../format";
import type { UsageDay } from "../types";

/**
 * Cost per day as a plain bar list: readable without a chart library, with exact values next to each bar.
 * The bar width uses the progress element, so no inline style is needed.
 */
export function DailyBars({ days }: { days: UsageDay[] }) {
  if (!days.length) return <p className="text-sm text-muted-foreground">Keine Aufrufe im Zeitraum.</p>;
  const max = Math.max(...days.map((day) => Number(day.costUsd)), 0.000001);
  return (
    <ol className="flex flex-col gap-1">
      {days.map((day) => (
        <li key={day.day} className="grid grid-cols-[6rem_1fr_7rem_8rem] items-center gap-3 text-sm">
          <span className="tabular-nums text-muted-foreground">{new Date(`${day.day}T00:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</span>
          <progress
            value={Math.round((Number(day.costUsd) / max) * 100)}
            max={100}
            aria-label={`Kosten am ${day.day}`}
            className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
          />
          <span className="text-right tabular-nums">{usd(day.costUsd)}</span>
          <span className="text-right tabular-nums text-muted-foreground">
            {day.calls} Aufrufe · {tokens(day.tokensIn)}
          </span>
        </li>
      ))}
    </ol>
  );
}
