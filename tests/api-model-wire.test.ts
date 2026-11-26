import { describe, expect, it, vi } from "vitest";
import { shortId } from "../apps/api/src/models/openai-compatible.ts";

describe("tool-call ids for Mistral models", () => {
  it("always yields nine letters or digits, the only form Mistral accepts", () => {
    for (const id of ["2873807_0", "call_1767000000000_0", "x", "call_a1b2c3d4-e5f6-7890-abcd-ef1234567890", ""]) {
      expect(shortId(id)).toMatch(/^[a-z0-9]{9}$/);
    }
  });

  it("maps equal ids to equal results and different ids apart, so a call still matches its result", () => {
    expect(shortId("call_1_0")).toBe(shortId("call_1_0"));
    const ids = Array.from({ length: 500 }, (_, index) => `call_${1_767_000_000_000 + index}_${index % 3}`);
    expect(new Set(ids.map(shortId)).size).toBe(ids.length);
  });
});

describe("warming up a Modal model", () => {
  it("sends a health request to the model's own endpoint and ignores the cut-off", async () => {
    const { ModelRouter } = await import("../apps/api/src/models/router.ts");
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => { urls.push(String(input)); throw new DOMException("aborted", "AbortError"); }));
    const env = { CONFIG: { get: async () => null }, MODAL_ENABLED: "true", MODAL_LLM_API_KEY: "k" } as unknown as import("../apps/api/src/env.ts").Env;
    const router = await ModelRouter.load(env);
    await expect(router.warmUp({ provider: "modal", model: "mistralai/Ministral-3-8B-Instruct-2512" })).resolves.toBeUndefined();
    expect(urls).toEqual(["https://ugur44ist--uguroezdamar-llm-ministral.us-east.modal.run/health"]);
    vi.unstubAllGlobals();
  });
});
