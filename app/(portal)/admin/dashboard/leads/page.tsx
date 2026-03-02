import Link from "next/link";
import { listLeads } from "@/features/contact/server/repo";

export const runtime = "nodejs";

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q : undefined;
  const limit = typeof params?.limit === "string" ? Number(params.limit) : 50;
  const cursor = typeof params?.cursor === "string" ? params.cursor : undefined;

  const { items, nextCursor } = await listLeads({ limit, cursor, q });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Leads</h1>
          <p className="text-muted-foreground">Manage your contact form submissions.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/api/admin/leads/export?limit=1000${q ? `&q=${encodeURIComponent(String(q))}` : ""}`} className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Export CSV
          </Link>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-4">
        <form method="get" className="flex gap-2">
          <input 
            name="q" 
            defaultValue={q ?? ""} 
            placeholder="Search name or email..." 
            className="flex-1 bg-muted/50 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
          />
          <button className="px-4 py-2 bg-muted border rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
            Search
          </button>
        </form>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 text-left font-medium">Date</th>
              <th className="p-4 text-left font-medium">Name</th>
              <th className="p-4 text-left font-medium">Email</th>
              <th className="p-4 text-left font-medium w-1/2">Message</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground italic">No leads found.</td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-4 align-top text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(it.createdAt).toLocaleString()}
                  </td>
                  <td className="p-4 align-top font-medium">{it.name}</td>
                  <td className="p-4 align-top text-muted-foreground">{it.email}</td>
                  <td className="p-4 align-top whitespace-pre-wrap leading-relaxed">{it.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center">
        {nextCursor ? (
          <Link 
            href={`/admin/dashboard/leads?cursor=${nextCursor}&limit=${limit}${q ? `&q=${encodeURIComponent(String(q))}` : ""}`} 
            className="px-6 py-2 bg-muted border rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            Load More
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">End of results</span>
        )}
      </div>
    </div>
  );
}
