import "server-only";

export { env } from "./env";
export { getDb, setDb, pingDatabase, isUuid, describeDbError, DatabaseNotConfiguredError, type Database } from "./db/client";
export * as schema from "./db/schema";
export {
	hashPassword,
	verifyPassword,
	upgradeAdminPasswordHash,
	createAdminInvite,
	acceptAdminInvite,
	createAdminSession,
	getAdminByEmail,
	getAdminById,
	countOwners,
	updateAdminRoleById,
	deleteAdminById,
	recordAdminLogin,
	getAdminSession,
	deleteAdminSession,
	canDelete,
	canInvite,
	recordFailedLoginAttempt,
	clearLoginAttempts,
	countRecentFailedLoginAttempts,
	timingSafeEqualsString,
	countContactRequests,
	listAdmins,
	AcceptAdminInviteSchema,
	AdminLoginSchema,
	type AcceptAdminInviteInput,
	type AdminLoginInput,
	type AdminRole,
	type Admin,
	type AdminSummary,
	type AdminSession,
} from "./admin";
export {
	createContactRequest,
	listContactRequests,
	consumeContactRateLimit,
	contactSchema,
	type ContactInput,
	type ContactRequest,
	type ContactRateLimitResult,
} from "./contact";
