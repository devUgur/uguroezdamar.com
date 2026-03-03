import { getTimelineItemById } from "@/features/timeline/server/mongo";
import AdminTimelineForm from "@/features/timeline/ui/AdminTimelineForm";

export default async function AdminTimelineEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getTimelineItemById(id);

  if (!item) {
    return <div className="p-8">Timeline entry not found.</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Edit Timeline Entry</h1>
        <p className="text-muted-foreground">Update content and visibility for About/Education sections.</p>
      </div>
      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <AdminTimelineForm id={item.id} initial={item} />
      </div>
    </div>
  );
}
