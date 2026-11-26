import type { Tool } from "./port.ts";
import { listRepositories } from "../projects/repositories.ts";
import { str } from "./port.ts";

const listProjects: Tool = {
  spec: {
    name: "projects_list",
    description:
      "Listet die registrierten Projekte (Repositories, an denen Agenten arbeiten dürfen) mit Sichtbarkeit und Schreibregel. Das sind nur die freigegebenen, nicht alle Repositories des GitHub-Kontos; dafür github_repositories_list nutzen.",
    parameters: { type: "object", properties: {} },
  },
  async run(_args, context) {
    const { results } = await context.env.DB.prepare(
      "SELECT id, name, repo, domain, visibility, default_branch AS defaultBranch, write_mode AS writeMode FROM projects WHERE status = 'active' ORDER BY name",
    ).all();
    return { count: results.length, projects: results };
  },
};

const listGithubRepositories: Tool = {
  spec: {
    name: "github_repositories_list",
    description:
      "Listet alle Repositories des freigegebenen GitHub-Kontos (nicht nur die registrierten Projekte) und ob sie registriert sind. Nur lesend. Antworte damit auf Fragen wie „wie viele Repositories gibt es“.",
    parameters: { type: "object", properties: {} },
  },
  async run(_args, context) {
    // Names of private repositories reach only models that do not evaluate requests (see ToolContext.allowPrivate).
    const mayShowPrivate = context.allowPrivate === true;
    const repositories = (await listRepositories(context.env, () => context.budget.take())).filter((repo) => !repo.archived);
    const visible = repositories.filter((repo) => mayShowPrivate || !repo.private);
    const privateCount = repositories.filter((repo) => repo.private).length;
    return {
      total: repositories.length,
      public: repositories.length - privateCount,
      private: privateCount,
      registered: repositories.filter((repo) => repo.projectId).length,
      repositories: visible.map(({ fullName, private: isPrivate, description, projectId }) => ({ fullName, private: isPrivate, description, registeredAs: projectId })),
      ...(mayShowPrivate
        ? {}
        : {
            note: `${privateCount} private Repositories existieren, werden aber in diesem Chat nicht namentlich genannt: Das Modell dürfte Inhalte auswerten. Sage Ugur das so und nenne die Lösung: im Chat ein Modell ohne Datenauswertung wählen (Workers AI oder Modal), dann stehen die Namen hier. Behaupte nicht, es gäbe keine privaten Repositories.`,
          }),
    };
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

export const workspaceTools: Tool[] = [listProjects, listGithubRepositories, remember];
