"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@ugur/ui";
import { chooseProject } from "../../actions";
import type { ThreadProject } from "../../types";

interface ProjectPickerProps {
  threadId: string;
  value: string;
  projects: ThreadProject[];
  /** The agent is working: the repository cannot change underneath it. */
  disabled: boolean;
  onChanged: () => void;
}

/** The repository this chat works in. Only registered projects appear; new ones are added under /projects. */
export function ProjectPicker({ threadId, value, projects, disabled, onChanged }: ProjectPickerProps) {
  const [pending, startTransition] = useTransition();

  function change(projectId: string) {
    startTransition(async () => {
      const result = await chooseProject(threadId, projectId);
      if (!result.ok) toast.error(result.error ?? "Projekt konnte nicht gewechselt werden.");
      else onChanged();
    });
  }

  return (
    <Select value={value} onValueChange={change} disabled={pending || disabled}>
      <SelectTrigger className="h-9 w-56 rounded-md" aria-label="Projekt">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
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
