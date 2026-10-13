import { isIP } from "node:net";

/**
 * The address of the client behind the hosting proxy, or `null` when it cannot be trusted.
 *
 * Production runs on Render, which fronts every service with Cloudflare. Cloudflare sets
 * `cf-connecting-ip` itself and overwrites whatever the client sent, so it is the one header a
 * caller cannot choose. `x-forwarded-for` is not used: its first entry comes from the client.
 * A local dev server has no proxy; there the loopback address stands in so the form works.
 */
export function clientAddress(headers: Headers, nodeEnv = process.env.NODE_ENV): string | null {
  const address = headers.get("cf-connecting-ip")?.trim();
  if (address && isIP(address) !== 0) return address;
  if (!address && nodeEnv === "development") return "127.0.0.1";
  return null;
}
