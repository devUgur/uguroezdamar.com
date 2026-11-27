import { redirect } from "next/navigation";
import { officeUrl } from "@/src/adapters/office";

type Param = string | string[] | undefined;

/** The office is its own app (apps/office, ADR 0039); this link keeps the portal navigation and old deep links. */
export default async function OfficeRedirect({ searchParams }: { searchParams: Promise<Record<string, Param>> }) {
  const { project, agent } = await searchParams;
  const path = typeof project === "string" && /^[a-z0-9-]{1,60}$/.test(project) ? `/projects/${project}` : "/";
  redirect(officeUrl(typeof agent === "string" ? `${path}?agent=${encodeURIComponent(agent)}` : path));
}
