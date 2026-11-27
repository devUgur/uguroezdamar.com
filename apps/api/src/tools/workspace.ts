import type { Tool } from "./port.ts";
import type { SqlPort } from "../platform/ports.ts";
import { createRepository, listRepositories, registerProject } from "../projects/repositories.ts";
import { str } from "./port.ts";

const listProjects: Tool = {
  spec: {
    name: "projects_list",
    description:
      "Registrierte Projekte mit Sichtbarkeit und Schreibregel (nicht alle Repositories: dafür github_repositories_list).",
    parameters: { type: "object", properties: {} },
  },
  async run(_args, context) {
    const { results } = await context.env.DB.prepare(
      "SELECT id, name, repo, domain, visibility, default_branch AS defaultBranch, write_mode AS writeMode FROM projects WHERE tenant_id = ? AND status = 'active' ORDER BY name",
    )
      .bind(context.tenantId)
      .all();
    return { count: results.length, projects: results };
  },
};

const listGithubRepositories: Tool = {
  spec: {
    name: "github_repositories_list",
    description:
      "Alle Repositories des Kontos und ob sie registriert sind. Nur lesend.",
    parameters: { type: "object", properties: {} },
  },
  async run(_args, context) {
    const repositories = (await listRepositories(context.env, context.tenantId, () => context.budget.take())).filter((repo) => !repo.archived);
    const privateCount = repositories.filter((repo) => repo.private).length;
    // The names go to the model next: from here on this thread only runs on models that do not evaluate requests.
    if (privateCount) await context.markPrivate?.(repositories.filter((repo) => repo.private).map((repo) => repo.fullName));
    return {
      total: repositories.length,
      public: repositories.length - privateCount,
      private: privateCount,
      registered: repositories.filter((repo) => repo.projectId).length,
      repositories: repositories.map(({ fullName, private: isPrivate, description, projectId }) => ({ fullName, private: isPrivate, description, registeredAs: projectId })),
    };
  },
};

const registerProjectTool: Tool = {
  requiresApproval: true,
  spec: {
    name: "project_register",
    description:
      "Schlägt vor, ein Repository als Projekt zu registrieren, damit Agenten dort schreiben dürfen (agent/…-Branches, per PR). Braucht Ugurs Freigabe.",
    parameters: { type: "object", properties: { repo: { type: "string", description: "owner/name" } }, required: ["repo"] },
  },
  async run(args, context) {
    const result = await registerProject(context.env, context.tenantId, str(args, "repo").trim());
    return {
      projectId: result.id,
      created: result.created,
      writeMode: "pr-only",
      hint: "Ugur wechselt im Chat-Kopf auf dieses Projekt; geschrieben wird nur auf agent/…-Branches per Pull Request.",
    };
  },
};

const createRepositoryTool: Tool = {
  requiresApproval: true,
  spec: {
    name: "repo_create",
    description:
      "Schlägt ein neues Repository auf Ugurs Konto vor und registriert es; standardmäßig privat. Braucht Ugurs Freigabe.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "ohne Besitzer" },
        description: { type: "string" },
        private: { type: "boolean", description: "Standard true" },
      },
      required: ["name"],
    },
  },
  async run(args, context) {
    return createRepository(context.env, context.tenantId, {
      name: str(args, "name").trim(),
      description: typeof args.description === "string" ? args.description : undefined,
      private: args.private !== false,
    });
  },
};

const remember: Tool = {
  spec: {
    name: "memory_save",
    description: "Speichert eine dauerhafte Projektnotiz, z. B. eine Entscheidung oder Konvention.",
    parameters: { type: "object", properties: { content: { type: "string" } }, required: ["content"] },
  },
  async run(args, context) {
    const id = crypto.randomUUID();
    await context.env.DB.prepare("INSERT INTO memories (id, tenant_id, agent_id, project_id, content) VALUES (?, ?, ?, ?, ?)")
      .bind(id, context.tenantId, context.agentId, context.projectId, str(args, "content"))
      .run();
    return { saved: id };
  },
};

export async function projectMemories(db: SqlPort, tenantId: string, projectId: string, limit = 30): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT content FROM memories WHERE tenant_id = ? AND project_id = ? ORDER BY created_at DESC LIMIT ?")
    .bind(tenantId, projectId, limit)
    .all<{ content: string }>();
  return results.map((row) => row.content);
}

export const workspaceTools: Tool[] = [listProjects, listGithubRepositories, registerProjectTool, createRepositoryTool, remember];
