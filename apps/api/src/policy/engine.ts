import type { SqlPort } from "../platform/ports.ts";
import { AUTONOMY_LEVELS, CLASSES, classify, DEFAULT_AUTONOMY, type ActionClass, type AutonomyLevel } from "./catalog.ts";

/**
 * The policy engine (ADR 0040, phase P2). One question before every tool call: run it, ask Ugur, or refuse it.
 * Pure decision plus a small data layer (project_policies, policy_decisions); the agent loop calls it through LoopDeps.
 */

/** Changes whenever the catalog or a rule changes; every logged decision names it. */
export const POLICY_VERSION = "2026-11-27.1";

export type Decision = "allow" | "approve" | "deny";

export interface PolicyDecision {
  decision: Decision;
  class: ActionClass;
  level: AutonomyLevel;
  reason: string;
  detail: string;
  policyVersion: string;
}

export interface DecisionInput {
  tool: string;
  args: Record<string, unknown>;
  /** The tool declares that it writes (Tool.requiresApproval): an uncatalogued writing tool never runs automatically. */
  writes: boolean;
  /** Only within a project (Tool.requiresProject). */
  needsProject: boolean;
  /** Repository of the conversation; empty on the company level. */
  repo: string;
  level: AutonomyLevel;
  writeMode?: "pr-only" | "dev-first";
}

const LEVEL_LABEL: Record<AutonomyLevel, string> = { manual: "Manuell", balanced: "Ausgewogen", high: "Hoch", max: "Maximal" };

export function decide(input: DecisionInput): PolicyDecision {
  const action = classify(input.tool, input.args, input.writeMode);
  const base = { class: action.class, level: input.level, detail: action.detail, policyVersion: POLICY_VERSION };
  if (input.needsProject && !input.repo) {
    return { ...base, decision: "deny", reason: "Firmenebene ohne Projekt: Schreiben geht nur in einem Projekt. Ugur öffnet das Gespräch im Office im passenden Projekt, oder du schlägst mit project_register ein Repository vor." };
  }
  if (action.class === "read" && input.writes) {
    return { ...base, decision: "approve", reason: "Schreibendes Werkzeug ohne Eintrag im Aktionskatalog: immer mit Freigabe." };
  }
  const rule = CLASSES[action.class];
  const verdict = rule.levels[input.level];
  if (verdict === "allow") {
    return { ...base, decision: "allow", reason: action.class === "read" ? "Lesen ist immer erlaubt." : `${rule.label}: automatisch bei Autonomie „${LEVEL_LABEL[input.level]}“.` };
  }
  return {
    ...base,
    decision: "approve",
    reason: rule.hard ? `${rule.label}: immer mit Freigabe (globale Grenze).` : `${rule.label}: Freigabe nötig bei Autonomie „${LEVEL_LABEL[input.level]}“.`,
  };
}

export function isAutonomyLevel(value: unknown): value is AutonomyLevel {
  return typeof value === "string" && (AUTONOMY_LEVELS as readonly string[]).includes(value);
}

export interface ProjectPolicy {
  projectId: string;
  level: AutonomyLevel;
  /** Optimistic concurrency for edits; 0 means "never set", the default applies. */
  version: number;
  updatedBy: string | null;
  updatedAt: number | null;
}

export async function loadProjectPolicy(db: SqlPort, tenantId: string, projectId: string): Promise<ProjectPolicy> {
  const row = projectId
    ? await db.prepare("SELECT level, version, updated_by, updated_at FROM project_policies WHERE tenant_id = ? AND project_id = ?")
        .bind(tenantId, projectId)
        .first<{ level: string; version: number; updated_by: string | null; updated_at: number | null }>()
    : null;
  return {
    projectId,
    level: row && isAutonomyLevel(row.level) ? row.level : DEFAULT_AUTONOMY,
    version: row?.version ?? 0,
    updatedBy: row?.updated_by ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

export async function listProjectPolicies(db: SqlPort, tenantId: string): Promise<ProjectPolicy[]> {
  const { results } = await db.prepare(
    `SELECT p.id AS project_id, pp.level, pp.version, pp.updated_by, pp.updated_at
       FROM projects p LEFT JOIN project_policies pp ON pp.tenant_id = p.tenant_id AND pp.project_id = p.id
      WHERE p.tenant_id = ? AND p.status = 'active' ORDER BY p.name`,
  )
    .bind(tenantId)
    .all<{ project_id: string; level: string | null; version: number | null; updated_by: string | null; updated_at: number | null }>();
  return results.map((row) => ({
    projectId: row.project_id,
    level: isAutonomyLevel(row.level) ? row.level : DEFAULT_AUTONOMY,
    version: row.version ?? 0,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }));
}

/** Sets a project's level if nobody changed it since `version`; returns the new policy, or null on a conflict. */
export async function saveProjectPolicy(db: SqlPort, tenantId: string, projectId: string, level: AutonomyLevel, version: number, actor: string): Promise<ProjectPolicy | null> {
  const result = version === 0
    ? await db.prepare("INSERT OR IGNORE INTO project_policies (tenant_id, project_id, level, version, updated_by) VALUES (?, ?, ?, 1, ?)")
        .bind(tenantId, projectId, level, actor)
        .run()
    : await db.prepare("UPDATE project_policies SET level = ?, version = version + 1, updated_by = ?, updated_at = unixepoch() WHERE tenant_id = ? AND project_id = ? AND version = ?")
        .bind(level, actor, tenantId, projectId, version)
        .run();
  if (!result.meta.changes) return null;
  return loadProjectPolicy(db, tenantId, projectId);
}

export interface DecisionRecord {
  tenantId: string;
  runId?: string;
  threadId?: string;
  agentId?: string;
  projectId?: string;
  tool: string;
  decision: PolicyDecision;
  approvalId?: string | null;
}

/** Every decision about a writing action is logged; reads are not, they would drown the log. Never breaks a run. */
export async function recordDecision(db: SqlPort, record: DecisionRecord): Promise<void> {
  if (record.decision.class === "read" && record.decision.decision === "allow") return;
  try {
    await db.prepare(
      `INSERT INTO policy_decisions (tenant_id, run_id, thread_id, agent_id, project_id, tool, action_class, level, decision, reason, detail, policy_version, approval_id, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        record.tenantId, record.runId ?? null, record.threadId ?? null, record.agentId ?? null, record.projectId || null, record.tool,
        record.decision.class, record.decision.level, record.decision.decision, record.decision.reason.slice(0, 500), record.decision.detail.slice(0, 500),
        record.decision.policyVersion, record.approvalId ?? null, Date.now(),
      )
      .run();
  } catch (error) {
    console.error("policy decision log failed", error instanceof Error ? error.message : error);
  }
}
