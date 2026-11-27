"use client";

import { useState, useTransition } from "react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@ugur/ui";
import { createTask } from "../../actions";
import type { OfficeScope, OfficeTask, ThreadProject } from "../../types";

interface NewTaskFormProps {
  projects: ThreadProject[];
  /** The board's scope; on the company level the project is chosen here. */
  scope: OfficeScope;
  onCreated: () => void;
  onCancel: () => void;
}

const fieldClass = "rounded-md border border-border bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A new backlog task with acceptance criteria, the same path the Product Owner uses (task_create). */
export function NewTaskForm({ projects, scope, onCreated, onCancel }: NewTaskFormProps) {
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(scope ?? projects[0]?.id ?? "");
  const [priority, setPriority] = useState<OfficeTask["priority"]>("normal");

  function submit(form: FormData) {
    const title = String(form.get("title") ?? "").trim();
    if (!title || !projectId) return;
    startTransition(async () => {
      const result = await createTask({
        projectId,
        title,
        description: String(form.get("description") ?? "").trim(),
        acceptanceCriteria: String(form.get("acceptanceCriteria") ?? "").trim(),
        priority,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Aufgabe konnte nicht angelegt werden.");
        return;
      }
      toast.success("Aufgabe im Backlog.");
      onCreated();
    });
  }

  return (
    <form action={submit} className="flex min-h-0 w-full shrink-0 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card p-4 lg:w-96">
      <h3 className="text-base font-medium">Neue Aufgabe</h3>
      {scope ? null : (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Projekt
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-9" aria-label="Projekt">
              <SelectValue>{projects.find((project) => project.id === projectId)?.name ?? "Projekt wählen"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Titel
        <input name="title" required maxLength={200} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Ziel und Kontext
        <textarea name="description" rows={3} maxLength={10_000} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Abnahmekriterien (eine je Zeile)
        <textarea name="acceptanceCriteria" rows={3} maxLength={5_000} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Priorität
        <Select value={priority} onValueChange={(value) => setPriority(value as OfficeTask["priority"])}>
          <SelectTrigger className="h-9" aria-label="Priorität">
            <SelectValue>{{ urgent: "dringend", high: "hoch", normal: "normal", low: "niedrig" }[priority]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent">dringend</SelectItem>
            <SelectItem value="high">hoch</SelectItem>
            <SelectItem value="normal">normal</SelectItem>
            <SelectItem value="low">niedrig</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !projectId}>
          Anlegen
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
