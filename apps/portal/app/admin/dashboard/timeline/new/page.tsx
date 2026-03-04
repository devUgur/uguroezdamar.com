import AdminTimelineForm from "@/features/timeline/ui/AdminTimelineForm";

export default function AdminTimelineNewPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">New Timeline Entry</h1>
        <p className="text-muted-foreground">Create an entry for About or Education sections.</p>
      </div>
      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <AdminTimelineForm />
      </div>
    </div>
  );
}
