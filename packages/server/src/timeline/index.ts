import "server-only";

import {
	createTimelineItem,
	ensureTimelineIndexes,
	getTimelineItemById,
	getTimelineItems,
	softDeleteTimelineItem,
	updateTimelineItem,
} from "./repo";

export {
	createTimelineItem,
	ensureTimelineIndexes,
	getTimelineItemById,
	getTimelineItems,
	softDeleteTimelineItem,
	updateTimelineItem,
} from "./repo";
export { CreateTimelineItemSchema, TimelineVisibilitySchema, UpdateTimelineItemSchema } from "./validators";

export const timeline = {
	getTimelineItems,
	getTimelineItemById,
	createTimelineItem,
	updateTimelineItem,
	softDeleteTimelineItem,
	ensureTimelineIndexes,
};

export type { DbTimelineItem, TimelineItem, TimelineItemStatus, TimelineItemType, TimelineVisibility } from "./repo";
export type { CreateTimelineItemInput, UpdateTimelineItemInput } from "./validators";