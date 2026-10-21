import type { Metadata } from "next";
import { ImprintNotice } from "@/src/components/public/ImprintNotice";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Anbieterangaben zur Portfolio-Website.",
  alternates: { canonical: "/de/imprint", languages: { en: "/imprint", de: "/de/imprint" } },
};

export default function GermanImprintPage() {
  return <ImprintNotice locale="de" />;
}
