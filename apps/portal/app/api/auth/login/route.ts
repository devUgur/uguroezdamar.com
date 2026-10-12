import { NextResponse, type NextRequest } from "next/server";
import "server-only";
import {
  getDb,
  env,
  createAdminSession,
  recordFailedLoginAttempt,
  countRecentFailedLoginAttempts,
  clearLoginAttempts,
  getAdminByEmail,
  verifyPassword,
  upgradeAdminPasswordHash,
  AdminLoginSchema,
} from "@ugur/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const parsed = AdminLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";

    const maxAttempts = 5;
    const windowSec = 900;

    // 1. Rate limit check
    const attempts = await countRecentFailedLoginAttempts(ip, windowSec);
    if (attempts >= maxAttempts) {
      return NextResponse.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429 });
    }

    // 2. Find admin
    const admin = await getAdminByEmail(email);
    if (!admin) {
      await recordFailedLoginAttempt(ip);
      // Generic error to prevent email enumeration
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    // Invited accounts must set their password through the single-use invite
    // acceptance flow. A global API key is never a user password.
    if (admin.status !== "active" || !admin.passwordHash) {
      await recordFailedLoginAttempt(ip);
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const passwordCheck = await verifyPassword(password, admin.passwordHash);
    if (!passwordCheck.valid) {
      await recordFailedLoginAttempt(ip);
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    if (passwordCheck.needsRehash && admin._id) {
      await upgradeAdminPasswordHash(admin._id, admin.passwordHash, password);
    }

    // 4. Success - Create session
    await clearLoginAttempts(ip);
    const ua = request.headers.get("user-agent") ?? undefined;
    const session = await createAdminSession({
      adminId: String(admin._id),
      email: admin.email,
      userAgent: ua,
      ip,
    });

  // Update last login (filter by email to avoid ObjectId/string type mismatch)
  const db = await getDb();
    await db.collection("admins").updateOne({ email: admin.email }, {
      $set: { lastLogin: new Date() },
    });

  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set("admin_session", session._id, {
    httpOnly: true,
    path: "/",
    maxAge: env.ADMIN_SESSION_TTL_SECONDS,
    sameSite: "strict",
    secure,
  });
  return res;
  } catch {
    console.error("Admin login failed due to an internal error");
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
