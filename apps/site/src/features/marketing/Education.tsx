import React from "react";
import { getTimelineForEducation } from "@/src/server/home";

export async function Education() {
  const education = await getTimelineForEducation();

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
              <div>
                <h3 className="font-serif text-xl md:text-2xl group-hover:text-foreground transition-colors duration-300">{item.title}</h3>
                <p className="font-sans text-muted-foreground text-sm group-hover:text-secondary-foreground transition-colors duration-300">
                  {item.location ? `${item.institution} — ${item.location}` : item.institution}
                </p>
                {item.status && (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-accent opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all duration-500 ease-out flex items-center gap-2">
                    <span className="w-2 h-[1px] bg-accent"></span>
                    {item.status}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Education;
