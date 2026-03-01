import React from "react";

export function Education() {
  const education = [
    { year: "2022", title: "MSc Computer Science", institution: "Technical University of Munich" },
    { year: "2020", title: "BSc Software Engineering", institution: "University of Stuttgart" },
    { year: "2019", title: "Design Systems Certificate", institution: "Nielsen Norman Group" },
  ];

  return (
    <section className="py-24 md:py-32 lg:py-40 px-6 md:px-12 lg:px-24 border-t border-border/40">
      <div className="mb-16 md:mb-24">
        <h2 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">03 — Education</h2>
      </div>

      <div className="max-w-4xl relative">
        <div className="absolute left-0 top-0 w-full h-[1px] bg-border/40"></div>
        {education.map((item, i) => (
          <div key={i} className="group relative grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 py-10 border-b border-border/40 transition-colors duration-500 hover:bg-surface/30 cursor-default px-6 md:px-8 -mx-6 md:-mx-8">
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent scale-y-0 group-hover:scale-y-100 origin-top transition-transform duration-500 ease-out"></div>
            <div className="font-mono text-sm text-secondary-foreground md:pt-1 group-hover:text-accent transition-colors duration-300">{item.year}</div>
            <div className="md:col-span-3 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
              <h3 className="font-serif text-xl md:text-2xl group-hover:text-foreground transition-colors duration-300">{item.title}</h3>
              <p className="font-sans text-muted-foreground text-sm group-hover:text-secondary-foreground transition-colors duration-300">{item.institution}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Education;
