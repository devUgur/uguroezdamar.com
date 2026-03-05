import Link from "next/link";
import { InviteForm } from "@/src/features/admin/ui/InviteForm";
import { getAdminsSnapshot } from "@/src/server/admin";

export default async function AdminsPage() {
  const { admins } = await getAdminsSnapshot();

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Admin Management</h1>
          <p className="text-muted-foreground">Invite other admins to manage the portfolio.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Invitation Form */}
        <div className="lg:col-span-1">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">Invite New Admin</h2>
            <InviteForm />
          </div>
        </div>

        {/* Admins List */}
        <div className="lg:col-span-2">
          <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-4 text-left font-medium">Admin Email</th>
                  <th className="p-4 text-left font-medium">Status</th>
                  <th className="p-4 text-left font-medium">Last Login</th>
                  <th className="p-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground italic">No admins found.</td>
                  </tr>
                ) : (
                  admins.map((admin) => (
                    <tr key={admin.email} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium">{admin.email}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          admin.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {admin.status}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : "Never"}
                      </td>
                      <td className="p-4 text-right">
                        <Link href={`/admin/admins/${admin._id?.toString() || admin.email}`} className="text-xs text-blue-500 hover:underline">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div className="bg-muted/50 border rounded-lg p-4 text-sm text-muted-foreground">
        <strong>How invitations work:</strong> Once invited, the new admin can log in using their email. On the first login, they must use the <code>ADMIN_API_KEY</code> as their password to activate their account.
      </div>
    </div>
  );
}
