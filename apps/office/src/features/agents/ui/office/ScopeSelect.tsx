"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@ugur/ui";
import type { OfficeScope, ThreadProject } from "../../types";

/** Select needs a string; this one stands for the company level. */
const COMPANY = "__company";

interface ScopeSelectProps {
  projects: ThreadProject[];
  value: OfficeScope;
  onChange: (next: OfficeScope) => void;
}

/** The scope of the office: the whole company or one project as inner layer. */
export function ScopeSelect({ projects, value, onChange }: ScopeSelectProps) {
  return (
    <Select value={value ?? COMPANY} onValueChange={(next) => onChange(next === COMPANY ? null : next)}>
      <SelectTrigger className="h-10 w-full rounded-md" aria-label="Bereich">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={COMPANY}>
          Firma
          <span className="ml-2 text-xs text-muted-foreground">alle Projekte</span>
        </SelectItem>
        {projects.length ? (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Projekte</SelectLabel>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                  {project.visibility === "private" ? <span className="ml-2 text-xs text-muted-foreground">privat</span> : null}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        ) : null}
      </SelectContent>
    </Select>
  );
}
