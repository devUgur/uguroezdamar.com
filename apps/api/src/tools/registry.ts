import { githubTools } from "./github.ts";
import { knowledgeTools } from "./knowledge.ts";
import { sandboxTools } from "./sandbox.ts";
import { verifyTools } from "./verify.ts";
import { workTools } from "./work.ts";
import { workspaceTools } from "./workspace.ts";
import type { Tool } from "./port.ts";

const ALL: Tool[] = [...githubTools, ...workspaceTools, ...knowledgeTools, ...sandboxTools, ...verifyTools, ...workTools];
const BY_NAME = new Map(ALL.map((tool) => [tool.spec.name, tool]));

export function toolsByName(names: readonly string[]): Tool[] {
  return names.map((name) => BY_NAME.get(name)).filter((tool): tool is Tool => Boolean(tool));
}

export function toolByName(name: string): Tool | undefined {
  return BY_NAME.get(name);
}
