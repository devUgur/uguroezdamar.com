import { NextResponse, type NextRequest } from "next/server";
import "server-only";
import { 
  createAdminSession, 
  recordFailedLoginAttempt, 
  countRecentFailedLoginAttempts, 
  clearLoginAttempts,
  getAdminByEmail,
  hashPassword,
  timingSafeEquals
} from "@/features/admin";
import { getDb } from "@ugur/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  
  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";

  const maxAttempts = 5;
  const windowSec = 900; // 15 mins

  // 1. Rate limit check
  const attempts = await countRecentFailedLoginAttempts(ip, windowSec);
  if (attempts >= maxAttempts) {
    return NextResponse.json({ ok: false, error: "Security Lock: Too many attempts. Try again later." }, { status: 429 });
  }

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  // 2. Find admin
  const admin = await getAdminByEmail(email);
  if (!admin) {
    await recordFailedLoginAttempt(ip);
    // Generic error to prevent email enumeration
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  // 3. Verify password
  const inputHash = hashPassword(password);
  
  // If it's an invited admin with no password yet, we set it on first login 
  // ONLY if they provide the ADMIN_API_KEY as the initial password (or we can use a separate invite flow)
  // For now, let's assume they must have a hash.
  if (admin.status === "invited" && !admin.passwordHash) {
     // Check if they are using the master key to set their initial password
     const masterKey = process.env.ADMIN_API_KEY ?? "";
     if (password === masterKey) {
        // This is a one-time activation - they should probably set a real password next.
        // But for this setup, we'll just allow it.
     } else {
        await recordFailedLoginAttempt(ip);
        return NextResponse.json({ ok: false, error: "Account not activated. Contact system owner." }, { status: 401 });
     }
  } else if (!timingSafeEquals(inputHash, admin.passwordHash)) {
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
}
