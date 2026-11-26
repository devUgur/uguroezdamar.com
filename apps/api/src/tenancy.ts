/**
 * Tenancy (ADR 0032). A tenant is a customer; the owner is the first one. Every row of the tables listed
 * in TENANT_TABLES carries `tenant_id`, and every query on them states which tenant it is about.
 *
 * Two ways to state it, both checked by tests/api-tenancy.test.ts:
 * - the statement itself filters or writes `tenant_id`, or
 * - it is tagged `/* tenant:parent *\/`: it only touches rows reached through a parent row (a thread, a task,
 *   an approval) that an earlier statement already read for this tenant.
 */
export const OWNER_TENANT = "owner";

/** Tables whose rows belong to one tenant. The staff (agents, organization catalog) is shared by all tenants for now. */
export const TENANT_TABLES = ["projects", "threads", "tasks", "task_reviews", "approvals", "events", "memories"] as const;

/**
 * Every table a tenant's rows live in: the ones above, the installations that connect a tenant to GitHub, the
 * tenant's model keys and model choices (ADR 0033), its sprints and its preview URLs (ADR 0036).
 */
export const TENANT_SCOPED_TABLES = [...TENANT_TABLES, "tenant_installations", "provider_credentials", "tenant_model_defaults", "sprints", "agent_settings", "working_memory", "knowledge_sources", "knowledge_chunks", "knowledge_fts", "portfolio_projects", "portfolio_project_repositories", "portfolio_audit", "previews"] as const;

/**
 * Name of the Durable Object of a chat thread. The owner keeps the original name so existing threads and
 * their stored history stay reachable; other tenants get a namespace of their own.
 */
export function threadObjectName(tenantId: string, threadId: string): string {
  return tenantId === OWNER_TENANT ? `thread:${threadId}` : `t:${tenantId}:thread:${threadId}`;
}

/** Name of the office presence object of a tenant; the owner keeps "main". */
export function officeObjectName(tenantId: string): string {
  return tenantId === OWNER_TENANT ? "main" : `t:${tenantId}:office`;
}

/** Name of the live hub every browser of a tenant connects to; the owner keeps "main". */
export function hubObjectName(tenantId: string): string {
  return tenantId === OWNER_TENANT ? "main" : `t:${tenantId}:hub`;
}
