import Link from "next/link";

import profile from "@/content/profile";
import { byRecency, formatYears, hasEducation } from "@/src/content/profile";

interface EducationProps {
  /** Position on the home page, e.g. "04". */
  number?: string;
  /** On the home page an empty list is left out; its own page says that nothing is published. */
  hideWhenEmpty?: boolean;
}

export function Education({ number, hideWhenEmpty = false }: EducationProps) {
  if (hideWhenEmpty && !hasEducation(profile)) return null;
  const education = byRecency(profile.education);

  return (
    <section id="education" aria-labelledby="education-heading" className="site-section">
      <div className="site-container">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-4">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground md:text-sm">
              {number ? (
                <>
                  {number} <span className="mx-2 text-border">/</span>{" "}
                </>
              ) : null}
              Education
            </p>
            <h2 id="education-heading" className="max-w-sm text-3xl leading-tight md:text-4xl">
              Learning and study
            </h2>
            {number ? (
              <Link href="/education" className="link-underline mt-7 inline-flex min-h-11 items-center gap-3 font-mono text-xs uppercase tracking-[0.13em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                Education details <span aria-hidden="true">↗</span>
              </Link>
            ) : null}
          </div>

          <div className="md:col-span-7 md:col-start-6">
            {education.length === 0 ? (
              <p className="border-y border-border py-6 text-sm leading-6 text-muted-foreground">
                No education entries have been published yet.
              </p>
            ) : (
              <ol className="border-t border-border">
                {education.map((item) => (
                  <li key={`${item.period.from}-${item.title}`} className="grid grid-cols-1 gap-2 border-b border-border py-6 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6 md:py-7">
                    <span className="font-mono text-xs text-muted-foreground">{formatYears(item.period)}</span>
                    <div>
                      <h3 className="text-xl md:text-2xl">{item.title}</h3>
                      {item.institution || item.location ? (
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {[item.institution, item.location].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      {item.note ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.note}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Education;
