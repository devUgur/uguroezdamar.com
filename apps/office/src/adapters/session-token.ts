/**
 * The office session as a signed value (ADR 0039): `<payload>.<signature>`, both base64url. The key is derived
 * from the service token of the stage with HKDF, so the office needs no secret of its own and a rotated service
 * token ends every session. Pure Web Crypto: runs in Node, in tests and in the Worker.
 */
export interface OfficeSession {
  email: string;
  canManage: boolean;
  /** Expiry in milliseconds since the epoch. */
  exp: number;
}

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function signingKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: encoder.encode("uguroezdamar-office"), info: encoder.encode("office-session-v1") },
    material,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(session: OfficeSession, secret: string): Promise<string> {
  if (!secret) throw new Error("Kein Schlüssel für die Office-Session.");
  const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

/** null for anything forged, malformed or expired. */
export async function verifySession(value: string | undefined, secret: string, now = Date.now()): Promise<OfficeSession | null> {
  if (!value || !secret) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await signingKey(secret), fromBase64Url(signature), encoder.encode(payload));
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as Partial<OfficeSession>;
    if (typeof session.email !== "string" || typeof session.exp !== "number" || session.exp <= now) return null;
    return { email: session.email, canManage: session.canManage === true, exp: session.exp };
  } catch {
    return null;
  }
}

/** Only paths of this app: a `next` from a URL never leads to another site. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value.slice(0, 500);
}
