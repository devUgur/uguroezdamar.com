import "server-only";

export {
	createProject,
	ensureProjectIndexes,
	getProjectById,
	getProjectBySlugMongo,
	getProjects,
	softDeleteProject,
	updateProject,
} from "./repo";

export {
	CreateProjectSchema,
	UpdateProjectSchema,
	ProjectKindSchema,
	ProjectLinkSchema,
	ProjectImageSchema,
} from "./validators";

export { buildProjectAssetKey, collectProjectAssetUrls, sanitizeProjectSlug } from "./assets";
export { getMdxProjectBySlug, getMdxProjects } from "./mdx";

export type {
	ProjectKind,
	ProjectLink,
	ProjectImage,
	ProjectRecord,
} from "./validators";

export type { CreateProjectInput, UpdateProjectInput } from "./validators";

// Re-export constants/types that might be needed
export type ProjectStatus = "draft" | "published" | "archived";
