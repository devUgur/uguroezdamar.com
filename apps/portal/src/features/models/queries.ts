import "server-only";

import { agentsApi } from "@/src/adapters/agents-api";
import { currentOrganizationAccess } from "@/src/server/organization-access";
import type { Catalog, Credential, ModelSettings } from "./types";

/** Catalog, stored keys (metadata only) and whether the signed-in admin may change them. Errors go to the page. */
export async function getModelSettings(): Promise<ModelSettings> {
  const access = await currentOrganizationAccess();
  try {
    const [catalog, stored] = await Promise.all([
      agentsApi<Catalog>("/api/models", access.actor),
      agentsApi<{ keyStore: boolean; credentials: Credential[] }>("/api/providers/credentials", access.actor),
    ]);
    return { catalog: { ...catalog, defaults: catalog.defaults ?? [], keyStore: catalog.keyStore ?? stored.keyStore }, credentials: stored.credentials, canManage: access.canManage, error: null };
  } catch (error) {
    return { catalog: null, credentials: [], canManage: access.canManage, error: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}
