import { contactSchema, createContactRequest, type ContactInput } from "@ugur/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  if (parsed.data.nickname) {
    return NextResponse.json({ ok: true });
  }

  try {
    const id = await createContactRequest(parsed.data as ContactInput);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("Failed to save contact request:", error);
    return NextResponse.json({ ok: false, error: "Failed to save message" }, { status: 500 });
  }
}
