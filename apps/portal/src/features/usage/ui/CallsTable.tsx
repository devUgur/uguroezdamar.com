import Link from "next/link";
import { ms, PRICE_SOURCE, time, tokens, usd } from "../format";
import type { ModelCallRow } from "../types";

/** The latest model calls: who, which model, what it cost and how long it took. */
export function CallsTable({ calls }: { calls: ModelCallRow[] }) {
  if (!calls.length) return <p className="text-sm text-muted-foreground">Keine Modellaufrufe im Zeitraum.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Zeit</th>
            <th className="px-3 py-2 font-medium">Mitarbeiter</th>
            <th className="px-3 py-2 font-medium">Projekt</th>
            <th className="px-3 py-2 font-medium">Modell</th>
            <th className="px-3 py-2 text-right font-medium">Tokens ein/aus</th>
            <th className="px-3 py-2 text-right font-medium">Kosten</th>
            <th className="px-3 py-2 text-right font-medium">Latenz</th>
            <th className="px-3 py-2 font-medium">Lauf</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr key={call.id} className="border-t border-border align-top">
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">{time(call.ts)}</td>
              <td className="px-3 py-2">{call.agent ?? "–"}</td>
              <td className="px-3 py-2 font-mono text-xs">{call.projectId ?? "–"}</td>
              <td className="px-3 py-2">
                <span className="font-mono text-xs">
                  {call.provider}/{call.model}
                </span>
                {call.status === "error" ? (
                  <span className="block max-w-80 truncate text-xs text-destructive" title={call.error ?? undefined}>
                    {call.error ?? "Fehler"}
                  </span>
                ) : (
                  <span className="block text-xs text-muted-foreground">
                    {PRICE_SOURCE[call.priceSource] ?? call.priceSource}
                    {call.strictPolicy ? " · streng" : ""}
                    {call.keySource === "tenant" ? " · eigener Schlüssel" : ""}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                {tokens(call.tokensIn)} / {tokens(call.tokensOut)}
                {call.cacheReadTokens ? <span className="block text-xs text-muted-foreground">{tokens(call.cacheReadTokens)} aus Cache</span> : null}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{usd(call.costUsd)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">{ms(call.latencyMs)}</td>
              <td className="px-3 py-2">
                {call.runId ? (
                  <Link href={`/usage/runs/${call.runId}`} className="text-xs underline underline-offset-2">
                    Schritt {call.step ?? "?"}
                  </Link>
                ) : (
                  "–"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
