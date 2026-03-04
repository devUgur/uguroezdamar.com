import "server-only";

import { timeline } from "@ugur/server";

export async function getAdminTimelineItemsSnapshot() {
	return timeline.getTimelineItems({ limit: 300 });
}

export async function getAdminTimelineItemSnapshotById(id: string) {
	return timeline.getTimelineItemById(id);
}