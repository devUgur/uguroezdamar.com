import profile from "@/content/profile";
import { hasAbout, hasEducation } from "@/src/content/profile";
import { getFeaturedProjects } from "@/src/content/projects";
import { Hero, Work, Capabilities, Contact } from "@/src/features/home";
import { About, Education } from "@/src/features/marketing";

export default async function HomePage() {
  // Project drafts are visible in local development only, never in a production
  // build. Avoid promoting an empty "Selected work" section on the public site.
  const hasFeaturedWork = (await getFeaturedProjects()).length > 0;
  const sections = [
    { key: "work", Section: Work, shown: hasFeaturedWork },
    { key: "capabilities", Section: Capabilities, shown: true },
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
