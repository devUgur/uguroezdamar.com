import { getWorkItems } from "@/features/work/server/mongo";
import Link from "next/link";

export default async function AdminWorkItemsPage() {
  const items = await getWorkItems({ limit: 200 });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Work Items</h1>
          <p className="text-muted-foreground">Manage database-backed work items (preview generation, links).</p>
        </div>
        <button className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50" disabled title="Coming soon: Create Work Item">
          New Work Item
        </button>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 text-left font-medium">Title</th>
              <th className="p-4 text-left font-medium">Slug</th>
              <th className="p-4 text-left font-medium">Preview</th>
              <th className="p-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground italic">No work items found.</td>
              </tr>
            ) : (
              items.map((w) => (
                <tr key={w.slug} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-medium">{w.title}</td>
                  <td className="p-4 text-muted-foreground font-mono text-xs">{w.slug}</td>
                  <td className="p-4">
                    {w.previewImageUrl ? (
                      <img src={w.previewImageUrl} alt={w.title} style={{ maxWidth: 160, borderRadius: 6 }} />
                    ) : (
                      <span className="text-muted-foreground text-xs">No preview</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <Link href={`/admin/dashboard/work-items/${w.slug}`} className="text-xs text-blue-500 hover:underline mr-4">
                      Edit
                    </Link>
                    <a href={`/work/${w.slug}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">View</a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
