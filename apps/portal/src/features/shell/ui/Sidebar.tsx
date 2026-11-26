import Link from "next/link";
import { ThemeToggle } from "@ugur/ui";

export function Sidebar() {
  return (
    <aside className="hidden h-full w-64 shrink-0 border-r bg-card md:flex flex-col overflow-y-auto">
      <div className="p-6 border-b">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Portfolio
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Dashboard
        </Link>
        <Link href="/agents" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Agenten
        </Link>
        <Link href="/work" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Aufgaben
        </Link>
        <Link href="/usage" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Verbrauch &amp; Kosten
        </Link>
        <Link href="/organization" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Organisation
        </Link>
        <Link href="/projects" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Repositories
        </Link>
        <Link href="/portfolio" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Portfolio
        </Link>
        <Link href="/chat" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Chat
        </Link>
        <div className="pt-4 mt-4 border-t opacity-50 px-4 text-xs font-semibold uppercase tracking-wider">
          Settings
        </div>
        <Link href="/models" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Modelle &amp; Schlüssel
        </Link>
        <Link href="/admin/team" className="block px-4 py-2 rounded-md hover:bg-accent transition-colors">
          Team
        </Link>
      </nav>
      <div className="p-4 border-t space-y-3">
        <div className="flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Theme
          <ThemeToggle />
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="w-full text-left px-4 py-2 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-colors">
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
