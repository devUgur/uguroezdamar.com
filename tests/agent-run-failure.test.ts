import { describe, expect, it } from "vitest";
import { responseText } from "../apps/api/src/models/workers-ai.ts";
import { announcesUndoneWork } from "../apps/api/src/runtime/loop.ts";
import { latestRunFailure } from "../apps/portal/src/features/agents/ui/chat/runFailure.ts";
import type { AgentEvent } from "../apps/portal/src/features/agents/types.ts";

let id = 0;
const event = (type: string, data?: Record<string, unknown>): AgentEvent => ({ id: ++id, ts: id, type, threadId: "t", data });

describe("failed runs", () => {
  it("turns a JSON answer that Workers AI parsed into an object back into text", () => {
    expect(responseText({ verdict: "needs_human", findings: [] })).toBe('{"verdict":"needs_human","findings":[]}');
    expect(responseText("Hallo")).toBe("Hallo");
    expect(responseText(undefined)).toBeNull();
    expect(announcesUndoneWork({ verdict: "pass" })).toBe(false);
  });

  it("shows why the latest run gave no answer", () => {
    const failure = latestRunFailure([
      event("user_message", { text: "Hallo" }),
      event("thinking", { step: 1 }),
      event("error", { step: 1, message: "workers-ai: AiError: 4006: you have used up your daily free allocation of 10,000 neurons" }),
    ]);
    expect(failure?.title).toMatch(/Tageskontingent/);
  });

  it("shows nothing once a later run answered or a new message is pending", () => {
    expect(latestRunFailure([event("error", { message: "x" }), event("user_message"), event("message", { text: "ok" })])).toBeNull();
    expect(latestRunFailure([event("error", { message: "x" }), event("user_message")])).toBeNull();
  });
});

describe("failure of a private repository run", () => {
  it("says that the chosen provider is locked for private repositories", () => {
    const failure = latestRunFailure([
      event("user_message"),
      event("error", { message: 'All models for "chef-smart" failed. deepseek/deepseek-chat: gesperrt (strenge Datenrichtlinie, Anbieter wertet Daten aus) | anthropic/claude-sonnet-5-5: skipped (no credentials)' }),
    ]);
    expect(failure?.title).toMatch(/strenge Datenrichtlinie.*deepseek.*gesperrt/);
  });
});
