import { getAdminDetail } from "@/apps/portal/src/adapters/admin";
import { notFound } from "next/navigation";
import { Card } from "@ugur/ui";
import Link from "next/link";

export default async function TeamMemberEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdminDetail(id);

  if (!admin) {
    notFound();
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Edit Admin</h1>
          <p className="text-muted-foreground">Manage role and permissions for {admin.email}.</p>
        </div>
        <Link href="/admin/team" className="portal-btn-secondary">
          Back to Team
        </Link>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <div className="p-2 bg-muted rounded-md text-sm">{admin.name || "N/A"}</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <div className="p-2 bg-muted rounded-md text-sm">{admin.email}</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <div className="p-2 bg-muted rounded-md text-sm capitalize">{admin.role}</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <div className="p-2 bg-muted rounded-md text-sm capitalize">{admin.status}</div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-4">
              Role management and deletion can be implemented here using the PATCH/DELETE /api/admins/{id} endpoints.
            </p>
            {/* Add Role Management Form here if needed */}
          </div>
        </div>
      </Card>
    </div>
  );
}
