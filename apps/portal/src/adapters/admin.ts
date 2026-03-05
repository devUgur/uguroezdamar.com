import "server-only";

import { countContactRequests, listAdmins, listContactRequests, getAdminById } from "@ugur/server";

export async function getAdminOverview() {
  const { items: recentInquiries } = await listContactRequests({ limit: 5 });
  const inquiriesCount = await countContactRequests();

  return { recentInquiries, inquiriesCount };
}

export async function getAdminsSnapshot() {
  const admins = await listAdmins();
  return { admins };
}

export async function getAdminDetail(id: string) {
  return getAdminById(id);
}
