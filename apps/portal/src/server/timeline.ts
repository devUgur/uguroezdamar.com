import "server-only";

import { timeline } from "@ugur/server";

export async function getTimelineItemsSnapshot() {
	return timeline.getTimelineItems({ limit: 300 });
}

export async function getTimelineItemById(id: string) {
	return timeline.getTimelineItemById(id);
}