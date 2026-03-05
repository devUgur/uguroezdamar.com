import { getProfileSnapshot } from "@/src/server/profile";
import ProfileForm from "@/src/features/profile/ui/ProfileForm";

export default async function ProfilePage() {
  const profile = await getProfileSnapshot("main");

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Profile</h1>
        <p className="text-muted-foreground">Manage your public about profile and social links.</p>
      </div>

      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <ProfileForm initial={profile ?? undefined} />
      </div>
    </div>
  );
}
