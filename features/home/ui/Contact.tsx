import React from "react";
import { ArrowUpRight } from "lucide-react";

export function Contact() {
  return (
    <section id="contact" className="py-32 md:py-40 lg:py-56 px-6 md:px-12 lg:px-24 border-t border-border/40 flex flex-col items-center justify-center text-center">
      <h2 className="font-serif text-4xl md:text-5xl lg:text-7xl mb-16 tracking-tight group cursor-default">
        Let’s build something <span className="text-accent italic transition-all duration-500">meaningful.</span>
      </h2>

      <div className="flex flex-col md:flex-row gap-8 md:gap-16 font-mono text-sm uppercase tracking-widest text-secondary-foreground">
        <a href="mailto:hello@uguroezdamar.com" className="inline-flex items-center gap-2 group hover:text-accent hover:-translate-y-1 transition-all duration-300">
          Email <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
        </a>
        <a href="https://www.linkedin.com/in/uguroezdamar" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 group hover:text-accent hover:-translate-y-1 transition-all duration-300">
          LinkedIn <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
        </a>
        <a href="https://github.com/devUgur" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 group hover:text-accent hover:-translate-y-1 transition-all duration-300">
          GitHub <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
        </a>
      </div>
    </section>
  );
}

export default Contact;
