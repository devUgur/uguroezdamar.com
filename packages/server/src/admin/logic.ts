import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { and, count, desc, eq, gt, gte, isNull } from "drizzle-orm";
import { getDb, isUuid, omit } from "../db/client";
import { adminInvites, adminLoginAttempts, adminSessions, admins, contactRequests } from "../db/schema";
import { env } from "../env";

export type AdminRole = "owner" | "admin" | "editor";

export type Admin = typeof admins.$inferSelect;
/** An admin without credentials, safe to hand to UI code. */
export type AdminSummary = Omit<Admin, "passwordHash">;
export type AdminSession = typeof adminSessions.$inferSelect;

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
} as const;

export async function hashPassword(password: string) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/** `needsRehash` is true when a valid hash was created with weaker parameters than today's. */
export async function verifyPassword(password: string, storedHash: string) {
  if (!storedHash.startsWith("$argon2id$")) return { valid: false, needsRehash: false };
  try {
    const valid = await argon2.verify(storedHash, password);
    return { valid, needsRehash: valid && argon2.needsRehash(storedHash, ARGON2_OPTIONS) };
  } catch {
    return { valid: false, needsRehash: false };
  }
}

export async function upgradeAdminPasswordHash(id: string, expectedHash: string, password: string) {
  if (!isUuid(id)) return false;
  const passwordHash = await hashPassword(password);
  const rows = await getDb()
    .update(admins)
    .set({ passwordHash })
    .where(and(eq(admins.id, id), eq(admins.passwordHash, expectedHash)))
    .returning({ id: admins.id });
  return rows.length > 0;
}

/** Rolls the invite claim back when the account turns out to exist already. */
class AdminExistsError extends Error {}

const hashToken = (rawToken: string) => createHash("sha256").update(rawToken).digest("hex");

export async function createAdminInvite(email: string, invitedByEmail: string, role: AdminRole = "editor") {
  const db = getDb();
  const normalizedEmail = email.toLowerCase();
  if (await getAdminByEmail(normalizedEmail)) {
    return { ok: false, error: "Admin already exists" };
  }
  const now = new Date();
  const [pendingInvite] = await db
    .select({ id: adminInvites.id })
    .from(adminInvites)
    .where(and(eq(adminInvites.email, normalizedEmail), isNull(adminInvites.usedAt), gt(adminInvites.expiresAt, now)))
    .limit(1);
  if (pendingInvite) return { ok: false, error: "An active invite already exists" };

  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + env.ADMIN_INVITE_EXPIRES_HOURS * 3600 * 1000);

  await db.insert(adminInvites).values({
    email: normalizedEmail,
    role,
    tokenHash: hashToken(rawToken),
    expiresAt,
    createdBy: invitedByEmail,
  });

  const appUrl = env.APP_URL.replace(/\/$/, "");
  return { ok: true, inviteUrl: `${appUrl}/signup?token=${encodeURIComponent(rawToken)}` };
}

export async function acceptAdminInvite(rawToken: string, password: string) {
  const db = getDb();
  const tokenHash = hashToken(rawToken);
  const [invite] = await db.select().from(adminInvites).where(eq(adminInvites.tokenHash, tokenHash)).limit(1);
  if (!invite) return { ok: false, error: "Invalid token" };
  if (invite.usedAt) return { ok: false, error: "Token already used" };
  const now = new Date();
  if (invite.expiresAt.getTime() <= now.getTime()) return { ok: false, error: "Token expired" };

  const passwordHash = await hashPassword(password);

  // Claiming the invite and creating the account commit together, so simultaneous requests
  // cannot create two accounts and a failed insert does not burn the single-use token.
  try {
    return await db.transaction(async (tx) => {
      const claimed = await tx
        .update(adminInvites)
        .set({ usedAt: now })
        .where(and(eq(adminInvites.id, invite.id), isNull(adminInvites.usedAt), gt(adminInvites.expiresAt, now)))
        .returning({ id: adminInvites.id });
      if (claimed.length !== 1) return { ok: false, error: "Token already used or expired" };

      const created = await tx
        .insert(admins)
        .values({ email: invite.email, passwordHash, status: "active", role: invite.role })
        .onConflictDoNothing({ target: admins.email })
        .returning({ id: admins.id });
      if (created.length !== 1) throw new AdminExistsError();
      return { ok: true, adminId: created[0].id };
    });
  } catch (error) {
    if (error instanceof AdminExistsError) return { ok: false, error: "Admin already exists" };
    throw error;
  }
}

export async function createAdminSession({ adminId, email, userAgent, ip }: { adminId: string; email: string; userAgent?: string; ip?: string }) {
  const expiresAt = new Date(Date.now() + env.ADMIN_SESSION_TTL_SECONDS * 1000);
  const [session] = await getDb()
    .insert(adminSessions)
    .values({ adminId, email, expiresAt, userAgent: userAgent ?? null, ip: ip ?? null })
    .returning();
  return session;
}

export async function getAdminByEmail(email: string): Promise<Admin | null> {
  const [admin] = await getDb().select().from(admins).where(eq(admins.email, email.toLowerCase())).limit(1);
  return admin ?? null;
}

/** Accepts an admin id or, for older links, an email address. */
export async function getAdminById(id: string): Promise<Admin | null> {
  if (!isUuid(id)) return getAdminByEmail(id);
  const [admin] = await getDb().select().from(admins).where(eq(admins.id, id)).limit(1);
  return admin ?? null;
}

const byIdOrEmail = (id: string) => (isUuid(id) ? eq(admins.id, id) : eq(admins.email, id.toLowerCase()));

export async function countOwners() {
  const [row] = await getDb().select({ value: count() }).from(admins).where(eq(admins.role, "owner"));
  return row?.value ?? 0;
}

export async function updateAdminRoleById(id: string, role: AdminRole): Promise<Admin | null> {
  const [admin] = await getDb().update(admins).set({ role }).where(byIdOrEmail(id)).returning();
  return admin ?? null;
}

export async function deleteAdminById(id: string) {
  const rows = await getDb().delete(admins).where(byIdOrEmail(id)).returning({ id: admins.id });
  return rows.length > 0;
}

export async function recordAdminLogin(id: string) {
  if (!isUuid(id)) return;
  await getDb().update(admins).set({ lastLogin: new Date() }).where(eq(admins.id, id));
}

export async function getAdminSession(id?: string | null): Promise<AdminSession | null> {
  if (!id || !isUuid(id)) return null;
  const db = getDb();
  const [session] = await db.select().from(adminSessions).where(eq(adminSessions.id, id)).limit(1);
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.delete(adminSessions).where(eq(adminSessions.id, id));
    return null;
  }
  return session;
}

export async function deleteAdminSession(id?: string | null) {
  if (!id || !isUuid(id)) return;
  await getDb().delete(adminSessions).where(eq(adminSessions.id, id));
}

export function timingSafeEqualsString(a: string, b: string) {
  try {
    const aa = Buffer.from(a);
    const bb = Buffer.from(b);
    if (aa.length !== bb.length) return false;
    return timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

export function canDelete(admin?: Pick<Admin, "role"> | null) {
  if (!admin) return false;
  return admin.role === "owner" || admin.role === "admin";
}

export function canInvite(admin?: Pick<Admin, "role"> | null) {
  if (!admin) return false;
  return admin.role === "owner" || admin.role === "admin";
}

export async function recordFailedLoginAttempt(ip?: string | null) {
  await getDb().insert(adminLoginAttempts).values({ ip: ip ?? "unknown" });
}

export async function clearLoginAttempts(ip?: string | null) {
  if (!ip) return;
  await getDb().delete(adminLoginAttempts).where(eq(adminLoginAttempts.ip, ip));
}

export async function countContactRequests() {
  const [row] = await getDb().select({ value: count() }).from(contactRequests);
  return row?.value ?? 0;
}

export async function listAdmins(): Promise<AdminSummary[]> {
  const rows = await getDb().select().from(admins).orderBy(desc(admins.createdAt));
  return rows.map((admin) => omit(admin, "passwordHash"));
}

export async function countRecentFailedLoginAttempts(ip?: string | null, windowSeconds = 900) {
  const since = new Date(Date.now() - windowSeconds * 1000);
  const [row] = await getDb()
    .select({ value: count() })
    .from(adminLoginAttempts)
    .where(and(eq(adminLoginAttempts.ip, ip ?? "unknown"), gte(adminLoginAttempts.createdAt, since)));
  return row?.value ?? 0;
}
