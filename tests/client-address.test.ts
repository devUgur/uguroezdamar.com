import { describe, expect, it } from "vitest";
import { clientAddress } from "../apps/site/src/lib/client-address";

const headers = (init: Record<string, string>) => new Headers(init);

describe("clientAddress", () => {
  it("trusts the address Cloudflare sets", () => {
    expect(clientAddress(headers({ "cf-connecting-ip": "198.51.100.7" }), "production")).toBe("198.51.100.7");
    expect(clientAddress(headers({ "cf-connecting-ip": "2001:db8::1" }), "production")).toBe("2001:db8::1");
  });

  it("ignores headers a caller can choose", () => {
    const spoofed = headers({ "x-forwarded-for": "203.0.113.9", "x-real-ip": "203.0.113.9", "x-nf-client-connection-ip": "203.0.113.9" });
    expect(clientAddress(spoofed, "production")).toBeNull();
  });

  it("rejects a value that is not one address", () => {
    expect(clientAddress(headers({ "cf-connecting-ip": "spoofed, 198.51.100.1" }), "production")).toBeNull();
    // A malformed header is never replaced by the development fallback.
    expect(clientAddress(headers({ "cf-connecting-ip": "nonsense" }), "development")).toBeNull();
  });

  it("falls back to loopback only on a local dev server", () => {
    expect(clientAddress(headers({}), "development")).toBe("127.0.0.1");
    expect(clientAddress(headers({}), "production")).toBeNull();
    expect(clientAddress(headers({}), "test")).toBeNull();
  });
});
