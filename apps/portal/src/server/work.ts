import "server-only";

import { work } from "@ugur/server";

export async function getWorkItemsSnapshot() {
	return work.getWorkItems({ limit: 200 });
}

export async function getWorkItemById(id: string) {
	return work.getWorkItemBySlug(id);
}
