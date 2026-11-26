"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createWorkTask, startWorkReview, startWorkTask, syncWorkTaskToGitHub, updateWorkTask } from "../actions";
import type { WorkStatus, WorkTask } from "../types";
import { WorkLiveStatus } from "./WorkLiveStatus";

const COLUMNS: { id: WorkStatus; label: string; next: WorkStatus[] }[] = [
  { id: "backlog", label: "Backlog", next: ["ready", "blocked"] },
  { id: "ready", label: "Ready", next: ["backlog", "blocked"] },
  { id: "in_progress", label: "In Progress", next: ["ready", "review", "blocked"] },
  { id: "review", label: "Code Review", next: ["in_progress", "blocked"] },
  { id: "qa", label: "QA / Testing", next: ["in_progress", "blocked"] },
  { id: "blocked", label: "Blocked", next: ["backlog", "ready", "review"] },
  { id: "done", label: "Done", next: ["backlog"] },
];

const PRIORITIES: Record<WorkTask["priority"], string> = { low: "Niedrig", normal: "Normal", high: "Hoch", urgent: "Dringend" };
const REVIEW_LABEL: Record<Exclude<NonNullable<WorkTask["latestReview"]>["verdict"], null> | "running" | "failed" | "cancelled", string> = {
  pass: "QA bestanden · Owner-Abnahme offen",
  changes_requested: "Änderungen erforderlich",
  needs_human: "Manuelle Prüfung erforderlich",
  running: "QA läuft",
  failed: "QA-Lauf fehlgeschlagen",
  cancelled: "QA-Lauf abgebrochen",
};

function reviewLabel(review: NonNullable<WorkTask["latestReview"]>): string {
  if (review.status !== "completed") return REVIEW_LABEL[review.status];
  return review.verdict ? REVIEW_LABEL[review.verdict] : "Prüfergebnis unvollständig";
}

function TaskCard({ task, next }: { task: WorkTask; next: WorkStatus[] }) {
  return (
    <article className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{PRIORITIES[task.priority]}{task.storyPoints ? ` · ${task.storyPoints} SP` : ""}</span>
        {task.agent ? <Link href={`/agents?agent=${encodeURIComponent(task.agent.id)}`} className="underline underline-offset-4" title="Im Agentenbüro zeigen">{task.agent.name}</Link> : <span>Nicht zugewiesen</span>}
      </div>
      <h3 className="font-medium leading-snug">{task.title}</h3>
      {task.githubIssue ? <a className="text-sm underline underline-offset-4" href={task.githubIssue.url ?? "/work"} target="_blank" rel="noreferrer">GitHub Issue #{task.githubIssue.number} · {task.githubIssue.state ?? "verknüpft"}</a> : null}
      {task.description ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p> : null}
      {task.acceptanceCriteria ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Abnahmekriterien</summary>
          <p className="mt-2 whitespace-pre-wrap">{task.acceptanceCriteria}</p>
        </details>
      ) : null}
      {task.output ? <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Letztes Agentenergebnis</summary><p className="mt-2 whitespace-pre-wrap">{task.output}</p></details> : null}
      {task.completionNote ? <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Owner-Abnahme</summary><p className="mt-2 whitespace-pre-wrap">{task.completionNote}</p>{task.completedBy ? <p className="mt-1 text-xs text-muted-foreground">Abgenommen von {task.completedBy}</p> : null}</details> : null}
      {task.latestReview ? <details className="text-sm" open={task.latestReview.status === "running"}><summary className="cursor-pointer text-muted-foreground">QA: {reviewLabel(task.latestReview)}</summary><div className="mt-2 space-y-2"><p>{task.latestReview.summary ?? task.latestReview.error ?? "Prüfung läuft."}</p>{task.latestReview.findings.length ? <ul className="list-inside list-disc">{task.latestReview.findings.map((finding, index) => <li key={`${index}-${finding}`}>{finding}</li>)}</ul> : null}{task.latestReview.evidence.length ? <ul className="list-inside list-disc text-muted-foreground">{task.latestReview.evidence.map((evidence, index) => <li key={`${index}-${evidence}`}>{evidence}</li>)}</ul> : null}{task.latestReview.threadId ? <Link href={`/chat/${task.latestReview.threadId}`} className="inline-block underline underline-offset-4">QA-Thread öffnen</Link> : null}</div></details> : null}
      {task.threadId ? <Link href={`/chat/${task.threadId}`} className="inline-block text-sm underline underline-offset-4">Agenten-Thread öffnen</Link> : null}
      {task.status === "ready" ? <form action={startWorkTask}><input type="hidden" name="id" value={task.id} /><button className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">An Chef-Agent übergeben</button></form> : null}
      <form action={syncWorkTaskToGitHub}><input type="hidden" name="id" value={task.id} /><button className="w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">{task.githubIssue ? "GitHub Issue aktualisieren" : "GitHub Issue erstellen"}</button></form>
      {task.status === "review" ? <form action={startWorkReview}><input type="hidden" name="id" value={task.id} /><button className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Unabhängige QA starten</button></form> : null}
      {task.status === "qa" ? <form action={updateWorkTask} className="space-y-2 border-t border-border pt-3"><input type="hidden" name="id" value={task.id} /><input type="hidden" name="status" value="done" /><label className="block space-y-1 text-xs">Owner-Abnahme / manuelle Verifikation <textarea name="completionNote" required minLength={20} maxLength={2000} rows={3} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" placeholder="Prüfungen, Befunde und Abschlussentscheidung dokumentieren …" /></label><button className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Nach Prüfung abschließen</button></form> : null}
      {next.length ? (
        <form action={updateWorkTask} className="flex flex-wrap gap-2 border-t border-border pt-3">
          <input type="hidden" name="id" value={task.id} />
          {next.map((status) => {
            const label = COLUMNS.find((column) => column.id === status)?.label ?? status;
            return <button key={status} name="status" value={status} className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent">→ {label}</button>;
          })}
        </form>
      ) : null}
    </article>
  );
}

export function WorkBoard({ tasks, error, liveOrigin }: { tasks: WorkTask[]; error: string | null; liveOrigin: string | null }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  return (
    <div className="space-y-8 p-6 lg:p-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Management</p>
        <h1 className="font-serif text-3xl">Aufgaben & Delivery</h1>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-sm text-muted-foreground">Ein persistentes Arbeitsboard für Backlog, Umsetzung, Review und Abnahme. Statusänderungen werden im Agenten-Backend gespeichert und als Live-Ereignisse an offene Boards verteilt.</p><WorkLiveStatus origin={liveOrigin} onRefresh={refresh} /></div>
      </header>

      {error ? <p role="status" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error} Das Board bleibt bis dahin schreibgeschützt.</p> : null}

      <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="create-task-title">
        <h2 id="create-task-title" className="mb-4 text-lg font-medium">Aufgabe aufnehmen</h2>
        <form action={createWorkTask} className="grid gap-4 md:grid-cols-2">
          <fieldset disabled={Boolean(error)} className="contents disabled:opacity-50">
          <label className="space-y-1 text-sm md:col-span-2">Titel
            <input required maxLength={200} name="title" className="w-full rounded-md border border-input bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">Beschreibung
            <textarea maxLength={10000} name="description" rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">Abnahmekriterien
            <textarea maxLength={5000} name="acceptanceCriteria" rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">Priorität
            <select name="priority" className="block rounded-md border border-input bg-background px-3 py-2">
              <option value="normal">Normal</option><option value="low">Niedrig</option><option value="high">Hoch</option><option value="urgent">Dringend</option>
            </select>
          </label>
          <div className="flex items-end"><button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Ins Backlog aufnehmen</button></div>
          </fieldset>
        </form>
      </section>

      <p className="text-xs text-muted-foreground">QA ist eine getrennte, read-only Prüfung von Pull Request, Diff und CI. Nur nach bestandenem Prüfergebnis kann der Owner die Aufgabe auf Done setzen. Sprintplanung und isolierte Workspaces folgen später.</p>

      <div className="flex gap-4 overflow-x-auto pb-3" aria-label="Aufgabenstatus">
        {COLUMNS.map((column) => {
          const entries = tasks.filter((task) => task.status === column.id);
          return (
            <section key={column.id} aria-labelledby={`column-${column.id}`} className="w-72 shrink-0 space-y-3">
              <header className="flex items-center justify-between border-b border-border pb-2">
                <h2 id={`column-${column.id}`} className="text-sm font-semibold">{column.label}</h2>
                <span className="font-mono text-xs text-muted-foreground">{entries.length}</span>
              </header>
              {entries.length ? entries.map((task) => <TaskCard key={task.id} task={task} next={column.next} />) : <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">Keine Aufgaben</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
