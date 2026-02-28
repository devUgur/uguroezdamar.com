import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animations";

const principles = [
  { title: "Quality over speed", desc: "I prefer shipping fewer, well-crafted things over many rushed ones." },
  { title: "Ownership", desc: "From design system to deployment — I care about the whole product." },
  { title: "Clear communication", desc: "Code, PRs, docs — everything should be readable by humans." },
  { title: "Continuous learning", desc: "Currently deepening: distributed systems, Rust, and AI integration patterns." },
];

export function About() {
  return (
    <section id="about" className="section-padding divider">
      <div className="container-tight">
        <div className="mb-14">
          <span className="tag mb-4">About</span>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight mt-4">
            How I work
          </h2>
        </div>

        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mb-14"
        >
          <p className="text-lg leading-relaxed text-muted-foreground max-w-2xl mb-5">
            I'm a full-stack developer with 6+ years of experience building production web applications.
            I care deeply about the details — clean code, fast interfaces, and systems that are a pleasure
            to work with long-term.
          </p>
          <p className="text-lg leading-relaxed text-muted-foreground max-w-2xl">
            I work best in small, autonomous teams where I can take end-to-end ownership of features —
            from database schema to UI interactions. I believe good software comes from understanding
            the problem, not just the ticket.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {principles.map((p, i) => (
            <motion.div
              key={p.title}
              custom={i + 1}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              <h4 className="font-display text-lg mb-2">{p.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
