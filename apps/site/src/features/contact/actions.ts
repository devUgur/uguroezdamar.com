"use server";

import { contactSchema, createContactRequest, type ContactInput } from "@ugur/server";

export async function submitContact(_: unknown, formData: FormData) {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    message: String(formData.get("message") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
  };

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid input" };
  }

  if (parsed.data.nickname) {
    // Bot.
    return { ok: true as const };
  }

  try {
    const id = await createContactRequest(parsed.data as ContactInput);
    return { ok: true as const, id };
  } catch (error: unknown) {
    console.error("Failed to save contact request:", error);
    return { ok: false as const, error: "Failed to save message" };
  }
}
