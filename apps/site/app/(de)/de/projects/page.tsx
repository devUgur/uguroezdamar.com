import type { Metadata } from "next";
import { getProjects } from "@/src/content/projects";
import { ProjectGrid } from "@/src/features/projects";

export const metadata: Metadata = {
  title: "Projekte",
  description: "Ausgewählte Softwareprojekte von Ugur Özdamar – Herausforderungen, Lösungen und technische Architektur.",
  alternates: { canonical: "/de/projects", languages: { en: "/projects", de: "/de/projects" } },
};

export default async function GermanProjectsPage() {
  return <div className="site-container py-16 md:py-24"><ProjectGrid projects={await getProjects({ locale: "de" })} locale="de" /></div>;
}
