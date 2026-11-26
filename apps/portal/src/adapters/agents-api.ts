import "server-only";

import { isUuid } from "@ugur/server";

/**
 * The agent API (apps/api, ADR 0024). Only the portal server calls it: the service token stays
 * on the server, and every call names the signed-in admin for the API's audit trail.
 */
export class AgentsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function config(): { origin: string; token: string } {
  const origin = process.env.API_URL?.replace(/\/+$/, "") ?? "";
  const token = process.env.API_SERVICE_TOKEN ?? "";
  if (!origin || !token) throw new AgentsApiError("Agenten-API ist nicht konfiguriert (API_URL, API_SERVICE_TOKEN).", 503);
  return { origin, token };
}

/** Thread and approval ids are UUIDs; anything else never reaches the API. */
export function isAgentsApiId(value: string): boolean {
  return isUuid(value);
}

/** Public origin of the API; the browser opens the live WebSocket there with a one-time ticket. */
export function agentsApiOrigin(): string | null {
  return process.env.API_URL?.replace(/\/+$/, "") || null;
}

export async function agentsApi<T>(
  path: string,
  actor: string,
  init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; scopes?: readonly string[] } = {},
): Promise<T> {
  const { origin, token } = config();
  let response: Response;
  try {
    response = await fetch(`${origin}${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "x-portal-actor": actor,
        ...(init.scopes?.length ? { "x-portal-scopes": init.scopes.join(",") } : {}),
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch (error) {
    console.error("agents api unreachable", path, error instanceof Error ? error.message : error);
    throw new AgentsApiError("Agenten-API nicht erreichbar.", 502);
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    console.error("agents api error", path, response.status, data.error);
    throw new AgentsApiError(data.error ?? `Agenten-API antwortet mit ${response.status}.`, response.status);
  }
  return data as T;
}
