import Link from "next/link";
import { getAdminOverview } from "@/apps/portal/src/server/admin";
import { getCurrentSession } from "@/src/server/auth";

export default async function AuthedPage() {
  const session = await getCurrentSession();
  const { recentLeads, leadsCount } = await getAdminOverview();

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back, {session?.email}</h1>
        <p className="text-muted-foreground">Here is an overview of your portfolio activity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-card border rounded-xl shadow-sm space-y-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Leads</p>
          <p className="text-3xl font-bold">{leadsCount}</p>
          <Link href="/admin/leads" className="text-xs text-blue-500 hover:underline">View all leads →</Link>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Recent Leads</h2>
        <div className="border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-4 text-left font-medium">Name</th>
                <th className="p-4 text-left font-medium">Email</th>
                <th className="p-4 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-muted-foreground italic">No leads found.</td>
                </tr>
              ) : (
                recentLeads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{lead.name}</td>
                    <td className="p-4 text-muted-foreground">{lead.email}</td>
                    <td className="p-4 text-muted-foreground text-xs">{new Date(lead.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="text-right">
          <Link href="/admin/leads" className="text-sm font-medium text-blue-500 hover:underline">
            View all leads →
          </Link>
        </div>
      </div>
    </div>
  );
}
