"use client";

import { useState, useTransition } from "react";
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, toast } from "@ugur/ui";
import { createInitiative } from "../../actions";
import type { AgentSummary, OfficeInitiative, OfficeScope, ThreadProject } from "../../types";
import { InitiativeDetail } from "./InitiativeDetail";

interface InitiativeDialogProps {
  /** undefined: closed; null: a new initiative; otherwise the initiative to show. */
  openId: string | null | undefined;
  onClose: () => void;
  scope: OfficeScope;
  projects: ThreadProject[];
  initiatives: OfficeInitiative[];
  agents: AgentSummary[];
  onChanged: () => void;
}

const fieldClass = "rounded-md border border-border bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Ugur describes a wish (ADR 0041) or follows its planning: questions, artifacts, approval. */
export function InitiativeDialog({ openId, onClose, scope, projects, initiatives, agents, onChanged }: InitiativeDialogProps) {
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(scope ?? projects[0]?.id ?? "");
  const initiative = openId ? (initiatives.find((entry) => entry.id === openId) ?? null) : null;

  function submit(form: FormData) {
    const title = String(form.get("title") ?? "").trim();
    const brief = String(form.get("brief") ?? "").trim();
    startTransition(async () => {
      const result = await createInitiative({ projectId, title, brief });
      if (!result.ok) {
        toast.error(result.error ?? "Vorhaben konnte nicht starten.");
        return;
      }
      toast.success("Das Team plant. Rückfragen erscheinen hier.");
      onChanged();
      onClose();
    });
  }

  return (
    <Dialog open={openId !== undefined} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="flex h-[min(56rem,calc(100dvh-2rem))] flex-col gap-4 overflow-hidden p-5 sm:max-w-[min(90rem,calc(100vw-2rem))]">
        <header className="flex items-baseline justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="font-serif text-2xl">{initiative ? initiative.title : "Neues Vorhaben"}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {initiative ? "Planung durch das Team: Anforderungen, Architektur, Prüfung, Backlog, Sprint." : "Beschreib in deinen Worten, was entstehen soll und wofür. Das Team fragt nach, wo etwas fehlt."}
            </DialogDescription>
          </div>
          <DialogClose className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">Schließen</DialogClose>
        </header>
        {initiative ? (
          <InitiativeDetail key={initiative.id} initiative={initiative} agents={agents} onChanged={onChanged} />
        ) : openId === null ? (
          <form action={submit} className="flex max-w-3xl flex-col gap-3">
            {scope ? null : (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Projekt
                <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={fieldClass}>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Kurzer Titel
              <input name="title" required maxLength={200} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Was soll entstehen, für wen, wie soll es ablaufen? Was ist dir wichtig, was nicht?
              <textarea name="brief" required minLength={20} rows={10} className={fieldClass} />
            </label>
            <Button type="submit" disabled={pending || !projectId} className="self-start">
              Team planen lassen
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Vorhaben nicht gefunden.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
