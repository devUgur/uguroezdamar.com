import { ContactForm } from "@/src/features/contact";
import { ArrowUpRight, Mail } from "lucide-react";
import { PageIntro } from "@/src/components/public/PageIntro";
import type { Metadata } from "next";

export const runtime = "nodejs";
export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact", languages: { en: "/contact", de: "/de/contact" } } };

export default function ContactPage() {
  return (
    <div className="site-container py-16 md:py-24">
      <PageIntro section="Direct contact" title="Get in touch" description="For a question or a message about software work, send a message here or use the listed email address." />
      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16 items-start">
        {/* Left Column: Direct info & context */}
        <div className="lg:col-span-5 space-y-8">
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
          <div className="border-t border-border pt-6">
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
