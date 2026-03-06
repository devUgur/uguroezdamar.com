import { describe, it, expect } from "vitest";
import { contactSchema, CreateProjectSchema } from "@ugur/server";

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

describe("CreateProjectSchema", () => {
  it("accepts minimal valid project", () => {
    const result = CreateProjectSchema.safeParse({
      slug: "my-app",
      title: "My App",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.featured).toBe(false);
    }
  });

  it("accepts full project with optional fields", () => {
    const result = CreateProjectSchema.safeParse({
      slug: "full-project",
      title: "Full Project",
      summary: "A summary",
      tags: ["react"],
      status: "published",
      featured: true,
      yearFrom: 2022,
      yearTo: 2024,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty slug", () => {
    const result = CreateProjectSchema.safeParse({
      slug: "",
      title: "Title",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL in coverImageUrl", () => {
    const result = CreateProjectSchema.safeParse({
      slug: "x",
      title: "Title",
      coverImageUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});
