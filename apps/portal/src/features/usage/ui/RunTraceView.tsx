import Link from "next/link";
import { ms, PRICE_SOURCE, RUN_STATUS, time, tokens, usd } from "../format";
import type { ModelCallRow, RunTrace, ToolCallRow } from "../types";

type Entry = { kind: "model"; ts: number; call: ModelCallRow } | { kind: "tool"; ts: number; call: ToolCallRow };

/** /usage/runs/[id]: one run step by step, model calls and tool calls in the order they happened. */
export function RunTraceView({ trace }: { trace: RunTrace }) {
  const { run } = trace;
  const entries: Entry[] = [
    ...trace.modelCalls.map((call): Entry => ({ kind: "model", ts: call.ts, call })),
    ...trace.toolCalls.map((call): Entry => ({ kind: "tool", ts: call.ts, call })),
  ].sort((a, b) => a.ts - b.ts);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <header className="flex flex-col gap-2">
        <Link href="/usage" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          ← Verbrauch
        </Link>
        <h1 className="font-serif text-3xl">Lauf von {run.agent}</h1>
        <p className="text-sm text-muted-foreground">
          {time(run.startedAt)} · {RUN_STATUS[run.status] ?? run.status} · {run.steps} Schritte · {run.modelCalls} Modellaufrufe · {run.toolCalls} Werkzeuge ·{" "}
          {tokens(run.tokensIn)} / {tokens(run.tokensOut)} Tokens · {usd(run.costUsd)}
          {run.endedAt ? ` · ${ms(run.endedAt - run.startedAt)}` : ""}
          {run.projectId ? ` · Projekt ${run.projectId}` : ""}
        </p>
        {run.threadId ? (
          <Link href={`/chat/${run.threadId}`} className="text-sm underline underline-offset-2">
            Zum Gespräch
          </Link>
        ) : null}
        {run.outcome ? <p className="whitespace-pre-wrap rounded-md border border-border bg-muted p-3 text-sm">{run.outcome}</p> : null}
      </header>

      <ol className="flex flex-col gap-2 border-l border-border pl-4" aria-label="Ablauf">
        {entries.map((entry) =>
          entry.kind === "model" ? (
            <li key={`m${entry.call.id}`} className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">
                Schritt {entry.call.step ?? "?"} · {time(entry.ts)}
              </span>
              <span className={entry.call.status === "error" ? "text-destructive" : undefined}>
                Modell <span className="font-mono text-xs">{entry.call.provider}/{entry.call.model}</span>
                {entry.call.status === "ok"
                  ? ` · ${tokens(entry.call.tokensIn)} ein (${tokens(entry.call.cacheReadTokens)} Cache) · ${tokens(entry.call.tokensOut)} aus · ${usd(entry.call.costUsd)} · ${ms(entry.call.latencyMs)}${
                      entry.call.firstTokenMs ? ` (erstes Token nach ${ms(entry.call.firstTokenMs)})` : ""
                    }`
                  : ` · Fehler: ${entry.call.error ?? "unbekannt"}`}
              </span>
              <span className="text-xs text-muted-foreground">
                {PRICE_SOURCE[entry.call.priceSource] ?? entry.call.priceSource}
                {entry.call.strictPolicy ? " · strenge Datenrichtlinie" : ""}
                {entry.call.attempts?.length && entry.call.attempts.length > 1 ? ` · Versuche: ${entry.call.attempts.join(" | ")}` : ""}
              </span>
            </li>
          ) : (
            <li key={`t${entry.call.id}`} className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">
                Schritt {entry.call.step ?? "?"} · {time(entry.ts)}
              </span>
              <span className={entry.call.ok ? undefined : "text-destructive"}>
                {entry.call.approvalId ? "Freigabe angefragt: " : "Werkzeug "}
                <span className="font-mono text-xs">{entry.call.tool}</span>
                {entry.call.durationMs !== null ? ` · ${ms(entry.call.durationMs)}` : ""}
              </span>
              {entry.call.argsPreview ? <span className="truncate font-mono text-xs text-muted-foreground">{entry.call.argsPreview}</span> : null}
              {entry.call.resultPreview ? <span className="line-clamp-2 text-xs text-muted-foreground">{entry.call.resultPreview}</span> : null}
            </li>
          ),
        )}
      </ol>
    </main>
  );
}
