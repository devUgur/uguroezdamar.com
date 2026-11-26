import type { Env } from "../env.ts";

/**
 * GitHub App sign-in (ADR 0031). The app is signed with its private key (RS256 JWT, ten minutes),
 * which yields a short-lived installation token (one hour) per account it is installed on. Tokens
 * are cached in KV so a run does not pay the extra requests again; the key never leaves this module.
 */
const API = "https://api.github.com";
const INSTALLATIONS_TTL_SECONDS = 300;
/** Renew a cached token this long before GitHub would expire it. */
const TOKEN_MARGIN_SECONDS = 300;

export class GithubAccessError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

export interface Installation {
  id: number;
  account: string;
  /** "all": every repository of the account; "selected": only those chosen at installation. */
  selection: string;
}

export function appConfigured(env: Env): boolean {
  return Boolean(env.AGENT_GH_APP_ID && env.AGENT_GH_APP_PRIVATE_KEY);
}

const encoder = new TextEncoder();

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function derLength(length: number): number[] {
  if (length < 128) return [length];
  if (length < 256) return [0x81, length];
  return [0x82, length >> 8, length & 0xff];
}

/** GitHub hands out PKCS#1 keys ("BEGIN RSA PRIVATE KEY"); WebCrypto only reads PKCS#8, so the key is wrapped. */
export function toPkcs8(pem: string): Uint8Array {
  const text = pem.replace(/\\n/g, "\n");
  const body = text.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  if (!text.includes("BEGIN RSA PRIVATE KEY")) return der;
  const algorithm = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const inner = [0x02, 0x01, 0x00, ...algorithm, 0x04, ...derLength(der.length)];
  return Uint8Array.from([0x30, ...derLength(inner.length + der.length), ...inner, ...der]);
}

export async function appJwt(env: Env, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    toPkcs8(env.AGENT_GH_APP_PRIVATE_KEY ?? ""),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.AGENT_GH_APP_ID }));
  const unsigned = `${header}.${claims}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));
  return `${unsigned}.${base64url(signature)}`;
}

export async function appRequest<T>(path: string, init: RequestInit, bearer: string, beforeFetch?: () => void): Promise<T> {
  beforeFetch?.();
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${bearer}`,
      "user-agent": "uguroezdamar-api",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (response.status === 401) throw new GithubAccessError("GitHub lehnt die App-Anmeldung ab (App-ID oder Schlüssel falsch).", 502);
  if (!response.ok) throw new GithubAccessError(`GitHub antwortet mit ${response.status} auf ${path.split("?")[0]}.`, 502);
  return (await response.json()) as T;
}

/** Accounts the app is installed on. Cached for a few minutes. */
export async function installations(env: Env, beforeFetch?: () => void): Promise<Installation[]> {
  const cached = await env.CONFIG.get("github:installations");
  if (cached) return JSON.parse(cached) as Installation[];
  const rows = await appRequest<{ id: number; account: { login: string } | null; repository_selection: string }[]>(
    "/app/installations?per_page=100",
    {},
    await appJwt(env),
    beforeFetch,
  );
  const list = rows
    .filter((row) => row.account)
    .map((row) => ({ id: row.id, account: row.account?.login ?? "", selection: row.repository_selection }));
  // An empty list is not cached: right after installing the app, the next call must already see it.
  if (list.length) await env.CONFIG.put("github:installations", JSON.stringify(list), { expirationTtl: INSTALLATIONS_TTL_SECONDS });
  return list;
}

/** Installation token for an account, or null when the app is not installed there. */
export async function installationToken(env: Env, owner: string, beforeFetch?: () => void): Promise<string | null> {
  const installation = (await installations(env, beforeFetch)).find((entry) => entry.account.toLowerCase() === owner.toLowerCase());
  if (!installation) return null;
  const cacheKey = `github:token:${installation.id}`;
  const cached = await env.CONFIG.get(cacheKey);
  if (cached) return cached;
  const issued = await appRequest<{ token: string; expires_at: string }>(
    `/app/installations/${installation.id}/access_tokens`,
    { method: "POST" },
    await appJwt(env),
    beforeFetch,
  );
  const lifetime = Math.floor((Date.parse(issued.expires_at) - Date.now()) / 1000) - TOKEN_MARGIN_SECONDS;
  if (lifetime >= 60) await env.CONFIG.put(cacheKey, issued.token, { expirationTtl: lifetime });
  return issued.token;
}
