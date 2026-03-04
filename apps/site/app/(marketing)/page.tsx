import { Hero, Work, Contact } from "@/src/features/home";
import { About, Education } from "@/src/features/marketing";

export default function HomePage() {
  return (
    <>
      <Hero />
      <About />
      <Work />
      <Education />
      <Contact />
    </>
  );
}
