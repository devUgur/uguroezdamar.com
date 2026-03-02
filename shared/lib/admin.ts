import * as adminImpl from "@/features/admin";

export interface CreateSessionOptions {
  adminId?: string;
  email?: string;
  userAgent?: string;
  ip?: string;
}

export async function createAdminSession(opts: CreateSessionOptions) {
  const adminId = opts.adminId ?? String(opts.email ?? "test-admin");
  const email = opts.email ?? "test@example.com";
  return adminImpl.createAdminSession({ adminId, email, userAgent: opts.userAgent, ip: opts.ip });
}

export const getAdminSession = adminImpl.getAdminSession;
export const deleteAdminSession = adminImpl.deleteAdminSession;
export const recordFailedLoginAttempt = adminImpl.recordFailedLoginAttempt;
export const countRecentFailedLoginAttempts = adminImpl.countRecentFailedLoginAttempts;
export const clearLoginAttempts = adminImpl.clearLoginAttempts;
export const hashPassword = adminImpl.hashPassword;
export const timingSafeEquals = adminImpl.timingSafeEquals;
export const getAdminByEmail = adminImpl.getAdminByEmail;
export const requireAdmin = adminImpl.requireAdmin;

