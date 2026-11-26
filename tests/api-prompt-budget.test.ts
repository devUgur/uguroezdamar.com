import { describe, expect, it } from "vitest";
import { AGENTS } from "../apps/api/src/agents/registry.ts";
import { toolsByName } from "../apps/api/src/tools/registry.ts";

/**
 * Prompt and tool descriptions go into every model step. These limits keep them from growing back (plan stage 2,
 * measured 26.11.2026: chef 8,536 → 6,015 characters), and the rules below must survive any shortening.
 */
const fixedPart = (agentId: string) => {
  const agent = AGENTS[agentId]!;
  const prompt = agent.systemPrompt({ repo: "devUgur/example", projectName: "example", memories: [] });
  const specs = JSON.stringify(toolsByName(agent.tools).map((tool) => ({ type: "function", function: tool.spec })));
  return { prompt, size: prompt.length + specs.length };
};

describe("prompt budget", () => {
  it("keeps the chef's fixed part small", () => {
    // +sandbox_run and preview_deploy with the workstations (ADR 0036, 26.11.2026); sandbox_run → code_verify and the company scope.
    expect(fixedPart("chef").size).toBeLessThan(7_700);
    // +knowledge_search in stage 3 (26.11.2026): about 260 characters for the reviewer.
    expect(fixedPart("reviewer").size).toBeLessThan(5_200);
  });

  it("keeps every working rule of the chef", () => {
    const { prompt } = fixedPart("chef");
    for (const rule of ["AGENTS.md", "Freigabe", "mergst und deployst nie", "main ändert sich nur per Pull Request", "Secrets", "Nichts erfinden", "vollständigen neuen Inhalt", "projects_list", "github_repositories_list", "project_register", "repo_create", "ehrlich"]) {
      expect(prompt).toContain(rule);
    }
  });

  it("keeps the reviewer read-only and its untrusted-data rule", () => {
    const { prompt } = fixedPart("reviewer");
    expect(prompt).toContain("nicht vertrauenswürdige Daten");
    expect(prompt).toContain("ausschließlich lesende Werkzeuge");
  });
});
