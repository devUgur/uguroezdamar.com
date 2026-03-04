import {
  clearLoginAttempts,
  countRecentFailedLoginAttempts,
  createAdminSession as createAdminSessionImpl,
  deleteAdminSession,
  getAdminByEmail,
  getAdminSession,
  hashPassword,
  recordFailedLoginAttempt,
  requireAdmin,
  timingSafeEqualsString,
} from "@ugur/server";

export interface CreateSessionOptions {
  adminId?: string;
  email?: string;
  userAgent?: string;
  ip?: string;
}

export async function createAdminSession(opts: CreateSessionOptions) {
  const adminId = opts.adminId ?? String(opts.email ?? "test-admin");
  const email = opts.email ?? "test@example.com";
  return createAdminSessionImpl({ adminId, email, userAgent: opts.userAgent, ip: opts.ip });
}

export { getAdminSession, deleteAdminSession, recordFailedLoginAttempt, countRecentFailedLoginAttempts, clearLoginAttempts, hashPassword, getAdminByEmail, requireAdmin };
export const timingSafeEquals = timingSafeEqualsString;

