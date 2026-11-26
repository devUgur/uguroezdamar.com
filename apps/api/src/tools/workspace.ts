import type { Tool } from "./port.ts";
import { str } from "./port.ts";

const listProjects: Tool = {
  spec: {
    name: "projects_list",
    description: "Listet die verwalteten Projekte mit Repository, Domain und Status.",
    parameters: { type: "object", properties: {} },
  },
  async run(_args, context) {
    const { results } = await context.env.DB.prepare("SELECT id, name, repo, domain, status FROM projects ORDER BY name").all();
    return results;
  },
};

const remember: Tool = {
  spec: {
    name: "memory_save",
    description: "Speichert eine dauerhafte Notiz für dieses Projekt, z. B. eine Entscheidung von Ugur oder eine Konvention.",
    parameters: { type: "object", properties: { content: { type: "string" } }, required: ["content"] },
  },
  async run(args, context) {
    const id = crypto.randomUUID();
    await context.env.DB.prepare("INSERT INTO memories (id, agent_id, project_id, content) VALUES (?, ?, ?, ?)")
      .bind(id, context.agentId, context.projectId, str(args, "content"))
      .run();
    return { saved: id };
  },
};

export async function projectMemories(db: D1Database, projectId: string, limit = 30): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT content FROM memories WHERE project_id = ? ORDER BY created_at DESC LIMIT ?")
    .bind(projectId, limit)
    .all<{ content: string }>();
  return results.map((row) => row.content);
}

export const workspaceTools: Tool[] = [listProjects, remember];
