import "server-only";

export { env } from "./env";
export { getClient, getDb } from "./mongodb";
export { readCookie } from "./cookies";
export {
	uploadBuffer,
	getPublicUrl,
	deleteObjectByKey,
	deleteObjectByUrl,
	deleteObjectsByUrls,
	deleteObjectsByPrefix,
} from "./storage";
export {
	hashPassword,
	createAdminInvite,
	acceptAdminInvite,
	createAdminSession,
	getAdminByEmail,
	getAdminById,
	countOwners,
	updateAdminRoleById,
	deleteAdminById,
	inviteAdmin,
	getAdminSession,
	deleteAdminSession,
	requireAdmin,
	canDelete,
	canInvite,
	recordFailedLoginAttempt,
	clearLoginAttempts,
	countRecentFailedLoginAttempts,
	timingSafeEqualsString,
} from "./admin/logic";
export {
	projects,
	createProject,
	ensureProjectIndexes,
	getProjectBySlugMongo,
	getProjects,
	softDeleteProject,
	updateProject,
	CreateProjectSchema,
	UpdateProjectSchema,
	buildProjectAssetKey,
	collectProjectAssetUrls,
	sanitizeProjectSlug,
} from "./projects";
export {
	work,
	createWorkItem,
	ensureWorkIndexes,
	getWorkItemBySlug,
	getWorkItems,
	softDeleteWorkItem,
	updateWorkItem,
	CoverImageSchema,
	CreateWorkItemSchema,
	LinksSchema,
	UpdateWorkItemSchema,
} from "./work";
export {
	profile,
	getProfile,
	upsertProfile,
	ensureProfileIndexes,
	ProfileLinksSchema,
	UpsertProfileSchema,
} from "./profile";
export {
	timeline,
	createTimelineItem,
	ensureTimelineIndexes,
	getTimelineItemById,
	getTimelineItems,
	softDeleteTimelineItem,
	updateTimelineItem,
	CreateTimelineItemSchema,
	TimelineVisibilitySchema,
	UpdateTimelineItemSchema,
} from "./timeline";
export { createLead, listLeads } from "./contact";
export { getAllPosts, getPostBySlug } from "./blog";

export type { AdminRole, Admin, AdminSession, RequireAdminResult } from "./admin/logic";
export type {
	DbProject,
	ProjectImage,
	ProjectKind,
	ProjectLink,
	ProjectRecord,
	ProjectStatus,
	CreateProjectInput,
	UpdateProjectInput,
} from "./projects";
export type { CoverImage, DbWork, Links, WorkItem, CreateWorkItemInput, UpdateWorkItemInput } from "./work";
export type { DbProfile, Profile, ProfileLinks } from "./profile";
export type { UpsertProfileInput } from "./profile";
export type {
	DbTimelineItem,
	TimelineItem,
	TimelineItemStatus,
	TimelineItemType,
	TimelineVisibility,
	CreateTimelineItemInput,
	UpdateTimelineItemInput,
} from "./timeline";
export type { ContactInput, LeadRecord } from "./contact";
export type { PostRecord } from "./blog";
