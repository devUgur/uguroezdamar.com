import "server-only";

import { redirect } from "next/navigation";
import { currentOrganizationAccess } from "@/src/server/organization-access";

export async function requirePortfolioOwner() {
  const access = await currentOrganizationAccess();
  if (!access.canManage) redirect("/portfolio?error=Owner-Berechtigung+erforderlich");
  return { actor: access.actor, scopes: ["portfolio:write"] as const };
}
