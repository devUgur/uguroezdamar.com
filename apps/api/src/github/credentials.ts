import type { Env } from "../env.ts";
import { appConfigured, GithubAccessError, installationToken, installations, type Installation } from "./app.ts";

/**
 * Which credential speaks to GitHub for an account. The GitHub App wins where it is installed
 * (short-lived, per-account, narrow permissions); the fine-grained token stays as fallback for
 * accounts the app does not cover and for user-level calls an installation cannot make.
 */
export type GithubMode = "app" | "token" | "none";

export function githubMode(env: Env): GithubMode {
  if (appConfigured(env)) return "app";
  return env.AGENT_GITHUB_TOKEN ? "token" : "none";
}

export function personalToken(env: Env): string {
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

/** Token for calls on one account's repositories. */
export async function githubToken(env: Env, owner: string, beforeFetch?: () => void): Promise<string> {
  if (appConfigured(env)) {
    const token = await installationToken(env, owner, beforeFetch);
    if (token) return token;
    if (!env.AGENT_GITHUB_TOKEN) {
      throw new GithubAccessError(`Die GitHub App ist für „${owner}“ nicht installiert.`, 403);
    }
  }
  return personalToken(env);
}

export interface GithubStatus {
  mode: GithubMode;
  tokenConfigured: boolean;
  /** Accounts the app is installed on; empty without an app. */
  installations: (Installation & { allowed: boolean })[];
}

export async function githubStatus(env: Env, allowedOwners: string[]): Promise<GithubStatus> {
  const list = appConfigured(env) ? await installations(env) : [];
  return {
    mode: githubMode(env),
    tokenConfigured: Boolean(env.AGENT_GITHUB_TOKEN),
    installations: list.map((entry) => ({ ...entry, allowed: allowedOwners.includes(entry.account.toLowerCase()) })),
  };
}
