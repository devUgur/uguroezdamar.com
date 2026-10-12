import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/apps/portal/src/adapters/auth/utils";
import { listAdmins } from "@ugur/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // list admins: allowed for any authenticated admin (owner/admin/editor)
  const docs = await listAdmins();

  const list = docs.map((d) => ({ 
    id: d.id, 
    email: d.email, 
    role: d.role, 
    status: d.status, 
    createdAt: d.createdAt, 
    lastLogin: d.lastLogin 
  }));
  
  return NextResponse.json({ ok: true, admins: list });
}
