"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agentsApi, isAgentsApiId } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";

/** Server Actions are public endpoints: each one checks the session itself. */
async function actor(): Promise<string> {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/projects");
  return session.email;
}

const PROJECT_ID = /^[a-z0-9-]{1,40}$/;

/** Ends an action with a message on the page. redirect() throws, so it must stay outside try/catch. */
function back(kind: "notice" | "error", message: string): never {
  revalidatePath("/projects");
  redirect(`/projects?${kind}=${encodeURIComponent(message)}`);
}

function failure(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

export async function registerProject(formData: FormData): Promise<void> {
  const repo = String(formData.get("repo") ?? "").trim();
  const who = await actor();
  let message: string;
  try {
    const result = await agentsApi<{ id: string; created: boolean }>("/api/projects", who, { method: "POST", body: { repo } });
    message = result.created ? `${repo} ist jetzt ein Projekt.` : `${repo} war schon ein Projekt und ist aktualisiert.`;
  } catch (error) {
    back("error", failure(error));
  }
  back("notice", message);
}

export async function unregisterProject(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const who = await actor();
  if (!PROJECT_ID.test(id)) back("error", "Ungültiges Projekt.");
  try {
    await agentsApi(`/api/projects/${id}`, who, { method: "DELETE" });
  } catch (error) {
    back("error", failure(error));
  }
  back("notice", "Projekt entfernt. Threads und Aufgaben bleiben als Verlauf erhalten.");
}

/** Opens a new thread for the project; the agent then works in that project's repository. */
export async function startProjectChat(formData: FormData): Promise<void> {
  const projectId = String(formData.get("id") ?? "");
  const who = await actor();
  if (!PROJECT_ID.test(projectId)) back("error", "Ungültiges Projekt.");
  let threadId: string;
  try {
    const thread = await agentsApi<{ id: string }>("/api/threads", who, { method: "POST", body: { projectId } });
    if (!isAgentsApiId(thread.id)) throw new Error("Unerwartete Antwort der API.");
    threadId = thread.id;
  } catch (error) {
    back("error", failure(error));
  }
  redirect(`/chat/${threadId}`);
}
