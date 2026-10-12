import "server-only";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { ObjectId, type Filter } from "mongodb";
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

function hashLegacyPassword(password: string) {
  return createHash("sha256").update(password + (env.ADMIN_API_KEY ?? "")).digest("hex");
}

export async function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith("$argon2id$")) {
    try {
      return { valid: await argon2.verify(storedHash, password), needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // Existing accounts use SHA-256(password + ADMIN_API_KEY). Verify once, then
  // upgrade the hash on successful login so new credentials never use SHA-256.
  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const legacyHash = hashLegacyPassword(password);
    const valid = timingSafeEqualsString(legacyHash, storedHash);
    return { valid, needsRehash: valid };
  }

  return { valid: false, needsRehash: false };
}

export async function upgradeAdminPasswordHash(id: string | ObjectId, expectedHash: string, password: string) {
  const db = await getDb();
  const col = db.collection<Admin>(ADMINS_COLL);
  const passwordHash = await hashPassword(password);
  const result = await col.updateOne(
    { _id: typeof id === "string" && ObjectId.isValid(id) ? new ObjectId(id) : id, passwordHash: expectedHash },
    { $set: { passwordHash } },
  );
  return result.modifiedCount > 0;
}

export async function createAdminInvite(email: string, invitedByEmail: string, role: AdminRole = "editor") {
  const db = await getDb();
  const col = db.collection("admin_invites");
  const normalizedEmail = email.toLowerCase();
  const admins = db.collection<Admin>(ADMINS_COLL);
  if (await admins.findOne({ email: normalizedEmail })) {
    return { ok: false, error: "Admin already exists" };
  }
  const now = new Date();
  const pendingInvite = await col.findOne({
    email: normalizedEmail,
    usedAt: null,
    expiresAt: { $gt: now },
  });
  if (pendingInvite) return { ok: false, error: "An active invite already exists" };

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresHours = Number(env.ADMIN_INVITE_EXPIRES_HOURS ?? "48");
  const expiresAt = new Date(now.getTime() + expiresHours * 3600 * 1000);

  await col.insertOne({
    email: normalizedEmail,
    role,
    tokenHash,
    expiresAt,
    createdBy: invitedByEmail,
    createdAt: new Date(),
    usedAt: null,
  });

  const appUrl = (env.APP_URL ?? process.env.APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
  return { ok: true, inviteUrl: `${appUrl}/signup?token=${encodeURIComponent(rawToken)}` };
}

export async function acceptAdminInvite(rawToken: string, password: string) {
  const db = await getDb();
  const col = db.collection("admin_invites");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const invite = await col.findOne({ tokenHash });
  if (!invite) return { ok: false, error: "Invalid token" };
  if (invite.usedAt) return { ok: false, error: "Token already used" };
  const now = new Date();
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) return { ok: false, error: "Token expired" };

  // Claim the invite atomically so simultaneous requests cannot create two
  // accounts or accept the same single-use token more than once.
  const claim = await col.updateOne(
    { _id: invite._id, tokenHash, usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  );
  if (claim.modifiedCount !== 1) return { ok: false, error: "Token already used or expired" };

  const adminsCol = db.collection<Admin>(ADMINS_COLL);
  const existing = await adminsCol.findOne({ email: invite.email });
  if (existing) return { ok: false, error: "Admin already exists" };

  const pwdHash = await hashPassword(password);
  const doc: Omit<Admin, "_id"> = {
    email: invite.email,
    passwordHash: pwdHash,
    status: "active",
    role: invite.role ?? "editor",
    createdAt: new Date(),
  };
  const res = await adminsCol.insertOne(doc);

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

export async function countContactRequests() {
  const db = await getDb();
  return db.collection("contact_requests").countDocuments();
}

export async function listAdmins() {
  const db = await getDb();
  return db.collection<Admin>(ADMINS_COLL).find().sort({ createdAt: -1 }).toArray();
}

export async function countRecentFailedLoginAttempts(ip?: string | null, windowSeconds = 900) {
  const db = await getDb();
  const col = db.collection(LOGIN_ATTEMPTS_COLL);
  const since = new Date(Date.now() - windowSeconds * 1000);
  return col.countDocuments({ ip: ip ?? "unknown", createdAt: { $gte: since } });
}
