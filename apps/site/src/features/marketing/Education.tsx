import Link from "next/link";

import profile from "@/content/profile";
import germanProfile from "@/content/profile.de";
import { byRecency, formatYears, hasEducation } from "@/src/content/profile";
import { type Locale } from "@/src/features/navigation/copy";

interface EducationProps {
  /** Position on the home page, e.g. "04". */
  number?: string;
  /** On the home page an empty list is left out; its own page says that nothing is published. */
  hideWhenEmpty?: boolean;
  locale?: Locale;
}

export function Education({ number, hideWhenEmpty = false, locale = "en" }: EducationProps) {
  const de = locale === "de";
  const localizedProfile = de ? germanProfile : profile;
  if (hideWhenEmpty && !hasEducation(localizedProfile)) return null;
  const education = byRecency(localizedProfile.education);

  if (!hasEducation(localizedProfile)) {
    return (
      <section id="education" className="site-container pb-16 md:pb-24" aria-label="Education">
        <p className="max-w-xl border-y border-border py-5 text-sm leading-6 text-muted-foreground">
          {de ? "Es wurden noch keine Ausbildungsstationen veröffentlicht." : "No education entries have been published yet."}
        </p>
      </section>
    );
  }

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
              {de ? "Ausbildung" : "Education"}
            </p>
            <h2 id="education-heading" className="max-w-sm text-3xl leading-tight md:text-4xl">
              {de ? "Lernen und Ausbildung" : "Learning and education"}
            </h2>
            {number ? (
              <Link href={de ? "/de/education" : "/education"} className="link-underline mt-7 inline-flex min-h-11 items-center gap-3 font-mono text-xs uppercase tracking-[0.13em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                {de ? "Details zur Ausbildung" : "Education details"} <span aria-hidden="true">↗</span>
              </Link>
            ) : null}
          </div>

          <div className="md:col-span-7 md:col-start-6">
            {education.length > 0 ? (
              <ol className="editorial-list">
                {education.map((item) => (
                  <li key={`${item.period.from}-${item.title}`} className="grid grid-cols-1 gap-2 py-6 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6 md:py-7">
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
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Education;
