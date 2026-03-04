import "server-only";

export {
	createProject,
	ensureProjectIndexes,
	getProjectBySlugMongo,
	getProjects,
	softDeleteProject,
	updateProject,
} from "@ugur/server";
export type {
	DbProject,
	ProjectImage,
	ProjectKind,
	ProjectLink,
	ProjectRecord,
	ProjectStatus,
} from "@ugur/server";
