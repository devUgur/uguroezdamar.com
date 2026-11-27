"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Origin of the portal of the same stage, for links into its admin views (board, organization). Set once per page. */
const PortalUrl = createContext("");

export function PortalUrlProvider({ value, children }: { value: string; children: ReactNode }) {
  return <PortalUrl.Provider value={value}>{children}</PortalUrl.Provider>;
}

export function usePortalUrl(): string {
  return useContext(PortalUrl);
}
