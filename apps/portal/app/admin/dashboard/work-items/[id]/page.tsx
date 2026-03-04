import AdminWorkForm from "@/src/features/work/ui/AdminWorkForm";
import { getAdminWorkItemSnapshotById } from "@/src/server/work";

export default async function EditWorkItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const work = await getAdminWorkItemSnapshotById(id);
  if (!work) return <div className="p-8">Work item not found.</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Edit Work Item</h1>
      {/* AdminWorkForm is a client component that will handle preview generation and showing preview image */}
      <AdminWorkForm id={work.slug} initial={work} />
    </div>
  );
}
