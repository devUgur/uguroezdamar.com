import AdminWorkForm from "@/src/features/work/ui/AdminWorkForm";

export default function AdminWorkItemNewPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">New Work Item</h1>
        <p className="text-muted-foreground">Create a new work item with links, status, and optional preview.</p>
      </div>
      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <AdminWorkForm />
      </div>
    </div>
  );
}
