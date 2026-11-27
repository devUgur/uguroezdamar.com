import { createTask, TASK_STATUSES } from "../work/tasks.ts";
import { createInitiative } from "../work/initiatives.ts";
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
    description: "Legt ein Ticket im Backlog dieses Projekts an: Epic, Story oder Task, mit Abnahmekriterien, Rolle und Abhängigkeiten. Liefert die ID für parentId und dependsOn.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        kind: { type: "string", enum: ["epic", "story", "task"], description: "Standard task" },
        parentId: { type: "string", description: "Epic einer Story/Task; ein Epic hängt automatisch am Vorhaben" },
        description: { type: "string", description: "Ziel, Kontext, Umfang und Nicht-Umfang, betroffene Bereiche, Testanforderung" },
        acceptanceCriteria: { type: "string", description: "eine prüfbare Bedingung je Zeile" },
        role: { type: "string", description: "Agent-ID, z. B. developer" },
        dependsOn: { type: "array", items: { type: "string" }, description: "IDs der Tickets, die vorher fertig sein müssen" },
        priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
        storyPoints: { type: "number" },
      },
      required: ["title", "acceptanceCriteria"],
    },
  },
  async run(args, context) {
    // In a planning run the conversation's task is the initiative: epics hang below it by default.
    const initiative = context.taskId
      ? await context.env.DB.prepare("SELECT id FROM tasks WHERE tenant_id = ? AND id = ? AND kind = 'initiative'").bind(context.tenantId, context.taskId).first<{ id: string }>()
      : null;
    const parentId = typeof args.parentId === "string" && args.parentId ? args.parentId : args.kind === "epic" && initiative ? initiative.id : undefined;
    const created = await createTask(
      context.env,
      { actor: `agent:${context.agentId}`, tenantId: context.tenantId, scopes: [] },
      { ...args, title: str(args, "title"), projectId: context.projectId, parentId },
    );
    if ("error" in created) throw new ToolInputError(created.error);
    return { id: created.task.id, kind: created.task.kind, parentId: created.task.parentId, status: created.task.status, title: created.task.title, projectId: created.task.projectId };
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

const askOwner: Tool = {
  requiresProject: true,
  spec: {
    name: "ask_owner",
    description: "Rückfragen an Ugur zum Vorhaben; der Ablauf wartet auf seine Antworten.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: { question: { type: "string" }, why: { type: "string" }, proposal: { type: "string" } },
            required: ["question"],
          },
        },
      },
      required: ["questions"],
    },
  },
  async run(args, context) {
    if (!context.taskId) throw new ToolInputError("Rückfragen gehören zu einem Vorhaben.");
    const questions = (Array.isArray(args.questions) ? args.questions : []).slice(0, 5) as { question?: unknown; why?: unknown; proposal?: unknown }[];
    const valid = questions.filter((entry) => typeof entry.question === "string" && entry.question.trim());
    if (!valid.length) throw new ToolInputError("Mindestens eine Frage.");
    await context.env.DB.batch(
      valid.map((entry) =>
        context.env.DB.prepare("INSERT INTO owner_questions (id, tenant_id, initiative_id, question, why, proposal, asked_by) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
          crypto.randomUUID(), context.tenantId, context.taskId, String(entry.question).trim().slice(0, 1_000),
          typeof entry.why === "string" ? entry.why.slice(0, 1_000) : null, typeof entry.proposal === "string" ? entry.proposal.slice(0, 1_000) : null, context.agentId,
        ),
      ),
    );
    return { asked: valid.length, note: "Ugur beantwortet sie im Office. Schließe deinen Schritt ab, soweit es ohne die Antworten geht." };
  },
};

const sprintPropose: Tool = {
  requiresProject: true,
  spec: {
    name: "sprint_propose",
    description: "Schlägt einen Sprint vor: Name, Sprintziel und die Ticket-IDs in Reihenfolge. Ugur gibt ihn mit der Planung frei.",
    parameters: {
      type: "object",
      properties: { name: { type: "string" }, goal: { type: "string" }, taskIds: { type: "array", items: { type: "string" } } },
      required: ["name", "goal", "taskIds"],
    },
  },
  async run(args, context) {
    const ids = (Array.isArray(args.taskIds) ? args.taskIds : []).filter((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/.test(value));
    if (!ids.length) throw new ToolInputError("Mindestens ein Ticket.");
    const { results } = await context.env.DB.prepare(
      `SELECT id, acceptance_criteria FROM tasks WHERE tenant_id = ? AND project_id = ? AND kind IN ('story', 'task') AND status = 'backlog' AND id IN (${ids.map(() => "?").join(", ")})`,
    )
      .bind(context.tenantId, context.projectId, ...ids)
      .all<{ id: string; acceptance_criteria: string | null }>();
    const missing = ids.filter((id) => !results.some((row) => row.id === id));
    if (missing.length) throw new ToolInputError(`Nicht im Backlog dieses Projekts (oder Epic): ${missing.join(", ")}`);
    const vague = results.filter((row) => !row.acceptance_criteria?.trim()).map((row) => row.id);
    if (vague.length) throw new ToolInputError(`Ohne Abnahmekriterien nicht sprintbereit: ${vague.join(", ")}`);
    const sprintId = crypto.randomUUID();
    await context.env.DB.batch([
      context.env.DB.prepare("INSERT INTO sprints (id, tenant_id, project_id, name, goal, status, created_by) VALUES (?, ?, ?, ?, ?, 'planned', ?)")
        .bind(sprintId, context.tenantId, context.projectId, str(args, "name").slice(0, 120), str(args, "goal").slice(0, 1_000), `agent:${context.agentId}`),
      ...ids.map((id) => context.env.DB.prepare("UPDATE tasks SET sprint_id = ?, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?").bind(sprintId, context.tenantId, id)),
    ]);
    return { sprintId, tickets: ids.length, status: "planned", note: "Aktiv wird er, wenn Ugur die Planung freigibt." };
  },
};

const initiativeStart: Tool = {
  requiresProject: true,
  spec: {
    name: "initiative_start",
    description: "Startet die Teamplanung eines Vorhabens bis Backlog und Sprint.",
    parameters: {
      type: "object",
      properties: { title: { type: "string" }, brief: { type: "string" } },
      required: ["title", "brief"],
    },
  },
  async run(args, context) {
    const result = await createInitiative(context.env, { actor: `agent:${context.agentId}`, tenantId: context.tenantId, scopes: [] }, {
      projectId: context.projectId,
      title: str(args, "title"),
      brief: str(args, "brief"),
    });
    if ("error" in result) throw new ToolInputError(result.error);
    return { initiativeId: result.initiativeId, note: "Das Team plant jetzt; Ugur sieht den Stand im Office unter Vorhaben." };
  },
};

export const workTools: Tool[] = [tasksList, taskCreate, taskRefine, askOwner, sprintPropose, initiativeStart];
