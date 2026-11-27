"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { OfficeScope, ThreadProject } from "../../types";

/**
 * The office scope lives in the query (?project=<id>, none = the company). Switching uses the History API, which
 * Next.js syncs with useSearchParams: the URL is shareable, back and forward work, and no request reaches the server,
 * so the room and its 3D scene simply stay. An unknown id reads as the company level, without a redirect.
 */
export function useOfficeScope(projects: ThreadProject[]): [OfficeScope, (next: OfficeScope) => void] {
  const searchParams = useSearchParams();
  const requested = searchParams.get("project");
  const scope = requested && projects.some((project) => project.id === requested) ? requested : null;

  const setScope = useCallback((next: OfficeScope) => {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("project", next);
    else url.searchParams.delete("project");
    url.searchParams.delete("agent");
    window.history.pushState(null, "", `${url.pathname}${url.search}`);
  }, []);

  return [scope, setScope];
}
