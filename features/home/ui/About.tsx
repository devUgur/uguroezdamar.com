
export function About() {
  return (
    <section id="about" className="py-24 md:py-32 lg:py-40 px-6 md:px-12 lg:px-24 hairline-t">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8">
        <div className="lg:col-span-7">
          <p className="font-sans text-xl md:text-2xl leading-[1.6] md:leading-[1.8] text-foreground max-w-[680px]">
            I am a Software Developer with a strong academic background in Computer Science and several years of hands-on experience in building real-world software solutions.
            My work is driven by a passion for clean, maintainable code and modern software architectures. I approach development in a structured, solution-oriented way and continuously expand my technical skill set.
          </p>
          <p className="mt-8 font-sans text-lg md:text-xl leading-relaxed text-muted-foreground max-w-[680px]">
            I am particularly interested in automation, artificial intelligence, and scalable systems that solve real problems.
            After studying Computer Science at TU Dortmund, I shifted my focus toward practical industry experience, working as a Full-Stack Developer and as a self-employed developer.
          </p>
        </div>

        <div className="lg:col-span-4 lg:col-start-9 relative">
          <div className="absolute left-[5px] top-2 bottom-2 w-[1px] bg-border/60"></div>
          <div className="space-y-14">
            {[
              { year: "2027", title: "B.Sc. Informatik", desc: "FH Dortmund. Starting degree program after successful partner company placement." },
              { year: "2026", title: "IT-Center Dortmund", desc: "B.Sc. IT- & Softwaresysteme. Dual study program initiated and currently in progress." },
              { year: "2024–2025", title: "Fullstack Developer", desc: "Cherry Communication GmbH. Engineered project structures, developed scalable applications, and automated deployment pipelines (DevOps)." },
            ].map((item, i) => (
              <div key={i} className="relative pl-10 group cursor-default">
                <div className="absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full bg-background border border-foreground/50 group-hover:bg-accent group-hover:border-accent group-hover:shadow-[0_0_8px_rgba(var(--accent),0.5)] transition-all duration-300"></div>
                <div className="font-mono text-sm text-muted-foreground mb-1.5 group-hover:text-accent transition-colors duration-300">{item.year}</div>
                <h3 className="font-serif text-2xl mb-2.5 group-hover:text-foreground transition-colors duration-300">{item.title}</h3>
                <p className="text-secondary-foreground text-sm leading-relaxed group-hover:text-secondary-foreground/90 transition-colors duration-300">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default About;
