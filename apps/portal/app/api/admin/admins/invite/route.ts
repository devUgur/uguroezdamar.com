import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, canInvite, createAdminInvite, type AdminRole } from "@/features/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actingAdmin = auth.method === "session" ? auth.admin : null;
  if (!canInvite(actingAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const role: AdminRole = typeof body.role === "string" && ["owner", "admin", "editor"].includes(body.role) 
      ? (body.role as AdminRole) 
      : "editor";

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Only owner may invite another owner
    if (role === "owner" && actingAdmin?.role !== "owner") {
      return NextResponse.json({ error: "Forbidden to invite owner" }, { status: 403 });
    }

    const invitedBy = auth.method === "session" ? auth.session.email : "system";
      const result = await createAdminInvite(email, invitedBy, role);
      if (!result.ok) {
        return NextResponse.json(result, { status: 400 });
      }

    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error)?.message || "Internal Error" }, { status: 500 });
  }
}
