import { describe, it, expect } from "vitest";
import { CreateCareerEntrySchema } from "@ugur/server";

describe("CreateCareerEntrySchema", () => {
  it("accepts minimal valid career entry", () => {
    const result = CreateCareerEntrySchema.safeParse({
      type: "work",
      slug: "acme-2024",
      title: "Software Engineer",
      organization: "Acme Inc",
      date: {
        start: "2024-01-01T00:00:00.000Z",
        end: null,
        isCurrent: true,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.isFeatured).toBe(false);
    }
  });

  it("accepts full career entry with optional fields", () => {
    const result = CreateCareerEntrySchema.safeParse({
      type: "education",
      slug: "msc-cs",
      title: "MSc Computer Science",
      organization: "University",
      location: "Berlin",
      date: { start: "2020-09-01T00:00:00.000Z", end: "2022-06-01T00:00:00.000Z", isCurrent: false },
      summary: "Focus on ML",
      highlights: ["Thesis", "TA"],
      tags: ["ml"],
      links: [{ label: "Program", url: "https://example.com" }],
      isFeatured: true,
      status: "published",
      degree: "MSc",
      field: "Computer Science",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty slug", () => {
    const result = CreateCareerEntrySchema.safeParse({
      type: "work",
      slug: "",
      title: "Engineer",
      date: { start: "2024-01-01T00:00:00.000Z" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = CreateCareerEntrySchema.safeParse({
      type: "invalid",
      slug: "x",
      title: "X",
      date: { start: "2024-01-01T00:00:00.000Z" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid link URL", () => {
    const result = CreateCareerEntrySchema.safeParse({
      type: "work",
      slug: "x",
      title: "X",
      date: { start: "2024-01-01T00:00:00.000Z" },
      links: [{ label: "Bad", url: "not-a-url" }],
    });
    expect(result.success).toBe(false);
  });
});
