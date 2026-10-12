import { ContactForm } from "@/src/features/contact";
import { ArrowUpRight, Mail } from "lucide-react";

export const runtime = "nodejs";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-16 md:py-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        {/* Left Column: Direct info & context */}
        <div className="lg:col-span-5 space-y-8">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
              Direct Contact
            </div>
            <h1 className="font-serif text-[clamp(2.5rem,5vw+0.5rem,4rem)] leading-tight tracking-tight text-foreground mb-4">
              Get in touch
            </h1>
            <p className="font-sans text-base md:text-lg leading-relaxed text-muted-foreground">
              For a question or a message about software work, send a message here or use the listed email address.
            </p>
          </div>

          <div className="border-t border-border/60 pt-6 space-y-4 font-mono text-xs text-muted-foreground">
            <div>
              <span className="text-foreground/80 font-medium uppercase tracking-wider block mb-1">
                Direct Email:
              </span>
              <a
                href="mailto:ugur.oezdamar@itc-studenten.de"
                className="text-foreground hover:underline inline-flex items-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                ugur.oezdamar@itc-studenten.de
              </a>
            </div>

            <div>
              <span className="text-foreground/80 font-medium uppercase tracking-wider block mb-1">
                Location:
              </span>
              <span>Dortmund, Germany</span>
            </div>

            <div>
              <span className="text-foreground/80 font-medium uppercase tracking-wider block mb-1">
                Profiles:
              </span>
              <div className="flex items-center gap-4 pt-1">
                <a
                  href="https://github.com/devUgur"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:underline inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  GitHub
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Form */}
        <div className="lg:col-span-7">
          <div className="rounded-lg border border-border/80 bg-surface/30 p-8 shadow-xs">
            <h2 className="font-serif text-2xl text-foreground font-medium mb-6">
              Send a Message
            </h2>
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
