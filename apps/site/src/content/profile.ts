import { z } from "zod";

const year = z.number().int().min(1950).max(2100);
const period = z.strictObject({ from: year, to: year.optional(), ongoing: z.boolean().default(false) });

export const ProfileSchema = z.strictObject({
  /** One or two sentences, shown large. Empty until written. */
  headline: z.string().default(""),
  /** A short paragraph below the headline. */
  bio: z.string().default(""),
  experience: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        organization: z.string().optional(),
        location: z.string().optional(),
        summary: z.string().optional(),
        period,
      }),
    )
    .default([]),
  education: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        institution: z.string().optional(),
        location: z.string().optional(),
        note: z.string().optional(),
        period,
      }),
    )
    .default([]),
});

export type ProfileInput = z.input<typeof ProfileSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
type Period = z.infer<typeof period>;

export function formatYears({ from, to, ongoing }: Period): string {
  if (ongoing) return `${from}–Present`;
  return to && to !== from ? `${from}–${to}` : String(from);
}

/** Newest first; an ongoing entry counts as newest. */
export function byRecency<T extends { period: Period }>(entries: T[]): T[] {
  const end = ({ period: { from, to, ongoing } }: T) => (ongoing ? Number.MAX_SAFE_INTEGER : (to ?? from));
  return [...entries].sort((a, b) => end(b) - end(a) || b.period.from - a.period.from);
}

export function hasAbout(profile: Profile): boolean {
  return Boolean(profile.headline || profile.bio || profile.experience.length > 0);
}

export function hasEducation(profile: Profile): boolean {
  return profile.education.length > 0;
}
