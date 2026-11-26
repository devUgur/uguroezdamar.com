import { Button } from "@ugur/ui";
import { createProjectTask, createSprint } from "../actions";
import type { Sprint } from "../types";

const INPUT = "h-9 rounded-md border border-input bg-background px-3 text-sm";

/** New sprint and new task for this project, side by side. */
export function PlanningForms({ projectId, openSprints }: { projectId: string; openSprints: Sprint[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form action={createProjectTask} className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h3 className="font-medium">Neue Aufgabe</h3>
        <input type="hidden" name="projectId" value={projectId} />
        <label className="flex flex-col gap-1 text-sm">
          Titel
          <input name="title" required maxLength={200} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Beschreibung
          <textarea name="description" rows={3} maxLength={10_000} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Abnahmekriterien
          <textarea name="acceptanceCriteria" rows={2} maxLength={5_000} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Priorität
            <select name="priority" defaultValue="normal" className={INPUT}>
              <option value="low">niedrig</option>
              <option value="normal">normal</option>
              <option value="high">hoch</option>
              <option value="urgent">dringend</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Sprint
            <select name="sprintId" defaultValue="" className={INPUT}>
              <option value="">Backlog</option>
              {openSprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button type="submit" className="self-start">
          Aufgabe anlegen
        </Button>
      </form>

      <form action={createSprint} className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h3 className="font-medium">Neuer Sprint</h3>
        <input type="hidden" name="projectId" value={projectId} />
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input name="name" required maxLength={120} placeholder="z. B. Sprint 1" className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ziel
          <textarea name="goal" rows={2} maxLength={2_000} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Start
            <input name="startsAt" type="date" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ende
            <input name="endsAt" type="date" className={INPUT} />
          </label>
        </div>
        <Button type="submit" className="self-start">
          Sprint anlegen
        </Button>
      </form>
    </div>
  );
}
