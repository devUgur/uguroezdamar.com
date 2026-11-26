import { redirect } from "next/navigation";

/** Costs live in the usage ledger since plan stage 1: one page for consumption and costs. Old links keep working. */
export default function CostsPage() {
  redirect("/usage");
}
