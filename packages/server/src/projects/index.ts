import "server-only";

import {
	createProject,
	ensureProjectIndexes,
	getProjectBySlugMongo,
	getProjects,
	softDeleteProject,
	updateProject,
} from "./repo";

export {
	createProject,
	ensureProjectIndexes,
	getProjectBySlugMongo,
	getProjects,
	softDeleteProject,
	updateProject,
} from "./repo";
export { CreateProjectSchema, UpdateProjectSchema } from "./validators";
export { buildProjectAssetKey, collectProjectAssetUrls, sanitizeProjectSlug } from "./assets";

export const projects = {
	getProjects,
	getProjectBySlugMongo,
	createProject,
	updateProject,
	softDeleteProject,
	ensureProjectIndexes,
};

export type {
	DbProject,
	ProjectImage,
	ProjectKind,
	ProjectLink,
	ProjectRecord,
	ProjectStatus,
} from "./repo";
export type { CreateProjectInput, UpdateProjectInput } from "./validators";