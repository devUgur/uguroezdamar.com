import Link from "next/link";
import type { ReactNode } from "react";
import type { Approval, OfficeTask, OfficeWorkspace } from "../../types";

const OPEN_STATUSES: OfficeTask["status"][] = ["in_progress", "review", "qa", "blocked", "ready"];
const STATUS_LABEL: Record<OfficeTask["status"], string> = {
  backlog: "Backlog",
  ready: "Bereit",
  in_progress: "In Arbeit",
  review: "Review",
  qa: "QA",
  blocked: "Blockiert",
  done: "Erledigt",
};

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

function TasksWidget({ tasks, portalUrl }: { tasks: OfficeTask[]; portalUrl: string }) {
  const open = tasks.filter((task) => OPEN_STATUSES.includes(task.status));
  const counts = OPEN_STATUSES.map((status) => ({ status, count: open.filter((task) => task.status === status).length })).filter((entry) => entry.count);
  return (
    <Widget title="Aufgaben" action={<a href={`${portalUrl}/work`} className="text-xs underline underline-offset-4">Board</a>}>
      {open.length ? (
        <>
          <p className="text-xs text-muted-foreground">{counts.map((entry) => `${STATUS_LABEL[entry.status]} ${entry.count}`).join(" · ")}</p>
          <ul className="flex flex-col gap-2">
            {open.slice(0, 6).map((task) => (
              <li key={task.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{task.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{task.agent?.name ?? STATUS_LABEL[task.status]}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Keine offenen Aufgaben in diesem Bereich.</p>
      )}
    </Widget>
  );
}

function ApprovalsWidget({ approvals }: { approvals: Approval[] }) {
  return (
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
  );
}

function TodayWidget({ today, scope, portalUrl }: { today: OfficeWorkspace["today"]; scope: string | null; portalUrl: string }) {
  return (
    <Widget title="Heute" action={<a href={`${portalUrl}/usage${scope ? `?project=${encodeURIComponent(scope)}` : ""}`} className="text-xs underline underline-offset-4">Details</a>}>
      {today ? (
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Kosten</dt>
            <dd className="font-mono">${today.costUsd.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Läufe</dt>
            <dd className="font-mono">{today.runs}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">aktiv</dt>
            <dd className="font-mono">{today.running}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">Verbrauch nicht lesbar.</p>
      )}
    </Widget>
  );
}

/** The office's side widgets for the current scope; approvals are shown for every scope, because all of them wait for Ugur. */
export function OfficeWidgets({ workspace, portalUrl }: { workspace: Pick<OfficeWorkspace, "tasks" | "approvals" | "today" | "scope">; portalUrl: string }) {
  return (
    <div className="flex flex-col gap-3">
      <TodayWidget today={workspace.today} scope={workspace.scope} portalUrl={portalUrl} />
      <ApprovalsWidget approvals={workspace.approvals} />
      <TasksWidget tasks={workspace.tasks} portalUrl={portalUrl} />
    </div>
  );
}
