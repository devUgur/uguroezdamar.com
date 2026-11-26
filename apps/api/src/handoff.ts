import type { Caller } from "./auth.ts";
import type { Env } from "./env.ts";

/**
 * Sign-in handoff from the portal to the office app (ADR 0039). The portal server checks its own admin session and
 * asks for a ticket; the office server redeems it once and then keeps its own session. Both sides call with the
 * service token of their stage, so no secret is shared between the two apps and no password reaches the office.
 */
const TTL_SECONDS = 60;
const KEY = (ticket: string) => `handoff:${ticket}`;

export interface HandoffIdentity {
  actor: string;
  /** May change organization settings (the portal's owner check), carried into the office session. */
  canManage: boolean;
}

export async function issueHandoff(env: Env, caller: Caller, input: { canManage?: unknown }): Promise<{ ticket: string; expiresIn: number }> {
  if (!caller.actor || caller.actor === "portal") throw new HandoffError("Ohne angemeldete Person gibt es kein Ticket.");
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const ticket = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const identity: HandoffIdentity = { actor: caller.actor, canManage: input.canManage === true };
  await env.CONFIG.put(KEY(ticket), JSON.stringify(identity), { expirationTtl: TTL_SECONDS });
  return { ticket, expiresIn: TTL_SECONDS };
}

/** One use only: the ticket is deleted before the identity is returned. */
export async function redeemHandoff(env: Env, ticket: unknown): Promise<HandoffIdentity | null> {
  if (typeof ticket !== "string" || !/^[0-9a-f]{64}$/.test(ticket)) return null;
  const stored = await env.CONFIG.get(KEY(ticket));
  if (!stored) return null;
  await env.CONFIG.delete(KEY(ticket));
  const identity = JSON.parse(stored) as HandoffIdentity;
  return { actor: identity.actor, canManage: identity.canManage === true };
}

export class HandoffError extends Error {}
