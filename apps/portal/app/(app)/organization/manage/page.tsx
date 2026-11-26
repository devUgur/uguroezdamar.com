import { notFound } from "next/navigation";
import { getOrganizationAccess } from "@/src/features/organization/access";
import { getOrganizationAudit, getOrganizationCatalog } from "@/src/features/organization/queries";
import { OrganizationManager } from "@/src/features/organization/ui/OrganizationManager";

type Param = string | string[] | undefined;

export default async function OrganizationManagePage({ searchParams }: { searchParams: Promise<{ notice?: Param; error?: Param }> }) {
  const access = await getOrganizationAccess();
  if (!access.canManage) notFound();
  const [{ catalog, error }, { audit, error: auditError }, params] = await Promise.all([getOrganizationCatalog(), getOrganizationAudit(), searchParams]);
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const actionError = Array.isArray(params.error) ? params.error[0] : params.error;
  return <OrganizationManager catalog={catalog} audit={audit} error={actionError ?? error} auditError={auditError} notice={notice ?? null} />;
}
