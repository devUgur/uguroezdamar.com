import { getProfile } from "@/features/profile/server/mongo";
import AdminProfileForm from "@/features/profile/ui/AdminProfileForm";

export default async function AdminProfilePage() {
  const profile = await getProfile("main");

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Profile</h1>
        <p className="text-muted-foreground">Manage your public about profile and social links.</p>
      </div>

      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <AdminProfileForm initial={profile ?? undefined} />
      </div>
    </div>
  );
}
