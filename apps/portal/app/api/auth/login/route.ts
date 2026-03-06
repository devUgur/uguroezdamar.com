import { NextResponse, type NextRequest } from "next/server";
import "server-only";
import {
  getDb,
  createAdminSession,
  recordFailedLoginAttempt,
  countRecentFailedLoginAttempts,
  clearLoginAttempts,
  getAdminByEmail,
  hashPassword,
  timingSafeEqualsString,
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

    // Debug: incoming request metadata (no secrets)
    console.error("LOGIN request start", {
      route: "/api/auth/login",
      email: email || null,
      hasPassword: !!password,
      ip,
      ua: request.headers.get("user-agent")?.slice(0, 120) ?? null,
    });

    console.error("LOGIN env", {
      hasMongoUri: !!process.env.MONGODB_URI,
      hasAdminKey: !!process.env.ADMIN_API_KEY,
      nodeEnv: process.env.NODE_ENV,
    });

  const maxAttempts = 5;
  const windowSec = 900; // 15 mins

    // 1. Rate limit check
    const attempts = await countRecentFailedLoginAttempts(ip, windowSec);
  if (attempts >= maxAttempts) {
    return NextResponse.json({ ok: false, error: "Security Lock: Too many attempts. Try again later." }, { status: 429 });
  }

    // 2. Find admin
    const admin = await getAdminByEmail(email);
    console.error("LOGIN admin lookup", { found: !!admin, email: admin?.email ?? null, status: admin?.status ?? null });
    if (!admin) {
      await recordFailedLoginAttempt(ip);
      // Generic error to prevent email enumeration
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    // 3. Verify password
    const inputHash = hashPassword(password);

    // Prefer explicit match variable for logging
    const hasStoredHash = !!admin.passwordHash;
    const isMatch = hasStoredHash ? timingSafeEqualsString(inputHash, admin.passwordHash) : false;
    console.error("LOGIN verify", { hasStoredHash, isMatch });

    // If it's an invited admin with no password yet, we set it on first login
    // ONLY if they provide the ADMIN_API_KEY as the initial password
    if (admin.status === "invited" && !admin.passwordHash) {
      const masterKey = process.env.ADMIN_API_KEY ?? "";
      if (password === masterKey) {
        console.error("LOGIN activation via master key", { email: admin.email });
        // allow activation flow (no-op here)
      } else {
        await recordFailedLoginAttempt(ip);
        return NextResponse.json({ ok: false, error: "Account not activated. Contact system owner." }, { status: 401 });
      }
    } else if (!isMatch) {
      await recordFailedLoginAttempt(ip);
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    // 4. Success - Create session
    await clearLoginAttempts(ip);
  const ua = request.headers.get("user-agent") ?? undefined;
  const session = await createAdminSession({ 
    adminId: String(admin._id), 
    email: admin.email, 
    userAgent: ua, 
    ip 
  });

  // Update last login (filter by email to avoid ObjectId/string type mismatch)
  const db = await getDb();
  await db.collection("admins").updateOne({ email: admin.email }, { 
    $set: { lastLogin: new Date(), status: "active" } 
  });

  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set("admin_session", session._id, {
    httpOnly: true,
    path: "/",
    maxAge: 86400, // 24h
    sameSite: "strict",
    secure,
  });
  return res;
  } catch (err) {
    // Log unexpected errors for Netlify runtime debugging
    console.error("LOGIN unexpected error", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
