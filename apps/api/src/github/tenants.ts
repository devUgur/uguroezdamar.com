import type { Env } from "../env.ts";
import { OWNER_TENANT } from "../tenancy.ts";

/** A GitHub App installation a tenant connected (ADR 0032): the account it covers and which repositories it sees. */
export interface TenantInstallation {
  installationId: number;
  account: string;
  selection: string;
}

/** Accounts named in the GITHUB_OWNERS variable: the owner's own, configured by hand. */
export function configuredOwners(env: Env): string[] {
  return (env.GITHUB_OWNERS ?? "")
    .split(",")
    .map((owner) => owner.trim().toLowerCase())
    .filter(Boolean);
}

export async function tenantInstallations(env: Env, tenantId: string): Promise<TenantInstallation[]> {
  const { results } = await env.DB.prepare(
    "SELECT installation_id, account, selection FROM tenant_installations WHERE tenant_id = ? AND status = 'active' ORDER BY account",
  )
    .bind(tenantId)
    .all<{ installation_id: number; account: string; selection: string }>();
  return results.map((row) => ({ installationId: row.installation_id, account: row.account, selection: row.selection }));
}

/**
 * Accounts whose repositories a tenant's agents may use. A customer only gets the accounts it connected itself;
 * the owner additionally keeps the hand-written GITHUB_OWNERS list. Lower case.
 */
export async function allowedOwnersFor(env: Env, tenantId: string): Promise<string[]> {
  const connected = (await tenantInstallations(env, tenantId)).map((entry) => entry.account.toLowerCase());
  const configured = tenantId === OWNER_TENANT ? configuredOwners(env) : [];
  return [...new Set([...configured, ...connected])];
}
