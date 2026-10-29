import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateContactRequest = vi.fn();
const mockConsumeContactRateLimit = vi.fn();
process.env.CONTACT_RATE_LIMIT_SECRET = "test-only-contact-rate-limit-secret-32";

vi.mock("@ugur/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ugur/server")>();
  return {
    ...actual,
    createContactRequest: (...args: unknown[]) => mockCreateContactRequest(...args),
    consumeContactRateLimit: (...args: unknown[]) => mockConsumeContactRateLimit(...args),
  };
});

describe("POST /api/contact contract", () => {
  beforeEach(() => {
    mockCreateContactRequest.mockReset();
    mockCreateContactRequest.mockResolvedValue("test-id");
    mockConsumeContactRateLimit.mockReset();
    mockConsumeContactRateLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 600 });
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
        headers: { "Content-Type": "application/json", "x-vercel-forwarded-for": "198.51.100.10" },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, id: "test-id", status: "saved" });
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

  it("rejects cross-origin browser requests", async () => {
    const { POST } = await import("../apps/site/app/api/contact/route");
    const res = await POST(new Request("https://site.example/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
      body: JSON.stringify({ name: "Jane", email: "jane@example.com", message: "Hello" }),
    }));
    expect(res.status).toBe(403);
    expect(mockCreateContactRequest).not.toHaveBeenCalled();
  });

  it("requires JSON content and rejects oversized declared bodies", async () => {
    const { POST } = await import("../apps/site/app/api/contact/route");
    const wrongType = await POST(new Request("https://site.example/api/contact", {
      method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}",
    }));
    expect(wrongType.status).toBe(415);

    const tooLarge = await POST(new Request("https://site.example/api/contact", {
      method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "20000" }, body: "{}",
    }));
    expect(tooLarge.status).toBe(413);
    expect(mockCreateContactRequest).not.toHaveBeenCalled();
  });

  it("returns an explicit storage failure when persistence fails", async () => {
    mockCreateContactRequest.mockRejectedValueOnce(new Error("database unavailable"));
    const { POST } = await import("../apps/site/app/api/contact/route");
    const res = await POST(new Request("https://site.example/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vercel-forwarded-for": "198.51.100.10" },
      body: JSON.stringify({ name: "Jane", email: "jane@example.com", message: "Hello" }),
    }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "Failed to save message" });
  });

  it("returns 429 and Retry-After when the shared rate limit is exhausted", async () => {
    mockConsumeContactRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 237 });
    const { POST } = await import("../apps/site/app/api/contact/route");
    const res = await POST(new Request("https://site.example/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vercel-forwarded-for": "198.51.100.11" },
      body: JSON.stringify({ name: "Jane", email: "jane@example.com", message: "Hello" }),
    }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("237");
    expect(mockCreateContactRequest).not.toHaveBeenCalled();
  });

  it("fails closed when the trusted proxy address is missing", async () => {
    const { POST } = await import("../apps/site/app/api/contact/route");
    const res = await POST(new Request("https://site.example/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Jane", email: "jane@example.com", message: "Hello" }),
    }));
    expect(res.status).toBe(503);
    expect(mockConsumeContactRateLimit).not.toHaveBeenCalled();
    expect(mockCreateContactRequest).not.toHaveBeenCalled();
  });

  it("fails closed when the trusted proxy address is malformed", async () => {
    const { POST } = await import("../apps/site/app/api/contact/route");
    const res = await POST(new Request("https://site.example/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vercel-forwarded-for": "spoofed, 198.51.100.1" },
      body: JSON.stringify({ name: "Jane", email: "jane@example.com", message: "Hello" }),
    }));
    expect(res.status).toBe(503);
    expect(mockConsumeContactRateLimit).not.toHaveBeenCalled();
  });

  it("fails closed when the shared rate-limit store is unavailable", async () => {
    mockConsumeContactRateLimit.mockRejectedValueOnce(new Error("store unavailable"));
    const { POST } = await import("../apps/site/app/api/contact/route");
    const res = await POST(new Request("https://site.example/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vercel-forwarded-for": "198.51.100.12" },
      body: JSON.stringify({ name: "Jane", email: "jane@example.com", message: "Hello" }),
    }));
    expect(res.status).toBe(503);
    expect(mockCreateContactRequest).not.toHaveBeenCalled();
  });

  it("supports standard form submission without JS via application/x-www-form-urlencoded and redirects with 303", async () => {
    const { POST } = await import("../apps/site/app/api/contact/route");
    const formData = new URLSearchParams({
      name: "Jane",
      email: "jane@example.com",
      message: "Hello via pure HTML form",
    });
    const res = await POST(
      new Request("https://uguroezdamar.com/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "x-vercel-forwarded-for": "198.51.100.10",
          Referer: "https://uguroezdamar.com/contact",
        },
        body: formData.toString(),
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("https://uguroezdamar.com/contact?sent=true");
    expect(mockCreateContactRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Jane",
        email: "jane@example.com",
        message: "Hello via pure HTML form",
      }),
    );
  });

  it("redirects with error parameter on invalid form data submission without JS", async () => {
    const { POST } = await import("../apps/site/app/api/contact/route");
    const formData = new URLSearchParams({
      name: "",
      email: "invalid-email",
      message: "",
    });
    const res = await POST(
      new Request("https://uguroezdamar.com/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://uguroezdamar.com/contact",
        },
        body: formData.toString(),
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toContain("error=invalid_input");
    expect(mockCreateContactRequest).not.toHaveBeenCalled();
  });
});
