import type { Env } from "./env.ts";

/**
 * Fail closed: a request passes with a valid Cloudflare Access token (once Access protects the
 * hostname) or with the platform admin token. With neither configured, nothing passes.
 */
export async function authorize(request: Request, env: Env): Promise<boolean> {
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    const jwt = request.headers.get("cf-access-jwt-assertion");
    if (jwt && (await verifyAccessJwt(jwt, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD))) return true;
  }

  const expected = env.PLATFORM_ADMIN_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization");
  const given = header?.startsWith("Bearer ") ? header.slice(7) : new URL(request.url).searchParams.get("token");
  return given ? constantTimeEqual(given, expected) : false;
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(hashA, hashB);
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

let certCache: { teamDomain: string; keys: Jwk[]; fetchedAt: number } | undefined;

async function accessKeys(teamDomain: string): Promise<Jwk[]> {
  if (certCache && certCache.teamDomain === teamDomain && Date.now() - certCache.fetchedAt < 3_600_000) {
    return certCache.keys;
  }
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) return [];
  const { keys } = (await response.json()) as { keys: Jwk[] };
  certCache = { teamDomain, keys, fetchedAt: Date.now() };
  return keys;
}

function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function verifyAccessJwt(token: string, teamDomain: string, audience: string): Promise<boolean> {
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart) return false;
  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerPart))) as { kid?: string; alg?: string };
    if (header.alg !== "RS256") return false;
    const jwk = (await accessKeys(teamDomain)).find((key) => key.kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlDecode(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart))) as {
      aud?: string | string[];
      exp?: number;
      iss?: string;
    };
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    return audiences.includes(audience) && (payload.exp ?? 0) * 1000 > Date.now() && payload.iss === `https://${teamDomain}`;
  } catch {
    return false;
  }
}
