import React from "react";

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen py-12 md:py-24">{children}</div>;
}
