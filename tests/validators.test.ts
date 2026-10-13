import { describe, it, expect } from "vitest";
import { contactSchema } from "@ugur/server";

describe("contactSchema", () => {
  it("accepts valid input", () => {
    const result = contactSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      message: "Hello",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nickname).toBeUndefined();
    }
  });

  it("rejects empty name", () => {
    const result = contactSchema.safeParse({
      name: "",
      email: "jane@example.com",
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = contactSchema.safeParse({
      name: "Jane",
      email: "not-an-email",
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when honeypot nickname is set", () => {
    const result = contactSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      message: "Hello",
      nickname: "spam",
    });
    expect(result.success).toBe(false);
  });
});
