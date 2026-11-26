import "server-only";

import { getAdminById } from "@ugur/server";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/src/adapters/auth";

export async function currentOrganizationAccess() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/organization");
  const admin = await getAdminById(session.adminId);
  return { actor: session.email, canManage: admin?.role === "owner" && admin.status === "active" };
}
