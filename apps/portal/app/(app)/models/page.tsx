import type { Metadata } from "next";
import { getModelSettings, ModelSettingsView } from "@/src/features/models";

export const metadata: Metadata = { title: "Modelle & Schlüssel" };

type Param = string | string[] | undefined;
const first = (value: Param): string | undefined => (Array.isArray(value) ? value[0] : value);

export default async function ModelsPage({ searchParams }: { searchParams: Promise<{ notice?: Param; error?: Param }> }) {
  const [params, settings] = await Promise.all([searchParams, getModelSettings()]);
  return <ModelSettingsView settings={settings} notice={first(params.notice)} error={first(params.error)} />;
}
