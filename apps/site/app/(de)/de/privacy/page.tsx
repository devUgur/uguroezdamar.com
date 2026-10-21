import type { Metadata } from "next";
import { PrivacyNotice } from "@/src/components/public/PrivacyNotice";

export const metadata: Metadata = {
  title: "Datenschutzhinweise",
  description: "Informationen zur Verarbeitung personenbezogener Daten auf dieser Portfolio-Website.",
  alternates: { canonical: "/de/privacy", languages: { en: "/privacy", de: "/de/privacy" } },
};

export default function GermanPrivacyPage() {
  return <PrivacyNotice locale="de" />;
}
