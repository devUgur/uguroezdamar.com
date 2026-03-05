import Link from "next/link";
import { cookies } from "next/headers";

export async function Footer() {
  let isAuthed = false;
  try {
    const store = await cookies();
    isAuthed = !!store.get("admin_session")?.value;
  } catch (error) {
    // In environments where `cookies()` is not available (e.g., during build), this will throw.
    // We can safely ignore this error and assume the user is not authenticated.
  }

  return (
    <footer className="border-t border-border/40 py-10 mt-auto bg-background transition-colors duration-300">
      <div className="flex flex-col md:flex-row items-center justify-between px-6 md:px-12 lg:px-24">
        <span className="font-mono text-xs md:text-sm tracking-widest text-muted-foreground uppercase hover:text-foreground transition-colors duration-300 text-center md:text-left">
          © {new Date().getFullYear()} Ugur Özdamar — All Rights Reserved
        </span>
        {isAuthed && (
          <Link href="/admin" className="mt-4 md:mt-0 font-mono text-[10px] uppercase tracking-widest text-accent hover:underline opacity-50 hover:opacity-100 transition-all">
            Portal
          </Link>
        )}
      </div>
    </footer>
  );
}
