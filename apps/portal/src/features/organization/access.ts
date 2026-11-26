import "server-only";

import { redirect } from "next/navigation";
import { currentOrganizationAccess } from "@/src/server/organization-access";

export async function getOrganizationAccess() {
  return currentOrganizationAccess();
}

export async function requireOrganizationOwner() {
  const access = await getOrganizationAccess();
  if (!access.canManage) redirect("/organization?error=Owner-Berechtigung+erforderlich");
  return { actor: access.actor, scopes: ["organization:write"] as const };
}
