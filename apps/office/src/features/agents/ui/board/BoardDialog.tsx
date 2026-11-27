"use client";

import { useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@ugur/ui";
import type { AgentSummary, OfficeDelivery, OfficeScope, OfficeTask, ThreadProject } from "../../types";
import { NewTaskForm } from "./NewTaskForm";
import { TaskBoard } from "./TaskBoard";
import { TaskDetail } from "./TaskDetail";

interface BoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  scope: OfficeScope;
  tasks: OfficeTask[];
  projects: ThreadProject[];
  agents: AgentSummary[];
  deliveries: OfficeDelivery[];
  portalUrl: string;
  onPickProject: (projectId: string) => void;
  /** Reloads the board data after a change; live events do the same for changes made elsewhere. */
  onChanged: () => void;
}

type Panel = { kind: "task"; id: string } | { kind: "new" } | null;

/**
 * The board on the wall, opened large: the work of the scope, and beside it the selected task with its actions or
 * the form for a new one. Assigning, starting, QA handoff and acceptance happen here; the API checks each step.
 */
export function BoardDialog({ open, onOpenChange, title, scope, tasks, projects, agents, deliveries, portalUrl, onPickProject, onChanged }: BoardDialogProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const selected = panel?.kind === "task" ? (tasks.find((task) => task.id === panel.id) ?? null) : null;
  const company = scope === null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPanel(null);
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={false} className="flex h-[min(56rem,calc(100dvh-2rem))] flex-col gap-4 overflow-hidden p-5 sm:max-w-[min(110rem,calc(100vw-2rem))]">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="font-serif text-2xl">Tafel · {title}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {company ? "Alle Projekte. Ein Klick auf ein Projekt zeigt nur dessen Arbeit." : "Was in diesem Projekt zu tun ist."} Eine Karte öffnet Details und Aktionen.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button type="button" onClick={() => setPanel({ kind: "new" })} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Neue Aufgabe
            </button>
            <a href={`${portalUrl}/work`} className="rounded-md px-2 py-1 text-muted-foreground underline-offset-4 hover:bg-accent hover:text-foreground">
              Im Portal
            </a>
            <DialogClose className="rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Schließen</DialogClose>
          </div>
        </header>
        {tasks.length ? null : <p className="text-sm text-muted-foreground">Noch keine Aufgaben in diesem Bereich. Lege eine an, oder lass den Product Owner das im Gespräch tun.</p>}
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <TaskBoard
              tasks={tasks}
              projects={projects}
              company={company}
              onPickProject={onPickProject}
              selectedId={selected?.id ?? null}
              deliveries={deliveries}
              onSelectTask={(task) => setPanel({ kind: "task", id: task.id })}
            />
          </div>
          {selected ? (
            <TaskDetail
              key={selected.id}
              task={selected}
              agents={agents}
              delivery={deliveries.find((delivery) => delivery.taskId === selected.id) ?? null}
              onChanged={onChanged}
              onClose={() => setPanel(null)}
            />
          ) : null}
          {panel?.kind === "new" ? (
            <NewTaskForm
              projects={projects}
              scope={scope}
              onCancel={() => setPanel(null)}
              onCreated={() => {
                setPanel(null);
                onChanged();
              }}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
