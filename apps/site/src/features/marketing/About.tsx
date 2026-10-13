import Link from "next/link";

import profile from "@/content/profile";
import { byRecency, formatYears, hasAbout } from "@/src/content/profile";

interface AboutProps {
  /** Position on the home page, e.g. "03". */
  number?: string;
  /** On the home page an empty profile is left out; its own page says that nothing is published. */
  hideWhenEmpty?: boolean;
}

export function About({ number, hideWhenEmpty = false }: AboutProps) {
  if (hideWhenEmpty && !hasAbout(profile)) return null;
  const experience = byRecency(profile.experience);

  return (
    <section id="about" aria-labelledby="profile-heading" className="site-section">
      <div className="site-container">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-4">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground md:text-sm">
              {number ? (
                <>
                  {number} <span className="mx-2 text-border">/</span>{" "}
                </>
              ) : null}
              Profile
            </p>
            <h2 id="profile-heading" className="max-w-sm text-3xl leading-tight md:text-4xl">
              Engineering profile
            </h2>
            {number ? (
              <Link href="/about" className="link-underline mt-7 inline-flex min-h-11 items-center gap-3 font-mono text-xs uppercase tracking-[0.13em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                More about Ugur <span aria-hidden="true">↗</span>
              </Link>
            ) : null}
          </div>

          <div className="md:col-span-7 md:col-start-6">
            {profile.headline || profile.bio ? (
              <div className="max-w-3xl">
                {profile.headline ? <p className="text-xl leading-[1.55] md:text-2xl md:leading-[1.65]">{profile.headline}</p> : null}
                {profile.bio ? <p className="mt-6 text-base leading-7 text-muted-foreground md:mt-8 md:text-lg md:leading-8">{profile.bio}</p> : null}
              </div>
            ) : (
              <p className="border-y border-border py-6 text-sm leading-6 text-muted-foreground">
                Profile details have not been published yet.
              </p>
            )}

            {experience.length > 0 ? (
              <ol aria-label="Career experience" className="mt-10 border-t border-border md:mt-14">
                {experience.map((item) => (
                  <li key={`${item.period.from}-${item.title}`} className="grid grid-cols-1 gap-2 border-b border-border py-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6">
                    <span className="font-mono text-xs text-muted-foreground">{formatYears(item.period)}</span>
                    <div>
                      <h3 className="text-xl">{item.title}</h3>
                      {item.organization || item.location ? (
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {[item.organization, item.location].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      {item.summary ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.summary}</p> : null}
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

export default About;
