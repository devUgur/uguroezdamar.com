import React from "react";
import { getSiteWorkItems } from "@/src/server/work";
import { WorkGrid, WorkHero } from "@/src/features/work-items";
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
