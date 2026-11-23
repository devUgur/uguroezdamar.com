import Link from "next/link";

import profile from "@/content/profile";
import germanProfile from "@/content/profile.de";
import { byRecency, formatYears, hasAbout } from "@/src/content/profile";
import { type Locale } from "@/src/features/navigation/copy";

interface AboutProps {
  /** Position on the home page, e.g. "03". */
  number?: string;
  /** On the home page an empty profile is left out; its own page says that nothing is published. */
  hideWhenEmpty?: boolean;
  locale?: Locale;
}

export function About({ number, hideWhenEmpty = false, locale = "en" }: AboutProps) {
  const de = locale === "de";
  const localizedProfile = de ? germanProfile : profile;
  if (hideWhenEmpty && !hasAbout(localizedProfile)) return null;
  const experience = byRecency(localizedProfile.experience);

  if (!hasAbout(localizedProfile)) {
    return (
      <section id="about" className="site-container pb-16 md:pb-24" aria-label="Profile">
        <p className="max-w-xl border-y border-border py-5 text-sm leading-6 text-muted-foreground">
          {de ? "Es wurden noch keine Profilinformationen veröffentlicht." : "Profile details have not been published yet."}
        </p>
      </section>
    );
  }

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
              {de ? "Profil" : "Profile"}
            </p>
            <h2 id="profile-heading" className="max-w-sm text-3xl leading-tight md:text-4xl">
              {de ? "Profil und Erfahrung" : "Profile and experience"}
            </h2>
            {number ? (
              <Link href={de ? "/de/about" : "/about"} className="link-underline mt-7 inline-flex min-h-11 items-center gap-3 font-mono text-xs uppercase tracking-[0.13em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                {de ? "Mehr über Ugur" : "More about Ugur"} <span aria-hidden="true">↗</span>
              </Link>
            ) : null}
          </div>

          <div className="md:col-span-7 md:col-start-6">
            {localizedProfile.headline || localizedProfile.bio ? (
              <div className="max-w-3xl">
                {localizedProfile.headline ? <p className="text-xl leading-[1.55] md:text-2xl md:leading-[1.65]">{localizedProfile.headline}</p> : null}
                {localizedProfile.bio ? <p className="mt-6 text-base leading-7 text-muted-foreground md:mt-8 md:text-lg md:leading-8">{localizedProfile.bio}</p> : null}
              </div>
            ) : null}

            {experience.length > 0 ? (
              <ol aria-label={de ? "Berufserfahrung" : "Career experience"} className="editorial-list mt-10 md:mt-14">
                {experience.map((item) => (
                  <li key={`${item.period.from}-${item.title}`} className="grid grid-cols-1 gap-2 py-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6">
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
