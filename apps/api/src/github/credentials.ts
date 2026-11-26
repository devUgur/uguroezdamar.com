import type { Env } from "../env.ts";
import { OWNER_TENANT } from "../tenancy.ts";
import { appConfigured, GithubAccessError, installations, installationToken } from "./app.ts";
import { allowedOwnersFor, tenantInstallations, type TenantInstallation } from "./tenants.ts";

/**
 * Which credential speaks to GitHub for an account. The GitHub App wins where it is installed
 * (short-lived, per-account, narrow permissions); the owner's fine-grained token stays as fallback for
 * accounts the app does not cover and for user-level calls an installation cannot make. Only the owner
 * tenant may ever use that token: a customer's calls go through its own installations or fail.
 */
export type GithubMode = "app" | "token" | "none";

export function githubMode(env: Env): GithubMode {
  if (appConfigured(env)) return "app";
  return env.AGENT_GITHUB_TOKEN ? "token" : "none";
}

export function personalToken(env: Env, tenantId: string): string {
  if (tenantId !== OWNER_TENANT) {
    throw new GithubAccessError("Dieser Zugang gehört dem Owner; für dieses Konto ist die GitHub App nötig.", 403);
  }
  if (!env.AGENT_GITHUB_TOKEN) {
    throw new GithubAccessError(
      appConfigured(env)
        ? "Für diese Aktion fehlt AGENT_GITHUB_TOKEN: Eine GitHub App kann keine Repositories auf einem persönlichen Konto anlegen."
        : "Weder GitHub App noch AGENT_GITHUB_TOKEN sind eingerichtet.",
      503,
    );
  }
  return env.AGENT_GITHUB_TOKEN;
}

/** Token for calls on one account's repositories, for one tenant. */
export async function githubToken(env: Env, tenantId: string, owner: string, beforeFetch?: () => void): Promise<string> {
  if (appConfigured(env)) {
    const token = await installationToken(env, owner, beforeFetch);
    if (token) return token;
    if (tenantId !== OWNER_TENANT || !env.AGENT_GITHUB_TOKEN) {
      throw new GithubAccessError(`Die GitHub App ist für „${owner}“ nicht installiert.`, 403);
    }
  }
  return personalToken(env, tenantId);
}

export interface GithubStatus {
  mode: GithubMode;
  tokenConfigured: boolean;
  /** Installations this tenant connected, plus (owner only) accounts allowed by hand; `allowed` is whether agents may use them. */
  installations: (TenantInstallation & { allowed: boolean })[];
  /** Accounts that may be used with no installation record, the owner's GITHUB_OWNERS list. */
  configuredOnly: string[];
}

export async function githubStatus(env: Env, tenantId: string): Promise<GithubStatus> {
  const [connected, allowed] = await Promise.all([tenantInstallations(env, tenantId), allowedOwnersFor(env, tenantId)]);
  // The owner installed the app by hand before the connect flow existed: its installations show up from GitHub itself.
  const fromApp: TenantInstallation[] =
    tenantId === OWNER_TENANT && appConfigured(env)
      ? (await installations(env)).map((entry) => ({ installationId: entry.id, account: entry.account, selection: entry.selection }))
      : [];
  const all = new Map([...fromApp, ...connected].map((entry) => [entry.installationId, entry]));
  const known = new Set([...all.values()].map((entry) => entry.account.toLowerCase()));
  return {
    mode: tenantId === OWNER_TENANT ? githubMode(env) : appConfigured(env) ? "app" : "none",
    tokenConfigured: tenantId === OWNER_TENANT && Boolean(env.AGENT_GITHUB_TOKEN),
    installations: [...all.values()].map((entry) => ({ ...entry, allowed: allowed.includes(entry.account.toLowerCase()) })),
    configuredOnly: allowed.filter((account) => !known.has(account)),
  };
}
