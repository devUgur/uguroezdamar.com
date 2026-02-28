"use server";

import { contactSchema } from "@/features/contact/server/validators";

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

  // Stub for persistence/email.
  return { ok: true as const };
}
