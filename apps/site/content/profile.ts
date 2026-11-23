import { ProfileSchema, type ProfileInput } from "@/src/content/profile";

/**
 * Public professional profile. Sourced from the October 2026 CV.
 * Do not add private contact details, implied degrees, or unpublished project claims.
 * The planned dual degree is not listed as completed or currently enrolled.
 */
const profile: ProfileInput = {
  headline: "I work across interfaces, APIs, data, and deployment.",
  bio:
    "I'm a full-stack developer based in Dortmund with professional experience building web applications and managing development infrastructure. I work with TypeScript, Vue/Nuxt, React/Next.js, Node.js, Python, and cloud tooling, and build independent projects focused on software automation.",
  experience: [
    {
      title: "Full-stack Developer (full-time, DevOps responsibilities)",
      organization: "Cherry Communication GmbH",
      location: "Dortmund",
      summary:
        "Developed Vue/Nuxt web applications and Node.js REST APIs, integrated PostgreSQL and MongoDB, and built Linux-based development and deployment workflows with Jenkins and Git.",
      period: { from: 2024, to: 2025 },
    },
    {
      title: "Freelance Web Developer",
      organization: "Self-employed",
      location: "Dortmund",
      summary:
        "Designed and launched responsive websites for small businesses and organizations using Vue, Next.js and TypeScript; handled SEO and direct customer requirements.",
      period: { from: 2022, to: 2024 },
    },
  ],
  education: [
    {
      title: "Computer Science studies (without degree)",
      institution: "TU Dortmund University",
      location: "Dortmund",
      note: "Undergraduate coursework; no degree awarded.",
      period: { from: 2016, to: 2024 },
    },
  ],
};

export default ProfileSchema.parse(profile);
