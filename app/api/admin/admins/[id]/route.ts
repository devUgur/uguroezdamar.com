import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, getAdminById, countOwners, updateAdminRoleById, deleteAdminById, type AdminRole } from "@/features/admin";

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parts = request.nextUrl.pathname.split("/");
  const idVal = parts[parts.length - 1];

  const body = await request.json().catch(() => ({}));
  const newRole: AdminRole | null = typeof body.role === "string" && ["owner", "admin", "editor"].includes(body.role) 
    ? (body.role as AdminRole) 
    : null;
    
  if (!newRole) return NextResponse.json({ error: "role required" }, { status: 400 });

  const actingAdmin = auth.method === "session" ? auth.admin : null;
  const actingIsBearer = auth.method === "bearer";

  const target = await getAdminById(idVal);
  if (!target) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  // Prevent non-owner from promoting to owner
  if (newRole === "owner" && !actingIsBearer && (!actingAdmin || actingAdmin.role !== "owner")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Prevent self-demotion
  const targetIdStr = target._id?.toString() ?? target.email;
  const actingIdStr = actingAdmin?._id?.toString() ?? auth.session?.adminId ?? null;
  if (actingIdStr && targetIdStr && actingIdStr === targetIdStr && target.role === "owner" && newRole !== "owner") {
    return NextResponse.json({ error: "Owner cannot demote themselves" }, { status: 403 });
  }

  // Prevent demoting the last owner
  if (target.role === "owner" && newRole !== "owner") {
    const owners = await countOwners();
    if (owners <= 1) return NextResponse.json({ error: "Cannot demote the last owner" }, { status: 403 });
  }

  const updated = await updateAdminRoleById(idVal, newRole);
  if (!updated) return NextResponse.json({ error: "Not Found" }, { status: 404 });
  return NextResponse.json({ ok: true, admin: { id: updated._id?.toString(), email: updated.email, role: updated.role, status: updated.status } });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parts = request.nextUrl.pathname.split("/");
  const idVal = parts[parts.length - 1];

  const actingAdmin = auth.method === "session" ? auth.admin : null;
  const actingIsBearer = auth.method === "bearer";

  // allow only owner/admin (or bearer)
  if (!actingIsBearer && (!actingAdmin || (actingAdmin.role !== "owner" && actingAdmin.role !== "admin"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await getAdminById(idVal);
  if (!target) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  // Prevent deletion of last owner
  // Prevent self-delete
  const actingIdStr = actingAdmin?._id?.toString() ?? auth.session?.adminId ?? null;
  const targetIdStr = target._id?.toString() ?? target.email;
  if (actingIdStr && targetIdStr && actingIdStr === targetIdStr) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 403 });
  }

  if (target.role === "owner") {
    const owners = await countOwners();
    if (owners <= 1) return NextResponse.json({ error: "Cannot delete last owner" }, { status: 403 });
  }

  // All checks passed — perform delete
  const ok = await deleteAdminById(idVal);
  if (!ok) return NextResponse.json({ error: "Not Found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
