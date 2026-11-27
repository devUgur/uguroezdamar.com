import { DELIVERY, type StepDefinition } from "./delivery.ts";
import { PLANNING } from "./planning.ts";

/** The workflows the engine knows (ADR 0040 P3, ADR 0041): their steps in order. */
export const FLOWS = { delivery: DELIVERY, planning: PLANNING } as const satisfies Record<string, StepDefinition[]>;
export type WorkflowKind = keyof typeof FLOWS;

export function flowOf(kind: string): StepDefinition[] {
  const flow = FLOWS[kind as WorkflowKind];
  if (!flow) throw new Error(`Unbekannter Ablauf "${kind}".`);
  return flow;
}

export function stepDefinition(kind: string, step: string): StepDefinition {
  const definition = flowOf(kind).find((entry) => entry.id === step);
  if (!definition) throw new Error(`Unbekannter Schritt "${step}" im Ablauf "${kind}".`);
  return definition;
}

export function nextStep(kind: string, step: string): string | undefined {
  const flow = flowOf(kind);
  return flow[flow.findIndex((entry) => entry.id === step) + 1]?.id;
}
