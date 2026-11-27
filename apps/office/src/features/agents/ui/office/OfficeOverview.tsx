import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@ugur/core";
import type { Approval, OfficeBoard, OfficeScope } from "../../types";
import { COLUMNS, type StatusCounts } from "../board/board";

interface OfficeOverviewProps {
  scope: OfficeScope;
  counts: StatusCounts;
  usage: OfficeBoard["usage"];
  approvals: Approval[];
  portalUrl: string;
  onOpenBoard: () => void;
  /** Further widgets for the scope, after the flow of work (the autonomy of a project). */
  children?: ReactNode;
}

function Widget({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

const actionClass = "text-xs underline underline-offset-4 hover:text-foreground";

/** The column next to the room: today's spend, the flow of work and what waits for Ugur, all for the current scope. */
export function OfficeOverview({ scope, counts, usage, approvals, portalUrl, onOpenBoard, children }: OfficeOverviewProps) {
  const spend = usage ? (scope ? (usage.byProject[scope] ?? { costUsd: 0, calls: 0 }) : usage) : null;
  const open = COLUMNS.filter((column) => column.status !== "done").reduce((sum, column) => sum + counts[column.status], 0);

  return (
    <div className="flex flex-col gap-3">
      <Widget title="Heute" action={<a href={`${portalUrl}/usage${scope ? `?project=${encodeURIComponent(scope)}` : ""}`} className={actionClass}>Details</a>}>
        {spend && usage ? (
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Kosten</dt>
              <dd className="font-mono">${spend.costUsd.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Modellaufrufe</dt>
              <dd className="font-mono">{spend.calls}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Läufe aktiv</dt>
              <dd className="font-mono">{usage.running}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Verbrauch nicht lesbar.</p>
        )}
      </Widget>

      <Widget title={`Arbeit · ${open} offen`} action={<button type="button" onClick={onOpenBoard} className={actionClass}>Tafel öffnen</button>}>
        <ul className="flex flex-col gap-1.5">
          {COLUMNS.map((column) => (
            <li key={column.status}>
              <button type="button" onClick={onOpenBoard} className="flex w-full items-center gap-2 rounded px-1 text-left text-sm hover:bg-accent">
                <span className={cn("w-24 shrink-0 text-xs text-muted-foreground", column.status === "blocked" && counts.blocked && "text-destructive")}>{column.label}</span>
                {/* One mark per task, up to twelve: the flow reads at a glance without a chart. */}
                <span className="flex flex-1 gap-0.5" aria-hidden>
                  {Array.from({ length: Math.min(12, counts[column.status]) }, (_, index) => (
                    <span key={index} className={cn("h-2 w-2 rounded-sm", column.status === "blocked" ? "bg-destructive" : "bg-primary")} />
                  ))}
                </span>
                <span className="w-6 text-right font-mono text-xs">{counts[column.status]}</span>
              </button>
            </li>
          ))}
        </ul>
      </Widget>

      {children}

      <Widget title={`Freigaben${approvals.length ? ` · ${approvals.length}` : ""}`}>
        {approvals.length ? (
          <ul className="flex flex-col gap-2">
            {approvals.slice(0, 4).map((approval) => (
              <li key={approval.id} className="text-sm">
                {approval.threadId ? (
                  <Link href={`/chat/${approval.threadId}`} className="line-clamp-2 underline-offset-4 hover:underline">
                    {approval.summary ?? approval.action}
                  </Link>
                ) : (
                  <span className="line-clamp-2">{approval.summary ?? approval.action}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nichts wartet auf dich.</p>
        )}
      </Widget>
    </div>
  );
}
