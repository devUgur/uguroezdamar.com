import { redirect } from "next/navigation";
import { officeUrl } from "@/src/adapters/office";

/** Chats live in the office app (ADR 0039). */
export default function ChatIndexPage() {
  redirect(officeUrl("/chat"));
}
