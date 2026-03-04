import React from "react";
import { getWorkItems } from "@/features/work/server/repo";
import WorkGrid from "@/features/work/ui/WorkGrid";
import WorkHero from "@/features/work/ui/WorkHero";
import { Container } from "@ugur/ui";

export default async function WorkPage() {
  const items = await getWorkItems();
  return (
    <Container>
      <WorkHero />
      <WorkGrid items={items} />
    </Container>
  );
}
