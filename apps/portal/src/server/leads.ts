import "server-only";

import { listLeads } from "@ugur/server";

export async function getLeadsPageData(opts: { limit?: number; cursor?: string; q?: string } = {}) {
	return listLeads(opts);
}
