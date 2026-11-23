import type { Metadata } from "next";
import { ImprintNotice } from "@/src/components/public/ImprintNotice";

export const metadata: Metadata = {
  title: "Imprint",
  description: "Provider information for the portfolio website.",
  alternates: { canonical: "/imprint", languages: { en: "/imprint", de: "/de/imprint" } },
};

export default function ImprintPage() {
  return <ImprintNotice locale="en" />;
}
