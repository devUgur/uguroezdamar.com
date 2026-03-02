import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, type Admin } from "@/features/admin";
import { getDb } from "@/shared/lib/mongodb";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // list admins: allowed for any authenticated admin (owner/admin/editor)
  const db = await getDb();
  const col = db.collection<Admin>("admins");
  const docs = await col.find({}, { projection: { passwordHash: 0 } }).toArray();
  
  const list = docs.map((d) => ({ 
    id: d._id?.toString() ?? d.email, 
    email: d.email, 
    role: d.role, 
    status: d.status, 
    createdAt: d.createdAt, 
    lastLogin: d.lastLogin 
  }));
  
  return NextResponse.json({ ok: true, admins: list });
}
