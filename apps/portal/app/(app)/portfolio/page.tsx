import type { Metadata } from "next";
import { getPortfolio, PortfolioView } from "@/src/features/portfolio";

export const metadata: Metadata = { title: "Portfolio" };

type Param = string | string[] | undefined;
const first = (value: Param): string | undefined => (Array.isArray(value) ? value[0] : value);

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ notice?: Param; error?: Param }> }) {
  const params = await searchParams;
  const result = await getPortfolio();
  return <PortfolioView {...result} notice={first(params.notice)} actionError={first(params.error)} />;
}
