import { getCostReport } from "@/src/features/costs";
import { CostsView } from "@/src/features/costs/ui/CostsView";

export default async function CostsPage() {
  const result = await getCostReport();
  return <CostsView report={result.report} error={result.error} />;
}
