import { getCareerEntryByIdAdapter } from "@/src/adapters/career";
import { CareerEntryForm } from "@/src/features/career/ui/CareerEntryForm";
import { notFound } from "next/navigation";

export default async function CareerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getCareerEntryByIdAdapter(id);

  if (!item) {
    notFound();
  }

  return <CareerEntryForm id={id} initial={item} />;
}
