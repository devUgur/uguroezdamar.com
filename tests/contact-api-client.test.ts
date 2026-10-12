import { describe, expect, it, vi } from "vitest";
import { submitContactRequest } from "../apps/site/src/features/contact/api";

describe("contact API client", () => {
  it("posts JSON to the same-origin route", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 }));
    const payload = { name: "Jane", email: "jane@example.com", message: "Hello", nickname: "" };

    await submitContactRequest(payload, fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });
});
