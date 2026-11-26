"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { agentsApi, isAgentsApiId } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";
import { currentOrganizationAccess } from "@/src/server/organization-access";

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

/**
 * "GitHub verbinden": the API builds the installation link for the app (with a signed state for this account),
 * and GitHub sends the browser back to /projects when the installation is done. The address to return to is
 * this portal's own origin, taken from the request.
 */
export async function connectGithub(): Promise<void> {
  const who = await actor();
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  if (!host) back("error", "Die eigene Adresse ließ sich nicht bestimmen.");
  let url: string;
  try {
    ({ url } = await agentsApi<{ url: string }>("/api/github/connect", who, { method: "POST", body: { returnTo: `${protocol}://${host}/projects` } }));
  } catch (error) {
    back("error", failure(error));
  }
  if (!url.startsWith("https://github.com/apps/")) back("error", "Unerwartete Antwort der API.");
  redirect(url);
}

const UUID = /^[0-9a-f-]{36}$/;

/** Ends an action on the project page with a message. */
function backTo(projectId: string, kind: "notice" | "error", message: string): never {
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?${kind}=${encodeURIComponent(message)}`);
}

export async function createSprint(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const who = await actor();
  if (!PROJECT_ID.test(projectId)) back("error", "Ungültiges Projekt.");
  try {
    await agentsApi(`/api/projects/${projectId}/sprints`, who, {
      method: "POST",
      body: { name: formData.get("name"), goal: formData.get("goal"), startsAt: formData.get("startsAt"), endsAt: formData.get("endsAt") },
    });
  } catch (error) {
    backTo(projectId, "error", failure(error));
  }
  backTo(projectId, "notice", "Sprint angelegt.");
}

export async function changeSprintStatus(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const sprintId = String(formData.get("sprintId") ?? "");
  const status = String(formData.get("status") ?? "");
  const who = await actor();
  if (!PROJECT_ID.test(projectId) || !UUID.test(sprintId)) back("error", "Ungültiger Sprint.");
  try {
    await agentsApi(`/api/sprints/${sprintId}`, who, { method: "PATCH", body: { status } });
  } catch (error) {
    backTo(projectId, "error", failure(error));
  }
  backTo(projectId, "notice", status === "active" ? "Sprint gestartet." : status === "done" ? "Sprint abgeschlossen; offene Aufgaben sind zurück im Backlog." : "Sprint aktualisiert.");
}

export async function moveTaskToSprint(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const sprintId = String(formData.get("sprintId") ?? "");
  const who = await actor();
  if (!PROJECT_ID.test(projectId) || !UUID.test(taskId) || (sprintId && !UUID.test(sprintId))) back("error", "Ungültige Aufgabe.");
  try {
    await agentsApi(`/api/tasks/${taskId}`, who, { method: "PATCH", body: { sprintId: sprintId || null } });
  } catch (error) {
    backTo(projectId, "error", failure(error));
  }
  backTo(projectId, "notice", sprintId ? "Aufgabe eingeplant." : "Aufgabe zurück im Backlog.");
}

export async function createProjectTask(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const sprintId = String(formData.get("sprintId") ?? "");
  const who = await actor();
  if (!PROJECT_ID.test(projectId) || (sprintId && !UUID.test(sprintId))) back("error", "Ungültiges Projekt.");
  try {
    await agentsApi("/api/tasks", who, {
      method: "POST",
      body: {
        projectId,
        sprintId: sprintId || undefined,
        title: formData.get("title"),
        description: formData.get("description") || undefined,
        acceptanceCriteria: formData.get("acceptanceCriteria") || undefined,
        priority: formData.get("priority") || undefined,
      },
    });
  } catch (error) {
    backTo(projectId, "error", failure(error));
  }
  backTo(projectId, "notice", "Aufgabe angelegt.");
}

/** Only the owner decides which model providers may see a project's content (ADR 0033). */
export async function setModelPolicy(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const value = String(formData.get("modelPolicy") ?? "");
  const access = await currentOrganizationAccess();
  if (!PROJECT_ID.test(projectId)) back("error", "Ungültiges Projekt.");
  if (!access.canManage) backTo(projectId, "error", "Nur der Owner darf die Datenrichtlinie ändern.");
  const modelPolicy = value === "strict" || value === "open" ? value : null;
  try {
    await agentsApi(`/api/projects/${projectId}`, access.actor, { method: "PATCH", body: { modelPolicy }, scopes: ["providers:write"] });
  } catch (error) {
    backTo(projectId, "error", failure(error));
  }
  backTo(projectId, "notice", modelPolicy === "open" ? "Richtlinie offen: alle Anbieter mit Schlüssel dürfen dieses Projekt sehen." : modelPolicy === "strict" ? "Richtlinie streng: nur Anbieter ohne Datenauswertung." : "Richtlinie folgt wieder dem Repository.");
}

/** Starts (or refreshes) the knowledge index of a project; it runs in the background in stages. */
export async function reindexKnowledge(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const who = await actor();
  if (!PROJECT_ID.test(projectId)) back("error", "Ungültiges Projekt.");
  try {
    await agentsApi(`/api/projects/${projectId}/knowledge/reindex`, who, { method: "POST" });
  } catch (error) {
    backTo(projectId, "error", failure(error));
  }
  backTo(projectId, "notice", "Indexierung gestartet. Sie läuft im Hintergrund; lade die Seite in einer Minute neu.");
}
