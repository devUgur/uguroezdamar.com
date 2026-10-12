import "server-only";
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

function toYearRange(startIso: string, endIso?: string | null, isCurrent?: boolean): string {
  const start = new Date(startIso);
  const startYear = Number.isNaN(start.getTime()) ? "" : String(start.getUTCFullYear());
  if (isCurrent) return startYear ? `${startYear}–Present` : "Present";
  if (!endIso) return startYear;

  const end = new Date(endIso);
  const endYear = Number.isNaN(end.getTime()) ? "" : String(end.getUTCFullYear());
  return !endYear || endYear === startYear ? startYear : `${startYear}–${endYear}`;
}

function yearSortValue(value: string): number {
  if (value.toLowerCase().includes("present")) return Number.MAX_SAFE_INTEGER;
  const matches = value.match(/\d{4}/g);
  return matches?.length ? Number(matches[matches.length - 1]) : 0;
}

export async function getProfileForAbout(handle = "main"): Promise<AboutProfileContent> {
  try {
    const profile = await getProfile(handle);
    if (!profile) return { primaryText: "", secondaryText: "" };

    return {
      primaryText: profile.headline?.trim() ?? "",
      secondaryText: [profile.subheadline, profile.bio].filter(Boolean).join(" ").trim(),
    };
  } catch {
    console.error("Public profile could not be loaded.");
    return { primaryText: "", secondaryText: "" };
  }
}

export async function getTimelineForAbout(): Promise<AboutTimelineEntry[]> {
  try {
    const items = await getCareerEntries({ status: "published", visibility: "about" });
    return items
      .map((item) => ({
        year: toYearRange(item.date.start, item.date.end, item.date.isCurrent),
        title: item.title,
        desc: item.summary?.trim() || [item.organization, item.location].filter(Boolean).join(" • "),
      }))
      .sort((a, b) => yearSortValue(b.year) - yearSortValue(a.year))
      .slice(0, 4);
  } catch {
    console.error("Public career timeline could not be loaded.");
    return [];
  }
}

export async function getTimelineForEducation(): Promise<EducationTimelineEntry[]> {
  try {
    const items = await getCareerEntries({
      type: "education",
      status: "published",
      visibility: "education",
    });

    return items
      .map((item) => ({
        year: toYearRange(item.date.start, item.date.end, item.date.isCurrent),
        title: item.title,
        institution: item.organization || "N/A",
        location: item.location ?? "",
        status: item.summary ?? undefined,
      }))
      .sort((a, b) => yearSortValue(b.year) - yearSortValue(a.year));
  } catch {
    console.error("Public education timeline could not be loaded.");
    return [];
  }
}
