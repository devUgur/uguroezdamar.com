import "server-only";

import { work } from "@ugur/server";

export async function getAdminWorkItemsSnapshot() {
	return work.getWorkItems({ limit: 200 });
}

export async function getAdminWorkItemSnapshotById(id: string) {
	return work.getWorkItemBySlug(id);
}
