"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * When rendered without session: redirect to "/" if current path is not "/".
 * Use in (app) layout next to PublicLayout so unauthenticated users only see "/".
 */
export function RedirectIfNotHome() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/") return;
    router.replace("/");
  }, [pathname, router]);

  return null;
}
