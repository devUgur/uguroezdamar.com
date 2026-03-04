import { cookies, headers } from "next/headers";

export async function readCookie(name: string): Promise<string | null> {
  try {
    const store = await cookies();
    const value = store.get(name)?.value;
    if (value) return value;
  } catch {
    // ignore and fallback to header parsing
  }

  try {
    const hdrs = await headers();
    const cookieHeader = hdrs.get("cookie") ?? "";
    if (!cookieHeader) return null;
    const match = cookieHeader.split("; ").find((entry: string) => entry.startsWith(`${name}=`));
    if (!match) return null;
    return match.split("=").slice(1).join("=") || null;
  } catch {
    return null;
  }
}
