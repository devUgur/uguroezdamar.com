import { getOrganizationCatalog, OrganizationView } from "@/src/features/organization";

export default async function OrganizationPage() {
  const { catalog, error } = await getOrganizationCatalog();
  return <OrganizationView catalog={catalog} error={error} />;
}
