import type { Metadata } from "next";

import { Education } from "@/src/features/marketing/Education";

export const metadata: Metadata = { title: "Education" };

export default function EducationPage() {
  return <Education />;
}
