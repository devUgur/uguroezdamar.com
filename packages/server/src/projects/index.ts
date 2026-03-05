import "server-only";

export {
	createProject,
	ensureProjectIndexes,
	getProjectById,
	getProjectBySlugMongo,
	getProjects,
	reorderProjects,
	softDeleteProject,
	updateProject,
} from "./repo";

export {
	CreateProjectSchema,
	UpdateProjectSchema,
	ProjectKindSchema,
	ProjectLinkSchema,
	ProjectImageSchema,
	ProjectAppSchema,
} from "./validators";

export { buildProjectAssetKey, collectProjectAssetUrls, sanitizeProjectSlug } from "./assets";
export { getMdxProjectBySlug, getMdxProjects } from "./mdx";

export type {
	ProjectKind,
	ProjectLink,
	ProjectImage,
	ProjectApp,
	ProjectRecord,
} from "./validators";

export type { CreateProjectInput, UpdateProjectInput } from "./validators";

// Re-export constants/types that might be needed
export type ProjectStatus = "draft" | "published" | "archived";
