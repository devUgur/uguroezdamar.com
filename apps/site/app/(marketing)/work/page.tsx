import React from "react";
import { getSiteWorkItems } from "@/apps/site/src/server/work";
import WorkGrid from "@/features/work/ui/WorkGrid";
import WorkHero from "@/features/work/ui/WorkHero";
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
