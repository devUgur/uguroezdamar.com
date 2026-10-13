import { isIP } from "node:net";

/**
 * The address of the client behind the hosting proxy, or `null` when it cannot be trusted.
 *
 * Production runs on Vercel, which sets `x-vercel-forwarded-for` itself and does not forward
 * an address the client sent. `x-forwarded-for` carries the same value but is the header a
 * proxy placed in front of Vercel would rewrite, so it is not used. The domain's DNS must point
 * at Vercel directly (no proxying CDN in front), or every visitor shares the proxy's address.
 * A local dev server has no proxy; there the loopback address stands in so the form works.
 */
export function clientAddress(headers: Headers, nodeEnv = process.env.NODE_ENV): string | null {
  const address = headers.get("x-vercel-forwarded-for")?.trim();
  if (address && isIP(address) !== 0) return address;
  if (!address && nodeEnv === "development") return "127.0.0.1";
  return null;
}
