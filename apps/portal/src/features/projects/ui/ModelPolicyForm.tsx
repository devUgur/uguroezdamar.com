import { Button } from "@ugur/ui";
import { setModelPolicy } from "../actions";
import type { Project } from "../types";

const OPTIONS = [
  {
    value: "strict",
    label: "Streng",
    text: "Nur Anbieter, deren API-Bedingungen eine Auswertung der Inhalte ausschließen: Claude, OpenAI, Workers AI, Modal und eigene Anbieter, die du so markiert hast.",
  },
  {
    value: "open",
    label: "Offen",
    text: "Alle Anbieter mit Schlüssel, auch solche, die Eingaben laut ihren Bedingungen zum Training nutzen dürfen (z. B. DeepSeek, Kimi, Gemini Free). Sinnvoll für eigene Repositories ohne Kundendaten oder Geheimnisse.",
  },
] as const;

/** The project's data policy: which model providers may see its content (ADR 0033). Only the owner changes it. */
export function ModelPolicyForm({ project }: { project: Project }) {
  const repositoryDefault = project.visibility === "private" ? "streng (privates Repository)" : "offen (öffentliches Repository)";
  return (
    <form action={setModelPolicy} className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <input type="hidden" name="projectId" value={project.id} />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm text-muted-foreground">
          Welche Modellanbieter dürfen den Inhalt dieses Repositories sehen? Ohne eigene Wahl gilt: {repositoryDefault}.
        </legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className="flex items-start gap-3 text-sm">
            <input type="radio" name="modelPolicy" value={option.value} defaultChecked={project.modelPolicy === option.value} className="mt-1 size-4" />
            <span>
              <span className="font-medium">{option.label}</span>
              <span className="block text-muted-foreground">{option.text}</span>
            </span>
          </label>
        ))}
        <label className="flex items-start gap-3 text-sm">
          <input type="radio" name="modelPolicy" value="" defaultChecked={!project.modelPolicyExplicit} className="mt-1 size-4" />
          <span>
            <span className="font-medium">Wie das Repository</span>
            <span className="block text-muted-foreground">Privat heißt streng, öffentlich heißt offen.</span>
          </span>
        </label>
      </fieldset>
      <p className="text-xs text-muted-foreground">
        Offene Anbieter erhalten Code und Gesprächsinhalte des Projekts. Secrets gibt kein Agent aus, aber Dateien mit Zugangsdaten im Repository wären für sie lesbar.
      </p>
      <Button type="submit" className="self-start">
        Richtlinie speichern
      </Button>
    </form>
  );
}
