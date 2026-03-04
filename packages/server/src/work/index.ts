import "server-only";

import {
	createWorkItem,
	ensureWorkIndexes,
	getWorkItemBySlug,
	getWorkItems,
	softDeleteWorkItem,
	updateWorkItem,
} from "./repo";

export {
	createWorkItem,
	ensureWorkIndexes,
	getWorkItemBySlug,
	getWorkItems,
	softDeleteWorkItem,
	updateWorkItem,
} from "./repo";
export { CoverImageSchema, CreateWorkItemSchema, LinksSchema, UpdateWorkItemSchema } from "./validators";

export const work = {
	getWorkItems,
	getWorkItemBySlug,
	createWorkItem,
	updateWorkItem,
	softDeleteWorkItem,
	ensureWorkIndexes,
};

export type { CoverImage, DbWork, Links, WorkItem } from "./repo";
export type { CreateWorkItemInput, UpdateWorkItemInput } from "./validators";