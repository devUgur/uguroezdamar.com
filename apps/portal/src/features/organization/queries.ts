import "server-only";

import { redirect } from "next/navigation";
import { agentsApi, AgentsApiError } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";
import type { OrganizationCatalog } from "./types";

export async function getOrganizationCatalog(): Promise<{ catalog: OrganizationCatalog | null; error: string | null }> {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/organization");
  try {
    return { catalog: await agentsApi<OrganizationCatalog>("/api/organization", session.email), error: null };
  } catch (error) {
    if (error instanceof AgentsApiError && error.status === 404) {
      return { catalog: null, error: "Der Organisationskatalog fehlt noch in der Agenten-API. Bitte API-Dev aktualisieren." };
    }
    return { catalog: null, error: error instanceof Error ? error.message : "Organisationskatalog konnte nicht geladen werden." };
  }
}
