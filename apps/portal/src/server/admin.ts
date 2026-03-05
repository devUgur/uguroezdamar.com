import "server-only";

import { getDb, listLeads } from "@ugur/server";
import type { Admin } from "@ugur/server";

export async function getAdminOverview() {
  const { items: recentLeads } = await listLeads({ limit: 5 });
  const db = await getDb();
  const leadsCount = await db.collection("leads").countDocuments();

  return { recentLeads, leadsCount };
}

export async function getAdminsSnapshot() {
  const db = await getDb();
  const admins = await db.collection<Admin>("admins").find().sort({ createdAt: -1 }).toArray();
  return { admins };
}
