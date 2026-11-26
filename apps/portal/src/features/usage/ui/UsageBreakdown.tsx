import { ms, percent, tokens, usd } from "../format";
import type { UsageGroup } from "../types";

interface UsageBreakdownProps {
  title: string;
  rows: UsageGroup[];
  /** Total cost, for each row's share. */
  totalUsd: number;
}

/** Cost, calls, tokens, cache share and latency per agent, model, project or provider. */
export function UsageBreakdown({ title, rows, totalUsd }: UsageBreakdownProps) {
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label={title}>
      <h3 className="font-medium">{title}</h3>
      {rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 text-right font-medium">Kosten</th>
                <th className="px-3 py-2 text-right font-medium">Anteil</th>
                <th className="px-3 py-2 text-right font-medium">Aufrufe</th>
                <th className="px-3 py-2 text-right font-medium">Tokens ein/aus</th>
                <th className="px-3 py-2 text-right font-medium">Cache</th>
                <th className="px-3 py-2 text-right font-medium">Ø Latenz</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key ?? "none"} className="border-t border-border">
                  <td className="max-w-56 truncate px-3 py-2 font-mono text-xs">{row.label ?? row.key ?? "ohne"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{usd(row.costUsd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{percent(row.costUsd, totalUsd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.calls}
                    {row.errors ? <span className="ml-1 text-destructive">({row.errors} Fehler)</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {tokens(row.tokensIn)} / {tokens(row.tokensOut)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{percent(row.cacheReadTokens, row.tokensIn)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{ms(row.avgLatencyMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Keine Aufrufe im Zeitraum.</p>
      )}
    </section>
  );
}
