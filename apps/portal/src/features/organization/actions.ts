"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agentsApi, agentsApiOrigin } from "@/src/adapters/agents-api";
import { getOrganizationAccess, requireOrganizationOwner } from "./access";

function list(formData: FormData, name: string): string[] {
  return String(formData.get(name) ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
}

function back(kind: "notice" | "error", message: string): never {
  revalidatePath("/organization");
  revalidatePath("/organization/manage");
  revalidatePath("/agents");
  redirect(`/organization/manage?${kind}=${encodeURIComponent(message)}`);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Änderung konnte nicht gespeichert werden.";
}

export async function createOrganizationRole(formData: FormData): Promise<void> {
  const owner = await requireOrganizationOwner();
  const id = String(formData.get("id") ?? "").trim().toLowerCase();
  const body = {
    id,
    departmentId: String(formData.get("departmentId") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    purpose: String(formData.get("purpose") ?? "").trim(),
    responsibilities: list(formData, "responsibilities"),
    capabilities: list(formData, "capabilities"),
  };
  try {
    await agentsApi("/api/organization/roles", owner.actor, { method: "POST", body, scopes: owner.scopes });
  } catch (error) {
    back("error", message(error));
  }
  back("notice", `Rollenprofil „${body.name}“ angelegt. Es ist noch nicht ausführbar.`);
}

export async function updateOrganizationRole(formData: FormData): Promise<void> {
  const owner = await requireOrganizationOwner();
  const id = String(formData.get("id") ?? "");
  const version = Number(formData.get("version"));
  const body = {
    version,
    name: String(formData.get("name") ?? "").trim(),
    purpose: String(formData.get("purpose") ?? "").trim(),
    responsibilities: list(formData, "responsibilities"),
    capabilities: list(formData, "capabilities"),
  };
  try {
    await agentsApi(`/api/organization/roles/${encodeURIComponent(id)}`, owner.actor, { method: "PATCH", body, scopes: owner.scopes });
  } catch (error) {
    back("error", message(error));
  }
  back("notice", "Rollenprofil und Version wurden gespeichert.");
}

export async function updateOrganizationInstance(formData: FormData): Promise<void> {
  const owner = await requireOrganizationOwner();
  const id = String(formData.get("id") ?? "");
  const body = {
    version: Number(formData.get("version")),
    name: String(formData.get("name") ?? "").trim(),
    active: formData.get("active") === "true",
    deskX: Number(formData.get("deskX")),
    deskY: Number(formData.get("deskY")),
  };
  try {
    await agentsApi(`/api/organization/instances/${encodeURIComponent(id)}`, owner.actor, { method: "PATCH", body, scopes: owner.scopes });
  } catch (error) {
    back("error", message(error));
  }
  back("notice", `Instanz „${id}“ wurde aktualisiert.`);
}

export async function organizationLiveTicket(): Promise<{ origin: string | null; ticket: string | null }> {
  const access = await getOrganizationAccess();
  const origin = agentsApiOrigin();
  if (!origin) return { origin: null, ticket: null };
  const response = await agentsApi<{ ticket: string }>("/api/live-ticket", access.actor, { method: "POST" });
  return { origin, ticket: response.ticket };
}
