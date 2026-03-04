export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getCurrentAdminSession } from "@/src/server/auth";
import Link from "next/link";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b">
          <Link href="/admin/dashboard" className="text-xl font-bold tracking-tight">
            Portfolio Admin
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/admin/dashboard" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
            Overview
          </Link>
          <Link href="/admin/dashboard/leads" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
            Leads
          </Link>
          <div className="pt-4 mt-4 border-t opacity-50 px-4 text-xs font-semibold uppercase tracking-wider">
            Content
          </div>
          <Link href="/admin/dashboard/blog" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
            Blog Posts
          </Link>
          <Link href="/admin/dashboard/projects" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
            Projects
          </Link>
          <Link href="/admin/dashboard/timeline" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
            Timeline
          </Link>
          <Link href="/admin/dashboard/profile" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
            Profile
          </Link>
          <div className="pt-4 mt-4 border-t opacity-50 px-4 text-xs font-semibold uppercase tracking-wider">
            Settings
          </div>
          <Link href="/admin/dashboard/admins" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
            Manage Admins
          </Link>
        </nav>
        <div className="p-4 border-t">
          <form action="/api/admin/logout" method="post">
            <button className="w-full text-left px-4 py-2 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-colors">
              Logout
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
