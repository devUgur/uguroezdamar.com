import WorkForm from "@/src/features/work-items/ui/WorkForm";
import { getWorkItemById } from "@/src/server/work";

export default async function EditWorkItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const work = await getWorkItemById(id);
  if (!work) return <div className="p-8">Work item not found.</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Edit Work Item</h1>
      {/* WorkForm is a client component that will handle preview generation and showing preview image */}
      <WorkForm id={work.slug} initial={work} />
    </div>
  );
}
