import Link from "next/link";
import { getCareerEntriesSnapshot, type CareerEntry } from "@/apps/portal/src/adapters/career";

function visibilityLabel(item: CareerEntry) {
  const visibility = item.visibility;
  if (!visibility) return "Hidden";
  const labels: string[] = [];
  if (visibility.about) labels.push("About");
  if (visibility.education) labels.push("Education");
  if (visibility.career) labels.push("Career");
  return labels.length ? labels.join(", ") : "Hidden";
}

export default async function CareerPage() {
  const items = await getCareerEntriesSnapshot();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Career</h1>
          <p className="text-muted-foreground">Manage work, education, and other entries for your professional resume.</p>
        </div>
        <Link href="/admin/career/new" className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          New Entry
        </Link>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 text-left font-medium">Title</th>
              <th className="p-4 text-left font-medium">Type</th>
              <th className="p-4 text-left font-medium">Organization</th>
              <th className="p-4 text-left font-medium">Visibility</th>
              <th className="p-4 text-left font-medium">Status</th>
              <th className="p-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground italic">No career entries found.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-medium">{item.title}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                      {item.type}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground">{item.organization || "N/A"}</td>
                  <td className="p-4 text-muted-foreground text-xs">{visibilityLabel(item)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.status === "published" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Link href={`/admin/career/${item._id}`} className="text-xs text-blue-500 hover:underline mr-4">
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
  );
}
