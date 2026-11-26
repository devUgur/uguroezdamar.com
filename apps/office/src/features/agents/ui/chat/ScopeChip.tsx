import type { ThreadProject } from "../../types";

interface ScopeChipProps {
  /** null: the company level. */
  project: ThreadProject | null;
}

/** Where a chat works, as a label: in the office the scope comes from the navigation, not from the chat. */
export function ScopeChip({ project }: ScopeChipProps) {
  return (
    <span
      className="max-w-56 truncate rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
      title={project?.repo ? `Repository ${project.repo}` : "Kein Repository: lesen mit Angabe des Namens, schreiben nur im Projekt"}
    >
      {project ? `Projekt · ${project.name}` : "Firma · kein Repository"}
    </span>
  );
}
