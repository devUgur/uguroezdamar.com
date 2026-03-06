import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateContactRequest = vi.fn();

vi.mock("@ugur/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ugur/server")>();
  return {
    ...actual,
    createContactRequest: (...args: unknown[]) => mockCreateContactRequest(...args),
  };
});

describe("POST /api/contact contract", () => {
  beforeEach(() => {
    mockCreateContactRequest.mockReset();
    mockCreateContactRequest.mockResolvedValue("test-id");
  });

  it("returns 400 and invalid input for invalid JSON", async () => {
    const { POST } = await import("../apps/site/app/api/contact/route");
    const res = await POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toEqual({ ok: false, error: "Invalid JSON" });
  });

  it("returns 400 and invalid input for invalid payload", async () => {
    const { POST } = await import("../apps/site/app/api/contact/route");
    const res = await POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: JSON.stringify({ name: "", email: "a@b.com", message: "hi" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toEqual({ ok: false, error: "Invalid input" });
  });

  it("returns 200 and ok true with id when valid and createContactRequest succeeds", async () => {
    const { POST } = await import("../apps/site/app/api/contact/route");
    const res = await POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: "Jane",
          email: "jane@example.com",
          message: "Hello",
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, id: "test-id" });
    expect(mockCreateContactRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Jane",
        email: "jane@example.com",
        message: "Hello",
      })
    );
  });

  it("returns 400 when honeypot nickname is set (schema rejects non-empty nickname)", async () => {
    const { POST } = await import("../apps/site/app/api/contact/route");
    const res = await POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: "Jane",
          email: "jane@example.com",
          message: "Hello",
          nickname: "spam",
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toEqual({ ok: false, error: "Invalid input" });
    expect(mockCreateContactRequest).not.toHaveBeenCalled();
  });
});
