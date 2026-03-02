import { cookies, headers } from "next/headers";

// Read a cookie robustly in Server Components: prefer `cookies()` then fallback to `headers()`
export async function readCookie(name: string): Promise<string | null> {
  try {
    // preferred API in Next App Router
    const store = await cookies();
    const v = store.get(name)?.value;
    if (v) return v;
  } catch {
    // ignore and fallback to header parsing
  }

  try {
    const hdrs = await headers();
    const cookieHeader = hdrs.get("cookie") ?? "";
    if (!cookieHeader) return null;
    const match = cookieHeader.split("; ").find((c: string) => c.startsWith(`${name}=`));
    if (!match) return null;
    return match.split("=").slice(1).join("=") || null;
  } catch {
    return null;
  }
}
