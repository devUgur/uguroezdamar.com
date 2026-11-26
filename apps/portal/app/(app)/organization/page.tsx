import { getOrganizationCatalog, OrganizationView } from "@/src/features/organization";
import { getOrganizationAccess } from "@/src/features/organization/access";

export default async function OrganizationPage() {
  const [{ catalog, error }, access] = await Promise.all([getOrganizationCatalog(), getOrganizationAccess()]);
  return <OrganizationView catalog={catalog} error={error} canManage={access.canManage} />;
}
