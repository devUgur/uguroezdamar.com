export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/apps/portal/src/adapters/auth";
import { Sidebar } from "@/src/features/admin/ui/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
