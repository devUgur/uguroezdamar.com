import { getCareerEntryByIdAdapter } from "@/apps/portal/src/adapters/career";
import { CareerEntryForm } from "@/apps/portal/src/features/career/ui/CareerEntryForm";
import { notFound } from "next/navigation";

export default async function CareerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getCareerEntryByIdAdapter(id);

  if (!item) {
    notFound();
  }

  return <CareerEntryForm id={id} initial={item} />;
}
