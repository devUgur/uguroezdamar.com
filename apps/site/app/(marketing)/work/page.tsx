import React from "react";
import { getSiteWorkItems } from "@/src/features/selected-work/queries";
import { WorkGrid, WorkHero } from "@/src/features/selected-work";
import { Container } from "@ugur/ui";

export default async function WorkPage() {
  const items = await getSiteWorkItems();
  return (
    <Container>
      <WorkHero />
      <WorkGrid items={items} />
    </Container>
  );
}
