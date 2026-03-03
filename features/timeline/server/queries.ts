import { getTimelineItems } from "./mongo";

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

const EDUCATION_TIMELINE_FALLBACK: EducationTimelineEntry[] = [
  
];

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

function toSortTime(startIso: string, endIso?: string | null, isCurrent?: boolean) {
  if (isCurrent) return Number.MAX_SAFE_INTEGER;
  const end = endIso ? new Date(endIso).getTime() : Number.NaN;
  if (!Number.isNaN(end)) return end;
  const start = new Date(startIso).getTime();
  return Number.isNaN(start) ? 0 : start;
}

function parseYearSortValue(value: string): number {
  const lowered = value.toLowerCase();
  if (lowered.includes("present")) return Number.MAX_SAFE_INTEGER;
  const matches = value.match(/\d{4}/g);
  if (!matches || matches.length === 0) return 0;
  const year = Number(matches[matches.length - 1]);
  return Number.isNaN(year) ? 0 : year;
}

function uniqueKey(parts: Array<string | undefined | null>) {
  return parts.map((p) => (p ?? "").trim().toLowerCase()).join("::");
}

function mergeAboutEntries(dbItems: AboutTimelineEntry[], fallback: AboutTimelineEntry[]) {
  if (dbItems.length > 0) {
    return dbItems.slice(0, 4);
  }

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
  return merged
    .sort((a, b) => parseYearSortValue(b.year) - parseYearSortValue(a.year))
    .slice(0, 4);
}

function mergeEducationEntries(dbItems: EducationTimelineEntry[], fallback: EducationTimelineEntry[]) {
  if (dbItems.length > 0) {
    return dbItems;
  }

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

export async function getTimelineForAbout(): Promise<AboutTimelineEntry[]> {
  try {
    const items = await getTimelineItems({
      status: "published",
      limit: 100,
    });

    const mixed = items
      .sort((a, b) => toSortTime(b.startDate, b.endDate, b.isCurrent) - toSortTime(a.startDate, a.endDate, a.isCurrent))
      .slice(0, 4);

    const mapped = mixed.map((item) => ({
      year: toYearRange(item.startDate, item.endDate, item.isCurrent),
      title: item.title,
      desc:
        item.description?.trim() ||
        [item.organization, item.location].filter(Boolean).join(" • "),
    }))
      .sort((a, b) => parseYearSortValue(b.year) - parseYearSortValue(a.year));

    return mergeAboutEntries(mapped, ABOUT_TIMELINE_FALLBACK);
  } catch {
    return ABOUT_TIMELINE_FALLBACK;
  }
}

export async function getTimelineForEducation(): Promise<EducationTimelineEntry[]> {
  try {
    const items = await getTimelineItems({
      type: "education",
      status: "published",
      visibility: "education",
      limit: 50,
    });

    const mapped = items.map((item) => ({
      year: toYearRange(item.startDate, item.endDate, item.isCurrent),
      title: item.title,
      institution: item.organization,
      location: item.location ?? "",
      status: item.description ?? undefined,
    }))
      .sort((a, b) => parseYearSortValue(b.year) - parseYearSortValue(a.year));

    return mergeEducationEntries(mapped, EDUCATION_TIMELINE_FALLBACK);
  } catch {
    return EDUCATION_TIMELINE_FALLBACK;
  }
}
