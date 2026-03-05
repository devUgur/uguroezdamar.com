import Link from "next/link";

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-card flex flex-col">
      <div className="p-6 border-b">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Portfolio Admin
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Dashboard
        </Link>
        <Link href="/admin/leads" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Leads
        </Link>
        <div className="pt-4 mt-4 border-t opacity-50 px-4 text-xs font-semibold uppercase tracking-wider">
          Content
        </div>
        <Link href="/admin/blog" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Blog Posts
        </Link>
        <Link href="/admin/projects" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Projects
        </Link>
        <Link href="/admin/timeline" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Timeline
        </Link>
        <Link href="/admin/work-items" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Work Items
        </Link>
        <Link href="/profile" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Profile
        </Link>
        <div className="pt-4 mt-4 border-t opacity-50 px-4 text-xs font-semibold uppercase tracking-wider">
          Settings
        </div>
        <Link href="/admin/admins" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Manage Admins
        </Link>
      </nav>
      <div className="p-4 border-t">
        <form action="/api/auth/logout" method="post">
          <button className="w-full text-left px-4 py-2 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-colors">
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
