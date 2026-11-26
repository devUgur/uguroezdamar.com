import Link from "next/link";
import { ms, RUN_STATUS, time, tokens, usd } from "../format";
import type { RunRow } from "../types";

const KIND: Record<RunRow["kind"], string> = { chat: "Chat", task: "Aufgabe", review: "QA-Prüfung" };

/** Runs in the period, newest first; each opens its trace. */
export function RunsTable({ runs }: { runs: RunRow[] }) {
  if (!runs.length) return <p className="text-sm text-muted-foreground">Keine Läufe im Zeitraum.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Start</th>
            <th className="px-3 py-2 font-medium">Mitarbeiter</th>
            <th className="px-3 py-2 font-medium">Art</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Schritte</th>
            <th className="px-3 py-2 text-right font-medium">Tokens ein/aus</th>
            <th className="px-3 py-2 text-right font-medium">Kosten</th>
            <th className="px-3 py-2 text-right font-medium">Dauer</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-t border-border">
              <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                <Link href={`/usage/runs/${run.id}`} className="underline underline-offset-2">
                  {time(run.startedAt)}
                </Link>
              </td>
              <td className="px-3 py-2">
                {run.agent}
                {run.projectId ? <span className="block font-mono text-xs text-muted-foreground">{run.projectId}</span> : null}
              </td>
              <td className="px-3 py-2">{KIND[run.kind] ?? run.kind}</td>
              <td className={run.status === "failed" ? "px-3 py-2 text-destructive" : "px-3 py-2"}>{RUN_STATUS[run.status] ?? run.status}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {run.steps} · {run.toolCalls} Werkzeuge
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                {tokens(run.tokensIn)} / {tokens(run.tokensOut)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{usd(run.costUsd)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">{run.endedAt ? ms(run.endedAt - run.startedAt) : "läuft"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
