import "server-only";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { ObjectId, type Filter } from "mongodb";
import type { NextRequest } from "next/server";
import { env } from "../env";
import { getDb } from "../mongodb";

const SESSIONS_COLL = "admin_sessions";
const ADMINS_COLL = "admins";
const LOGIN_ATTEMPTS_COLL = "admin_login_attempts";

export type AdminRole = "owner" | "admin" | "editor";

export type Admin = {
  _id?: string | ObjectId;
  email: string;
  passwordHash: string;
  name?: string;
  invitedBy?: string;
  createdAt: Date;
  lastLogin?: Date;
  status: "active" | "invited";
  role?: AdminRole;
};

export type AdminSession = {
  _id: string;
  adminId: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  userAgent?: string | null;
  ip?: string | null;
};

export type RequireAdminResult =
  | { ok: true; method: "bearer"; session?: never; admin?: never }
  | { ok: true; method: "session"; session: AdminSession; admin: Admin | null }
  | { ok: false; reason: "no_session" | "invalid_session"; method?: never; session?: never; admin?: never };

export function hashPassword(password: string) {
  return createHash("sha256").update(password + (env.ADMIN_API_KEY ?? "")).digest("hex");
}

export async function createAdminInvite(email: string, invitedByEmail: string, role: AdminRole = "editor") {
  const db = await getDb();
  const col = db.collection("admin_invites");
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresHours = Number(env.ADMIN_INVITE_EXPIRES_HOURS ?? "48");
  const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000);

  await col.insertOne({
    email: email.toLowerCase(),
    role,
    tokenHash,
    expiresAt,
    createdBy: invitedByEmail,
    createdAt: new Date(),
    usedAt: null,
  });

  if ((env.NODE_ENV ?? process.env.NODE_ENV) === "development") {
    const appUrl = env.APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
    return { ok: true, inviteUrl: `${appUrl}/portal/signup?token=${rawToken}` };
  }

  return { ok: true };
}

export async function acceptAdminInvite(rawToken: string, password: string) {
  const db = await getDb();
  const col = db.collection("admin_invites");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const invite = await col.findOne({ tokenHash });
  if (!invite) return { ok: false, error: "Invalid token" };
  if (invite.usedAt) return { ok: false, error: "Token already used" };
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return { ok: false, error: "Token expired" };

  const adminsCol = db.collection<Admin>(ADMINS_COLL);
  const existing = await adminsCol.findOne({ email: invite.email });
  if (existing) return { ok: false, error: "Admin already exists" };

  const pwdHash = hashPassword(password);
  const doc: Omit<Admin, "_id"> = {
    email: invite.email,
    passwordHash: pwdHash,
    status: "active",
    role: invite.role ?? "editor",
    createdAt: new Date(),
  };
  const res = await adminsCol.insertOne(doc);

  await col.updateOne({ tokenHash }, { $set: { usedAt: new Date() } });

  return { ok: true, adminId: res.insertedId?.toString?.() ?? null };
}

export async function createAdminSession({ adminId, email, userAgent, ip }: { adminId: string; email: string; userAgent?: string; ip?: string }) {
  const db = await getDb();
  const col = db.collection<AdminSession>(SESSIONS_COLL);
  const id = randomUUID();
  const ttl = Number(env.ADMIN_SESSION_TTL_SECONDS ?? 86400);
  const expiresAt = new Date(Date.now() + ttl * 1000);
  const doc: AdminSession = {
    _id: id,
    adminId,
    email,
    createdAt: new Date(),
    expiresAt,
    userAgent: userAgent ?? null,
    ip: ip ?? null,
  };
  await col.insertOne(doc);
  return doc;
}

export async function getAdminByEmail(email: string) {
  const db = await getDb();
  return db.collection<Admin>(ADMINS_COLL).findOne({ email: email.toLowerCase() });
}

export async function getAdminById(id: string) {
  const db = await getDb();
  const col = db.collection<Admin>(ADMINS_COLL);
  const filter: Filter<Admin> = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { email: id.toLowerCase() };
  return col.findOne(filter);
}

export async function countOwners() {
  const db = await getDb();
  const col = db.collection<Admin>(ADMINS_COLL);
  return col.countDocuments({ role: "owner" });
}

export async function updateAdminRoleById(id: string, role: AdminRole) {
  const db = await getDb();
  const col = db.collection<Admin>(ADMINS_COLL);
  const filter: Filter<Admin> = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { email: id.toLowerCase() };

  const res = await col.findOneAndUpdate(
    filter,
    { $set: { role } },
    { returnDocument: "after" },
  );
  return res.value ?? null;
}

export async function deleteAdminById(id: string) {
  const db = await getDb();
  const col = db.collection<Admin>(ADMINS_COLL);
  const filter: Filter<Admin> = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { email: id.toLowerCase() };
  const res = await col.deleteOne(filter);
  return res.deletedCount > 0;
}

export async function inviteAdmin(email: string, invitedByEmail: string, role: AdminRole = "editor") {
  const db = await getDb();
  const col = db.collection<Admin>(ADMINS_COLL);
  const existing = await col.findOne({ email: email.toLowerCase() });
  if (existing) return { ok: false, error: "Admin already exists" };

  await col.insertOne({
    email: email.toLowerCase(),
    passwordHash: "",
    status: "invited",
    invitedBy: invitedByEmail,
    role,
    createdAt: new Date(),
  });
  return { ok: true };
}

export async function getAdminSession(id?: string | null) {
  if (!id) return null;
  const db = await getDb();
  const col = db.collection<AdminSession>(SESSIONS_COLL);
  const doc = await col.findOne({ _id: id });
  if (!doc) return null;
  if (doc.expiresAt && doc.expiresAt.getTime() < Date.now()) {
    await col.deleteOne({ _id: id });
    return null;
  }
  return doc;
}

export async function deleteAdminSession(id?: string | null) {
  if (!id) return;
  const db = await getDb();
  const col = db.collection<AdminSession>(SESSIONS_COLL);
  await col.deleteOne({ _id: id });
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

export async function requireAdmin(request: NextRequest): Promise<RequireAdminResult> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const key = env.ADMIN_API_KEY ?? "";
  if (token && key) {
    if (timingSafeEqualsString(token, key)) {
      return { ok: true, method: "bearer" };
    }
  }

  const sessionId = request.cookies.get("admin_session")?.value ?? null;
  if (!sessionId) return { ok: false, reason: "no_session" };
  const session = await getAdminSession(sessionId);
  if (!session) return { ok: false, reason: "invalid_session" };
  const admin = await getAdminByEmail(session.email);
  return { ok: true, method: "session", session, admin: admin ?? null };
}

export function canDelete(admin?: Admin | null) {
  if (!admin) return false;
  return admin.role === "owner" || admin.role === "admin";
}

export function canInvite(admin?: Admin | null) {
  if (!admin) return false;
  return admin.role === "owner" || admin.role === "admin";
}

export async function recordFailedLoginAttempt(ip?: string | null) {
  const db = await getDb();
  const col = db.collection(LOGIN_ATTEMPTS_COLL);
  await col.insertOne({ ip: ip ?? "unknown", createdAt: new Date() });
}

export async function clearLoginAttempts(ip?: string | null) {
  if (!ip) return;
  const db = await getDb();
  const col = db.collection(LOGIN_ATTEMPTS_COLL);
  await col.deleteMany({ ip });
}

export async function countRecentFailedLoginAttempts(ip?: string | null, windowSeconds = 900) {
  const db = await getDb();
  const col = db.collection(LOGIN_ATTEMPTS_COLL);
  const since = new Date(Date.now() - windowSeconds * 1000);
  return col.countDocuments({ ip: ip ?? "unknown", createdAt: { $gte: since } });
}
