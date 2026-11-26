"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AgentsApiError, agentsApi, agentsApiOrigin, isAgentsApiId } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";
import type { AgentConfig, AgentEvent, AgentSummary, ChatView, ModelCatalog, ModelChoice, OfficeSnapshot, Thread, ThreadDetail } from "./types";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Server Actions are public endpoints: each one checks the session itself. */
async function actor(): Promise<string> {
  const session = await getCurrentSession();
  if (!session) throw new Error("Nicht angemeldet.");
  return session.email;
}

function failure(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler" };
}

function assertThread(threadId: string): void {
  if (!isAgentsApiId(threadId)) throw new Error("Ungültiger Thread.");
}

export async function createThread(): Promise<void> {
  const thread = await agentsApi<Thread>("/api/threads", await actor(), { method: "POST", body: {} });
  revalidatePath("/chat", "layout");
  redirect(`/chat/${thread.id}`);
}

export async function sendMessage(threadId: string, text: string): Promise<ActionResult> {
  try {
    assertThread(threadId);
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: "Leere Nachricht." };
    const result = await agentsApi<{ accepted: boolean; busy?: boolean; message?: string }>(
      `/api/threads/${threadId}/chat`,
      await actor(),
      { method: "POST", body: { text: trimmed.slice(0, 20_000) } },
    );
    revalidatePath("/chat", "layout");
    return { ok: result.accepted, message: result.message };
  } catch (error) {
    return failure(error);
  }
}

export async function stopThread(threadId: string): Promise<ActionResult> {
  try {
    assertThread(threadId);
    await agentsApi(`/api/threads/${threadId}/stop`, await actor(), { method: "POST" });
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function chooseModel(threadId: string, model: ModelChoice | null): Promise<ActionResult> {
  try {
    assertThread(threadId);
    await agentsApi(`/api/threads/${threadId}`, await actor(), { method: "PATCH", body: { model } });
    revalidatePath(`/chat/${threadId}`);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveThread(threadId: string): Promise<void> {
  assertThread(threadId);
  await agentsApi(`/api/threads/${threadId}`, await actor(), { method: "DELETE" });
  revalidatePath("/chat", "layout");
  redirect("/chat");
}

export async function decideApproval(approvalId: string, decision: "approve" | "reject"): Promise<ActionResult> {
  try {
    if (!isAgentsApiId(approvalId)) throw new Error("Ungültige Freigabe.");
    const result = await agentsApi<{ ok: boolean; outcome: string }>(`/api/approvals/${approvalId}`, await actor(), {
      method: "POST",
      body: { decision },
    });
    return { ok: decision === "reject" || result.ok, message: result.outcome };
  } catch (error) {
    return failure(error);
  }
}

async function chatView(threadId: string, who: string): Promise<ChatView> {
  const [detail, catalog] = await Promise.all([
    agentsApi<ThreadDetail>(`/api/threads/${threadId}`, who),
    agentsApi<ModelCatalog>("/api/models", who),
  ]);
  return { detail, catalog, liveOrigin: agentsApiOrigin() };
}

/** Configuration shown in the office's side sheet. Names and states only, never secret values. */
export async function loadAgentConfig(agentId: string): Promise<AgentConfig> {
  const who = await actor();
  if (!/^[a-z0-9-]{1,40}$/.test(agentId)) throw new Error("Unbekannter Agent.");
  return agentsApi<AgentConfig>(`/api/agents/${agentId}/config`, who);
}

/** The agent's newest open thread, or a new one: what the office's chat dialog shows. */
export async function openAgentChat(agentId: string, fresh = false): Promise<ChatView> {
  const who = await actor();
  if (!/^[a-z0-9-]{1,40}$/.test(agentId)) throw new Error("Unbekannter Agent.");
  const agents = await agentsApi<AgentSummary[]>("/api/agents", who);
  const agent = agents.find((entry) => entry.id === agentId);
  if (!agent) throw new Error("Unbekannter Agent.");
  const threadId =
    !fresh && agent.lastThreadId ? agent.lastThreadId : (await agentsApi<Thread>("/api/threads", who, { method: "POST", body: { agentId } })).id;
  return chatView(threadId, who);
}

export async function loadChat(threadId: string): Promise<ChatView> {
  assertThread(threadId);
  return chatView(threadId, await actor());
}

/** One-time ticket for the live WebSocket; valid for 60 seconds, consumed on connect. */
export async function liveTicket(): Promise<string> {
  const { ticket } = await agentsApi<{ ticket: string }>("/api/live-ticket", await actor(), { method: "POST" });
  return ticket;
}

/** Current shared figure positions; the caller's 3D camera never leaves this browser. */
export async function loadOfficeState(): Promise<{ ok: true; snapshot: OfficeSnapshot } | { ok: false; error: string }> {
  try {
    return { ok: true, snapshot: await agentsApi<OfficeSnapshot>("/api/office/state", await actor()) };
  } catch (error) {
    if (!(error instanceof AgentsApiError)) {
      console.error("office snapshot load failed", error);
      return { ok: false, error: "Der Bürostatus konnte nicht geladen werden." };
    }
    const message = error.status === 404
      ? "Der API-Worker kennt den Büro-Endpunkt noch nicht. Bitte API-Dev aktualisieren."
      : error.status === 401 || error.status === 403
        ? "Die API hat den Bürostatus-Zugriff abgelehnt. API-Zugang prüfen."
        : error.status === 502 || error.status === 503
          ? error.message
          : `Bürostatus konnte nicht geladen werden (HTTP ${error.status}).`;
    console.error("office snapshot load failed", error.status, error.message);
    return { ok: false, error: message };
  }
}

/** Events of a thread after a given id, to catch up after the live connection dropped. */
export async function eventsSince(threadId: string, sinceId: number): Promise<AgentEvent[]> {
  assertThread(threadId);
  return agentsApi<AgentEvent[]>(`/api/events?thread=${threadId}&since=${Math.max(0, Math.floor(sinceId))}`, await actor());
}
