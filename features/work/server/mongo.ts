import "server-only";

export {
	createWorkItem,
	ensureWorkIndexes,
	getWorkItemBySlug,
	getWorkItems,
	softDeleteWorkItem,
	updateWorkItem,
} from "@ugur/server";
export type { CoverImage, DbWork, Links, WorkItem } from "@ugur/server";
