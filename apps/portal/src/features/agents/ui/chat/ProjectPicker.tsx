"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@ugur/ui";
import { chooseProject } from "../../actions";
import type { ThreadProject } from "../../types";

/** Select needs a string; this one stands for the company level (no repository). */
const COMPANY = "__company";

interface ProjectPickerProps {
  threadId: string;
  /** null: the company level. */
  value: string | null;
  projects: ThreadProject[];
  /** The agent is working: the scope cannot change underneath it. */
  disabled: boolean;
  onChanged: () => void;
}

/** Where this chat works: the whole company without a repository, or one registered project. New ones are added under /projects. */
export function ProjectPicker({ threadId, value, projects, disabled, onChanged }: ProjectPickerProps) {
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    startTransition(async () => {
      const result = await chooseProject(threadId, next === COMPANY ? null : next);
      if (!result.ok) toast.error(result.error ?? "Bereich konnte nicht gewechselt werden.");
      else {
        if (result.message) toast.message(result.message);
        onChanged();
      }
    });
  }

  return (
    <Select value={value ?? COMPANY} onValueChange={change} disabled={pending || disabled}>
      <SelectTrigger className="h-9 w-56 rounded-md" aria-label="Bereich">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={COMPANY}>
          Ganze Firma
          <span className="ml-2 text-xs text-muted-foreground">kein Repository</span>
        </SelectItem>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
            {project.visibility === "private" ? <span className="ml-2 text-xs text-muted-foreground">privat</span> : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
