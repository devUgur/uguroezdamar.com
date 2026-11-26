"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agentsApi } from "@/src/adapters/agents-api";
import { requirePortfolioOwner } from "./access";

function back(kind: "notice" | "error", message: string): never {
  revalidatePath("/portfolio");
  redirect(`/portfolio?${kind}=${encodeURIComponent(message)}`);
}

function failure(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

export async function createPortfolioProject(formData: FormData): Promise<void> {
  const owner = await requirePortfolioOwner();
  const name = String(formData.get("name") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const priority = String(formData.get("priority") ?? "P2");
  try {
    await agentsApi("/api/portfolio-projects", owner.actor, {
      method: "POST", scopes: owner.scopes, body: { name, summary, priority },
    });
  } catch (error) {
    back("error", failure(error));
  }
  back("notice", `„${name}“ wurde zum Portfolio hinzugefügt.`);
}

export async function linkPortfolioRepository(formData: FormData): Promise<void> {
  const owner = await requirePortfolioOwner();
  const projectId = String(formData.get("projectId") ?? "");
  const repositoryProjectId = String(formData.get("repositoryProjectId") ?? "");
  if (!/^[a-z0-9-]{1,40}$/.test(projectId) || !/^[a-z0-9-]{1,40}$/.test(repositoryProjectId)) {
    back("error", "Ungültige Projekt- oder Repository-Auswahl.");
  }
  try {
    await agentsApi(`/api/portfolio-projects/${projectId}/repositories`, owner.actor, {
      method: "POST", scopes: owner.scopes, body: { repositoryProjectId },
    });
  } catch (error) {
    back("error", failure(error));
  }
  back("notice", "Repository wurde dem Produktprojekt zugeordnet.");
}

export async function updatePortfolioProject(formData: FormData): Promise<void> {
  const owner = await requirePortfolioOwner();
  const projectId = String(formData.get("projectId") ?? "");
  const version = Number(formData.get("version"));
  if (!/^[a-z0-9-]{1,40}$/.test(projectId) || !Number.isSafeInteger(version) || version < 1) {
    back("error", "Ungültige Projektversion. Bitte Seite neu laden.");
  }
  const body = {
    name: String(formData.get("name") ?? "").trim(),
    summary: String(formData.get("summary") ?? "").trim(),
    priority: String(formData.get("priority") ?? "P2"),
    status: String(formData.get("status") ?? "active"),
    version,
  };
  try {
    await agentsApi(`/api/portfolio-projects/${projectId}`, owner.actor, { method: "PATCH", scopes: owner.scopes, body });
  } catch (error) {
    back("error", failure(error));
  }
  back("notice", `„${body.name}“ wurde aktualisiert.`);
}
