import type { Env } from "../env.ts";
import { appConfigured, appJwt, appRequest, GithubAccessError } from "./app.ts";

/**
 * "Connect GitHub" (ADR 0032): the browser goes to the app's installation page with a signed `state`, GitHub sends
 * it back to our Setup URL with the new installation id, and the installation is recorded for the tenant that
 * started the flow. The state is signed, expires after ten minutes and works once, so nobody can attach an
 * installation to a tenant that did not ask for it.
 */
const STATE_TTL_SECONDS = 600;
const SLUG_TTL_SECONDS = 86_400;
const encoder = new TextEncoder();

interface StatePayload {
  /** Tenant that started the flow. */
  t: string;
  /** Where the browser returns to afterwards. */
  r: string;
  /** One-time value. */
  n: string;
  /** Expiry, seconds since epoch. */
  e: number;
}

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

/** The signing key derives from the service token with a purpose label, so it needs no secret of its own. */
async function stateKey(env: Env, usage: "sign" | "verify"): Promise<CryptoKey> {
  if (!env.API_SERVICE_TOKEN) throw new GithubAccessError("API_SERVICE_TOKEN fehlt.", 503);
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(`github-connect:${env.API_SERVICE_TOKEN}`));
  return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signState(env: Env, payload: StatePayload): Promise<string> {
  const body = base64url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign("HMAC", await stateKey(env, "sign"), encoder.encode(body));
  return `${body}.${base64url(signature)}`;
}

/** The payload of a state that is genuine and unexpired, else null. Does not consume it. */
export async function readState(env: Env, state: string, now = Math.floor(Date.now() / 1000)): Promise<StatePayload | null> {
  const [body, signature] = state.split(".");
  if (!body || !signature) return null;
  let valid = false;
  try {
    valid = await crypto.subtle.verify("HMAC", await stateKey(env, "verify"), fromBase64url(signature), encoder.encode(body));
  } catch {
    return null;
  }
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as StatePayload;
    return typeof payload.t === "string" && typeof payload.r === "string" && typeof payload.n === "string" && payload.e > now ? payload : null;
  } catch {
    return null;
  }
}

/** The browser may only return to https pages or a local development server, never to a URL with credentials. */
export function safeReturnUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The app's URL name ("slug"), which the installation page needs. Asked from GitHub and cached. */
export async function appSlug(env: Env, beforeFetch?: () => void): Promise<string> {
  const cached = await env.CONFIG.get("github:app-slug");
  if (cached) return cached;
  const app = await appRequest<{ slug: string }>("/app", {}, await appJwt(env), beforeFetch);
  await env.CONFIG.put("github:app-slug", app.slug, { expirationTtl: SLUG_TTL_SECONDS });
  return app.slug;
}

/** The link the "Connect GitHub" button leads to. */
export async function startConnect(env: Env, tenantId: string, returnTo: string): Promise<string> {
  if (!appConfigured(env)) throw new GithubAccessError("Die GitHub App ist noch nicht eingerichtet.", 503);
  const target = safeReturnUrl(returnTo);
  if (!target) throw new GithubAccessError("Ungültige Rücksprung-Adresse.", 400);
  const now = Math.floor(Date.now() / 1000);
  const state = await signState(env, { t: tenantId, r: target, n: crypto.randomUUID(), e: now + STATE_TTL_SECONDS });
  const slug = await appSlug(env);
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`;
}

export interface ConnectResult {
  returnTo: string;
  /** What the browser shows after the redirect. */
  notice?: string;
  error?: string;
}

/**
 * GitHub's redirect after the installation. Verifies the state, asks GitHub about the installation itself (the
 * id in the URL is only a claim) and records it for the tenant. An installation another tenant already owns is refused.
 */
export async function completeConnect(env: Env, installationId: number, state: string): Promise<ConnectResult> {
  const payload = await readState(env, state);
  if (!payload) return { returnTo: "", error: "Der Verbindungslink ist abgelaufen oder ungültig. Bitte noch einmal auf „GitHub verbinden“ klicken." };
  const fail = (error: string): ConnectResult => ({ returnTo: payload.r, error });

  const marker = `github:state:${payload.n}`;
  if (await env.CONFIG.get(marker)) return fail("Dieser Verbindungslink wurde schon benutzt. Bitte noch einmal auf „GitHub verbinden“ klicken.");
  await env.CONFIG.put(marker, "1", { expirationTtl: 3600 });

  if (!Number.isInteger(installationId) || installationId < 1) return fail("GitHub hat keine Installation gemeldet.");
  let installation: { id: number; account: { login: string } | null; repository_selection: string; suspended_at: string | null };
  try {
    installation = await appRequest(`/app/installations/${installationId}`, {}, await appJwt(env));
  } catch {
    return fail("GitHub kennt diese Installation nicht.");
  }
  if (!installation.account) return fail("Die Installation gehört zu keinem Konto.");
  if (installation.suspended_at) return fail("Die Installation ist ausgesetzt.");

  const owner = await env.DB.prepare("/* tenant:platform */ SELECT tenant_id FROM tenant_installations WHERE installation_id = ?")
    .bind(installationId)
    .first<{ tenant_id: string }>();
  if (owner && owner.tenant_id !== payload.t) return fail("Diese Installation ist schon mit einem anderen Konto verbunden.");

  await env.DB.prepare(
    `INSERT INTO tenant_installations (installation_id, tenant_id, account, selection, status) VALUES (?, ?, ?, ?, 'active')
     ON CONFLICT(installation_id) DO UPDATE SET account = excluded.account, selection = excluded.selection, status = 'active'
       WHERE tenant_installations.tenant_id = excluded.tenant_id`,
  )
    .bind(installationId, payload.t, installation.account.login, installation.repository_selection)
    .run();
  await env.CONFIG.delete("github:installations");
  return { returnTo: payload.r, notice: `GitHub-Konto „${installation.account.login}“ verbunden.` };
}
