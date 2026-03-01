
export function About() {
  return (
    <section id="about" className="py-24 md:py-32 lg:py-40 px-6 md:px-12 lg:px-24 hairline-t">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8">
        <div className="lg:col-span-7">
          <p className="font-sans text-xl md:text-2xl leading-[1.6] md:leading-[1.8] text-foreground max-w-[680px]">
            My approach to software engineering is rooted in architectural principles.
            I believe that digital products should be built with intention, where every
            line of code serves a structural purpose. By stripping away the unnecessary,
            I create resilient, highly performant systems that scale gracefully.
            Currently focusing on the intersection of design engineering and backend infrastructure.
          </p>
        </div>

        <div className="lg:col-span-4 lg:col-start-9 relative">
          <div className="absolute left-[5px] top-2 bottom-2 w-[1px] bg-border/60"></div>
          <div className="space-y-14">
            {[
              { year: "2026", title: "Senior Design Engineer", desc: "Leading architectural frontend systems at Studio N." },
              { year: "2024", title: "Fullstack Developer", desc: "Built resilient microservices for fintech scaleups." },
              { year: "2022", title: "Frontend Architect", desc: "Established core UI foundations for global e-commerce." }
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
