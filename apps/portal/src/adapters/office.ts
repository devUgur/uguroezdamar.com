import "server-only";

/**
 * The office app (apps/office, ADR 0039) of the same stage. Production portal → office.uguroezdamar.com, Vercel
 * preview (branch dev) → office-dev.uguroezdamar.com, local → :3102. OFFICE_URL overrides it.
 */
export function officeOrigin(): string {
  const configured = process.env.OFFICE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.VERCEL_ENV === "production") return "https://office.uguroezdamar.com";
  if (process.env.VERCEL_ENV === "preview") return "https://office-dev.uguroezdamar.com";
  return "http://localhost:3102";
}

export function officeUrl(path = "/"): string {
  return `${officeOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** A sign-in may only return to the office's own callback, never to another site. */
export function isOfficeCallback(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.origin === officeOrigin() && url.pathname === "/auth/callback";
  } catch {
    return false;
  }
}
