import { AGENTS } from "../agents/registry.ts";
import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";
import { DEFAULT_MODEL_CONFIG } from "./config.ts";
import {
  clearModelDefault,
  CredentialError,
  CUSTOM_PROVIDER,
  deleteCredential,
  keyStoreConfigured,
  listCredentials,
  loadTenantKeys,
  recordVerification,
  saveCredential,
  setModelDefault,
  type CredentialInput,
} from "./credentials.ts";
import { discoverModels } from "./discover.ts";
import { ModelRouter } from "./router.ts";
import { secret } from "../env.ts";
import { OWNER_TENANT } from "../tenancy.ts";

/** Changing keys or model choices needs this scope; the portal grants it only to the owner (ADR 0033). */
export const PROVIDERS_WRITE = "providers:write";
const PROVIDER_ID = "([a-z0-9-]{1,40})";
const ALIAS = "([a-z0-9-]{1,40})";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

async function body<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}

/** Model catalog, provider keys (never their values) and the tenant's model choices. */
export async function handleModels(request: Request, env: Env, caller: Caller, path: string): Promise<Response | null> {
  const method = request.method;

  if (path === "/api/models" && method === "GET") {
    const router = await ModelRouter.load(env, caller.tenantId);
    return json({
      ...router.catalog(),
      agentAliases: Object.fromEntries(Object.values(AGENTS).map((agent) => [agent.id, agent.modelAlias])),
      keyStore: keyStoreConfigured(env),
    });
  }

  if (path === "/api/providers/credentials" && method === "GET") {
    return json({ keyStore: keyStoreConfigured(env), credentials: await listCredentials(env, caller.tenantId) });
  }

  const keyMatch = path.match(new RegExp(`^/api/providers/${PROVIDER_ID}/key$`));
  const verifyMatch = path.match(new RegExp(`^/api/providers/${PROVIDER_ID}/verify$`));
  const defaultMatch = path.match(new RegExp(`^/api/models/defaults/${ALIAS}$`));
  if (!keyMatch && !verifyMatch && !defaultMatch) return null;
  if (!caller.scopes.includes(PROVIDERS_WRITE)) return json({ error: "Nur der Owner darf Modellschlüssel und Modellwahl ändern." }, 403);

  try {
    if (keyMatch && method === "PUT") {
      const providerId = keyMatch[1] ?? "";
      const stored = await saveCredential(env, caller.tenantId, caller.actor, providerId, (await body<CredentialInput>(request)) as CredentialInput);
      // Test right away: a wrong key shows up in the portal, not in the middle of an agent run.
      const verification = await verify(env, caller.tenantId, providerId);
      return json({ credential: { ...stored, ...verification } }, 200);
    }
    if (keyMatch && method === "DELETE") {
      return (await deleteCredential(env, caller.tenantId, keyMatch[1] ?? "")) ? json({ ok: true }) : json({ error: "Kein Schlüssel hinterlegt." }, 404);
    }
    if (verifyMatch && method === "POST") {
      return json(await verify(env, caller.tenantId, verifyMatch[1] ?? ""));
    }
    if (defaultMatch && method === "PUT") {
      const alias = defaultMatch[1] ?? "";
      if (!DEFAULT_MODEL_CONFIG.aliases[alias]) return json({ error: "Unbekannte Rolle." }, 400);
      const input = await body<{ provider: string; model: string }>(request);
      const router = await ModelRouter.load(env, caller.tenantId);
      const choice = { provider: String(input.provider ?? ""), model: String(input.model ?? "") };
      if (!router.offers(choice)) return json({ error: "Dieses Modell bietet der Anbieter nicht an." }, 400);
      await setModelDefault(env, caller.tenantId, caller.actor, { alias, ...choice });
      return json({ ok: true });
    }
    if (defaultMatch && method === "DELETE") {
      await clearModelDefault(env, caller.tenantId, defaultMatch[1] ?? "");
      return json({ ok: true });
    }
  } catch (error) {
    if (error instanceof CredentialError) return json({ error: error.message }, error.status);
    throw error;
  }
  return json({ error: "Methode nicht erlaubt" }, 405);
}

/** Lists the provider's models with the stored key (or the owner's Worker secret) and records the result. */
async function verify(env: Env, tenantId: string, providerId: string): Promise<{ ok: boolean; models: string[] | null; lastError: string | null }> {
  const keys = await loadTenantKeys(env, tenantId);
  const tenantKey = keys.get(providerId);
  const provider = DEFAULT_MODEL_CONFIG.providers[providerId];
  const ownerKey = tenantId === OWNER_TENANT && provider?.apiKeySecret ? secret(env, provider.apiKeySecret) : undefined;
  const apiKey = tenantKey?.apiKey ?? ownerKey;
  const baseUrl = tenantKey?.baseUrl ?? provider?.baseUrl;
  const kind = provider?.kind === "anthropic" ? "anthropic" : "openai-compatible";
  if (!apiKey || !baseUrl || (!provider && !CUSTOM_PROVIDER.test(providerId))) {
    throw new CredentialError("Für diesen Anbieter ist kein Schlüssel hinterlegt.", 404);
  }
  try {
    const models = await discoverModels({ kind, baseUrl, apiKey });
    if (tenantKey) await recordVerification(env, tenantId, providerId, { models });
    return { ok: true, models, lastError: null };
  } catch (error) {
    // The provider's answer can quote the request; it never contains the key, but stays short anyway.
    const message = (error instanceof Error ? error.message : String(error)).replaceAll(apiKey, "…").slice(0, 300);
    if (tenantKey) await recordVerification(env, tenantId, providerId, { error: message });
    return { ok: false, models: null, lastError: message };
  }
}
