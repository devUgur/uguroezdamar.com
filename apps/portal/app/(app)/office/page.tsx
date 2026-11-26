import { redirect } from "next/navigation";
import { officeUrl } from "@/src/adapters/office";

type Param = string | string[] | undefined;

/** The office is its own app (apps/office, ADR 0039); this link keeps the portal navigation and old deep links. */
export default async function OfficeRedirect({ searchParams }: { searchParams: Promise<Record<string, Param>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string" && (key === "agent" || key === "project")) params.set(key, value);
  const query = params.toString();
  redirect(officeUrl(query ? `/?${query}` : "/"));
}
