"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@ugur/ui";
import { startTask, startTaskReview, updateTask } from "../../actions";
import type { AgentSummary, OfficeTask, TaskPatch } from "../../types";
import { STATUS_LABEL } from "./board";
import { COMPLETION_NOTE, MOVES } from "./transitions";

interface TaskDetailProps {
  task: OfficeTask;
  agents: AgentSummary[];
  /** Reloads the board after a change. */
  onChanged: () => void;
  onClose: () => void;
}

const UNASSIGNED = "__none";
const PRIORITIES: { value: OfficeTask["priority"]; label: string }[] = [
  { value: "urgent", label: "dringend" },
  { value: "high", label: "hoch" },
  { value: "normal", label: "normal" },
  { value: "low", label: "niedrig" },
];
const VERDICT: Record<string, string> = { pass: "bestanden", changes_requested: "Nacharbeit nötig", needs_human: "braucht dich" };

/** One task on the board: what it is about and everything Ugur can do with it, each step checked again by the API. */
export function TaskDetail({ task, agents, onChanged, onClose }: TaskDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  function run(work: () => Promise<{ ok: boolean; error?: string; threadId?: string }>, success: string) {
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        toast.error(result.error ?? "Aktion fehlgeschlagen.");
        return;
      }
      toast.success(success);
      onChanged();
      if (result.threadId) router.push(`/chat/${result.threadId}`);
    });
  }
  const patch = (change: TaskPatch, success: string) => run(() => updateTask(task.id, change), success);
  const agentName = task.agent?.name ?? "Chef-Agent";
  const noteValid = note.trim().length >= COMPLETION_NOTE.min && note.trim().length <= COMPLETION_NOTE.max;

  return (
    <aside aria-label={`Aufgabe ${task.title}`} className="flex min-h-0 w-full shrink-0 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-card p-4 lg:w-96">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{STATUS_LABEL[task.status]}</span>
          <h3 className="text-base font-medium leading-snug">{task.title}</h3>
        </div>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
          Zurück
        </button>
      </header>

      {task.description ? <p className="whitespace-pre-line text-sm text-muted-foreground">{task.description}</p> : null}
      <section className="flex flex-col gap-1">
        <h4 className="text-xs uppercase tracking-wide text-muted-foreground">Abnahmekriterien</h4>
        <p className="whitespace-pre-line text-sm">{task.acceptanceCriteria ?? "Keine. Ohne Kriterien kann QA nicht bestehen."}</p>
      </section>
      {task.latestReview ? (
        <p className="text-sm">
          QA: {task.latestReview.verdict ? VERDICT[task.latestReview.verdict] : task.latestReview.status === "running" ? "läuft" : task.latestReview.status}
          {task.latestReview.summary ? <span className="text-muted-foreground"> · {task.latestReview.summary}</span> : null}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Zuständig
          <Select value={task.agent?.id ?? UNASSIGNED} onValueChange={(value) => patch({ agentId: value === UNASSIGNED ? null : value }, "Zuständigkeit gespeichert.")} disabled={pending || task.status === "in_progress"}>
            <SelectTrigger className="h-9" aria-label="Zuständig">
              <SelectValue>{task.agent?.name ?? "niemand"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>niemand</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Priorität
          <Select value={task.priority} onValueChange={(value) => patch({ priority: value as OfficeTask["priority"] }, "Priorität gespeichert.")} disabled={pending}>
            <SelectTrigger className="h-9" aria-label="Priorität">
              <SelectValue>{PRIORITIES.find((entry) => entry.value === task.priority)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        {task.status === "ready" ? (
          <Button disabled={pending} onClick={() => run(() => startTask(task.id), `${agentName} legt los.`)}>
            Starten mit {agentName}
          </Button>
        ) : null}
        {task.status === "review" ? (
          <Button disabled={pending} onClick={() => run(() => startTaskReview(task.id), "QA-Reviewer prüft.")}>
            An QA übergeben
          </Button>
        ) : null}
        {task.status === "qa" ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              patch({ status: "done", completionNote: note.trim() }, "Abgenommen.");
            }}
          >
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Abnahmenotiz (mind. {COMPLETION_NOTE.min} Zeichen)
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={COMPLETION_NOTE.max}
                rows={3}
                className="rounded-md border border-border bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <Button type="submit" disabled={pending || !noteValid}>
              Abnehmen
            </Button>
          </form>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {MOVES[task.status].map((move) => (
            <Button key={move.to} variant="secondary" disabled={pending} onClick={() => patch({ status: move.to }, `${STATUS_LABEL[move.to]}.`)}>
              {move.label}
            </Button>
          ))}
        </div>
      </div>

      {task.threadId ? (
        <Link href={`/chat/${task.threadId}`} className="text-sm underline underline-offset-4">
          Gespräch zur Aufgabe öffnen
        </Link>
      ) : null}
      {task.completionNote ? <p className="text-xs text-muted-foreground">Abnahme: {task.completionNote}</p> : null}
    </aside>
  );
}
