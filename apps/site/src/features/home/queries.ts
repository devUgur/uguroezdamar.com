import { getProfile, getCareerEntries } from "@ugur/server";

export type AboutProfileContent = {
  primaryText: string;
  secondaryText: string;
};

export type AboutTimelineEntry = {
  year: string;
  title: string;
  desc: string;
};

export type EducationTimelineEntry = {
  year: string;
  title: string;
  institution: string;
  location: string;
  status?: string;
};

const ABOUT_PROFILE_FALLBACK: AboutProfileContent = {
  primaryText:
    "I am a Software Developer with a strong academic background in Computer Science and several years of hands-on experience in building real-world software solutions. My work is driven by a passion for clean, maintainable code and modern software architectures. I approach development in a structured, solution-oriented way and continuously expand my technical skill set.",
  secondaryText: "",
};

const ABOUT_TIMELINE_FALLBACK: AboutTimelineEntry[] = [
  {
    year: "2027",
    title: "B.Sc. Informatik",
    desc: "FH Dortmund. Starting degree program after successful partner company placement.",
  },
  {
    year: "2026",
    title: "IT-Center Dortmund",
    desc: "B.Sc. IT- & Softwaresysteme. Dual study program initiated and currently in progress.",
  },
  {
    year: "2024–2025",
    title: "Fullstack Developer",
    desc: "Cherry Communication GmbH. Engineered project structures, developed scalable applications, and automated deployment pipelines (DevOps).",
  },
];

const EDUCATION_TIMELINE_FALLBACK: EducationTimelineEntry[] = [];

function toYearRange(startIso: string, endIso?: string | null, isCurrent?: boolean): string {
  const start = new Date(startIso);
  const startYear = Number.isNaN(start.getTime()) ? "" : String(start.getUTCFullYear());

  if (isCurrent) return startYear ? `${startYear}–Present` : "Present";
  if (!endIso) return startYear;

  const end = new Date(endIso);
  const endYear = Number.isNaN(end.getTime()) ? "" : String(end.getUTCFullYear());
  if (!endYear || endYear === startYear) return startYear;

  return `${startYear}–${endYear}`;
}

function parseYearSortValue(value: string): number {
  const lowered = value.toLowerCase();
  if (lowered.includes("present")) return Number.MAX_SAFE_INTEGER;

  const matches = value.match(/\d{4}/g);
  if (!matches || matches.length === 0) return 0;

  const year = Number(matches[matches.length - 1]);
  return Number.isNaN(year) ? 0 : year;
}

function uniqueKey(parts: Array<string | undefined | null>): string {
  return parts.map((part) => (part ?? "").trim().toLowerCase()).join("::");
}

function mergeAboutEntries(dbItems: AboutTimelineEntry[], fallback: AboutTimelineEntry[]): AboutTimelineEntry[] {
  if (dbItems.length > 0) return dbItems.slice(0, 4);

  const merged = [...dbItems];
  const seen = new Set(dbItems.map((item) => uniqueKey([item.year, item.title])));

  for (const item of fallback) {
    const key = uniqueKey([item.year, item.title]);
    if (!seen.has(key)) {
      merged.push(item);
      seen.add(key);
      if (merged.length >= 4) break;
    }
  }

  return merged.sort((a, b) => parseYearSortValue(b.year) - parseYearSortValue(a.year)).slice(0, 4);
}

function mergeEducationEntries(
  dbItems: EducationTimelineEntry[],
  fallback: EducationTimelineEntry[],
): EducationTimelineEntry[] {
  if (dbItems.length > 0) return dbItems;

  const merged = [...dbItems];
  const seen = new Set(dbItems.map((item) => uniqueKey([item.year, item.title, item.institution])));

  for (const item of fallback) {
    const key = uniqueKey([item.year, item.title, item.institution]);
    if (!seen.has(key)) {
      merged.push(item);
      seen.add(key);
    }
  }

  return merged.sort((a, b) => parseYearSortValue(b.year) - parseYearSortValue(a.year));
}

export async function getProfileForAbout(handle = "main"): Promise<AboutProfileContent> {
  try {
    const profile = await getProfile(handle);
    if (!profile) return ABOUT_PROFILE_FALLBACK;

    const primaryText = profile.headline?.trim() || ABOUT_PROFILE_FALLBACK.primaryText;
    const secondaryFromProfile = [profile.subheadline, profile.bio].filter(Boolean).join(" ").trim();
    const secondaryText = secondaryFromProfile || ABOUT_PROFILE_FALLBACK.secondaryText;

    return { primaryText, secondaryText };
  } catch {
    return ABOUT_PROFILE_FALLBACK;
  }
}

export async function getTimelineForAbout(): Promise<AboutTimelineEntry[]> {
  try {
    const items = await getCareerEntries({ status: "published", visibility: "about" });

    const mapped = items
      .map((item) => ({
        year: toYearRange(item.date.start, item.date.end, item.date.isCurrent),
        title: item.title,
        desc: item.summary?.trim() || [item.organization, item.location].filter(Boolean).join(" • "),
      }))
      .sort((a, b) => parseYearSortValue(b.year) - parseYearSortValue(a.year));

    return mergeAboutEntries(mapped, ABOUT_TIMELINE_FALLBACK);
  } catch {
    return ABOUT_TIMELINE_FALLBACK;
  }
}

export async function getTimelineForEducation(): Promise<EducationTimelineEntry[]> {
  try {
    const items = await getCareerEntries({
      type: "education",
      status: "published",
      visibility: "education",
    });

    const mapped = items
      .map((item) => ({
        year: toYearRange(item.date.start, item.date.end, item.date.isCurrent),
        title: item.title,
        institution: item.organization || "N/A",
        location: item.location ?? "",
        status: item.summary ?? undefined,
      }))
      .sort((a, b) => parseYearSortValue(b.year) - parseYearSortValue(a.year));

    return mergeEducationEntries(mapped, EDUCATION_TIMELINE_FALLBACK);
  } catch {
    return EDUCATION_TIMELINE_FALLBACK;
  }
}
