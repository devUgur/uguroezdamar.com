"use client";

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@ugur/ui";
import type { OfficeTask, ThreadProject } from "../../types";
import { TaskBoard } from "./TaskBoard";

interface BoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tasks: OfficeTask[];
  projects: ThreadProject[];
  company: boolean;
  portalUrl: string;
  onPickProject: (projectId: string) => void;
}

/** The board on the wall, opened large: everything that is to be done in the current scope. */
export function BoardDialog({ open, onOpenChange, title, tasks, projects, company, portalUrl, onPickProject }: BoardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex h-[min(52rem,calc(100dvh-2rem))] flex-col gap-4 overflow-hidden p-5 sm:max-w-[min(96rem,calc(100vw-2rem))]">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="font-serif text-2xl">Tafel · {title}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {company ? "Alle Projekte. Ein Klick auf ein Projekt zeigt nur dessen Arbeit." : "Was in diesem Projekt zu tun ist."} Karten mit Gespräch öffnen den Chat; anlegen, zuweisen und abnehmen im Portal.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <a href={`${portalUrl}/work`} className="rounded-md px-2 py-1 text-muted-foreground underline-offset-4 hover:bg-accent hover:text-foreground">
              Im Portal bearbeiten
            </a>
            <DialogClose className="rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Schließen</DialogClose>
          </div>
        </header>
        {tasks.length ? null : (
          <p className="text-sm text-muted-foreground">Noch keine Aufgaben in diesem Bereich. Der Product Owner legt sie im Gespräch an, oder du im Portal.</p>
        )}
        <TaskBoard tasks={tasks} projects={projects} company={company} onPickProject={onPickProject} />
      </DialogContent>
    </Dialog>
  );
}
