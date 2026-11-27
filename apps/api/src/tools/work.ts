import { createTask, TASK_STATUSES } from "../work/tasks.ts";
import type { Tool } from "./port.ts";
import { str, ToolInputError } from "./port.ts";

/**
 * The board for agents (plan stage 4): reading the work of the conversation's scope and filing new backlog items.
 * Filing never assigns, starts or approves anything; that stays on the board with Ugur.
 */
const tasksList: Tool = {
  spec: {
    name: "tasks_list",
    description: "Aufgaben des Projekts (Firmenebene: aller Projekte) nach Status, mit Titel, Priorität und Bearbeiter.",
    parameters: {
      type: "object",
      properties: { status: { type: "string", enum: [...TASK_STATUSES], description: "leer = alle offenen" } },
    },
  },
  async run(args, context) {
    const status = typeof args.status === "string" && args.status ? args.status : null;
    if (status && !(TASK_STATUSES as readonly string[]).includes(status)) throw new ToolInputError("Unbekannter Status.");
    const { results } = await context.env.DB.prepare(
      `SELECT t.id, t.project_id AS projectId, t.title, t.status, t.priority, t.story_points AS storyPoints, t.agent_id AS agentId,
              (t.acceptance_criteria IS NOT NULL AND t.acceptance_criteria <> '') AS hasCriteria
         FROM tasks t
        WHERE t.tenant_id = ? AND (? = '' OR t.project_id = ?) AND (? IS NULL AND t.status <> 'done' OR t.status = ?)
        ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.updated_at DESC
        LIMIT 80`,
    )
      .bind(context.tenantId, context.projectId, context.projectId, status, status)
      .all<{ status: string }>();
    const byStatus = Object.fromEntries(TASK_STATUSES.map((name) => [name, results.filter((task) => task.status === name).length]));
    return { scope: context.projectId || "firma", byStatus, tasks: results };
  },
};

const taskCreate: Tool = {
  requiresProject: true,
  spec: {
    name: "task_create",
    description: "Legt eine Aufgabe im Backlog dieses Projekts an, mit überprüfbaren Abnahmekriterien. Zuweisen und Starten bleibt bei Ugur.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string", description: "Ziel, Kontext, betroffene Dateien" },
        acceptanceCriteria: { type: "string", description: "eine prüfbare Bedingung je Zeile" },
        priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
        storyPoints: { type: "number" },
      },
      required: ["title", "acceptanceCriteria"],
    },
  },
  async run(args, context) {
    const created = await createTask(
      context.env,
      { actor: `agent:${context.agentId}`, tenantId: context.tenantId, scopes: [] },
      { ...args, title: str(args, "title"), projectId: context.projectId },
    );
    if ("error" in created) throw new ToolInputError(created.error);
    return { id: created.task.id, status: created.task.status, title: created.task.title, projectId: created.task.projectId };
  },
};

const taskRefine: Tool = {
  requiresProject: true,
  spec: {
    name: "task_refine",
    description: "Schärft die Aufgabe dieses Laufs: Ziel und Kontext, überprüfbare Abnahmekriterien (eine je Zeile).",
    parameters: {
      type: "object",
      properties: { description: { type: "string" }, acceptanceCriteria: { type: "string" } },
      required: ["acceptanceCriteria"],
    },
  },
  async run(args, context) {
    if (!context.taskId) throw new ToolInputError("Dieser Lauf gehört zu keiner Aufgabe.");
    const criteria = str(args, "acceptanceCriteria").trim();
    const description = typeof args.description === "string" ? args.description.trim() : "";
    if (criteria.length < 10 || criteria.length > 5_000) throw new ToolInputError("Abnahmekriterien: 10 bis 5.000 Zeichen.");
    const updated = await context.env.DB.prepare(
      `UPDATE tasks SET acceptance_criteria = ?, description = COALESCE(NULLIF(?, ''), description), updated_at = unixepoch()
        WHERE tenant_id = ? AND id = ? AND project_id = ? AND status <> 'done'`,
    )
      .bind(criteria, description.slice(0, 10_000), context.tenantId, context.taskId, context.projectId)
      .run();
    if (!updated.meta.changes) throw new ToolInputError("Aufgabe nicht gefunden oder schon erledigt.");
    return { taskId: context.taskId, acceptanceCriteria: criteria.split("\n").filter(Boolean).length };
  },
};

export const workTools: Tool[] = [tasksList, taskCreate, taskRefine];
