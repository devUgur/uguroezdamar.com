"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agentsApi } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";
import { agentsApiOrigin } from "@/src/adapters/agents-api";
import type { WorkStatus } from "./types";

async function actor(): Promise<string> {
  const session = await getCurrentSession();
  if (!session) throw new Error("Nicht angemeldet.");
  return session.email;
}

export async function workLiveTicket(): Promise<{ origin: string | null; ticket: string | null }> {
  const who = await actor();
  const origin = agentsApiOrigin();
  if (!origin) return { origin: null, ticket: null };
  const { ticket } = await agentsApi<{ ticket: string }>("/api/live-ticket", who, { method: "POST" });
  return { origin, ticket };
}

export async function createWorkTask(formData: FormData): Promise<void> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const acceptanceCriteria = String(formData.get("acceptanceCriteria") ?? "").trim();
  const priority = String(formData.get("priority") ?? "normal");
  await agentsApi("/api/tasks", await actor(), {
    method: "POST",
    body: { title, description, acceptanceCriteria, priority, projectId: "uguroezdamar" },
  });
  revalidatePath("/work");
  redirect("/work");
}

export async function updateWorkTask(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as WorkStatus;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Ungültige Aufgaben-ID.");
  await agentsApi(`/api/tasks/${id}`, await actor(), { method: "PATCH", body: { status } });
  revalidatePath("/work");
  redirect("/work");
}

export async function startWorkTask(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Ungültige Aufgaben-ID.");
  const result = await agentsApi<{ threadId: string }>(`/api/tasks/${id}/run`, await actor(), { method: "POST" });
  revalidatePath("/work");
  redirect(`/chat/${result.threadId}`);
}
