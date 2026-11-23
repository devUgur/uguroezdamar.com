import type { Metadata } from "next";
import { PrivacyNotice } from "@/src/components/public/PrivacyNotice";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "Information about data processing on the portfolio website.",
  alternates: { canonical: "/privacy", languages: { en: "/privacy", de: "/de/privacy" } },
};

export default function PrivacyPage() {
  return <PrivacyNotice locale="en" />;
}
