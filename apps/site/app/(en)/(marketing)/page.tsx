import profile from "@/content/profile";
import { hasAbout, hasEducation } from "@/src/content/profile";
import { Hero, Work, Contact } from "@/src/features/home";
import { About, Education } from "@/src/features/marketing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Ugur Özdamar — Software Engineering" },
  description: "Software Engineering · Digital Products. Full-stack development, scalable applications, and thoughtful engineering by Ugur Özdamar.",
  alternates: { canonical: "/", languages: { en: "/", de: "/de" } },
};

export default function HomePage() {
  // Sections without content are left out, and the remaining ones are numbered in order.
  const sections = [
    { key: "work", Section: Work, shown: true },
    { key: "about", Section: About, shown: hasAbout(profile) },
    { key: "education", Section: Education, shown: hasEducation(profile) },
    { key: "contact", Section: Contact, shown: true },
  ].filter((section) => section.shown);

  return (
    <>
      <Hero />
      {sections.map(({ key, Section }, index) => (
        <Section key={key} number={String(index + 2).padStart(2, "0")} />
      ))}
    </>
  );
}
