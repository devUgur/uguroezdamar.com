import { describe, expect, it } from "vitest";
import { isValidBlogSlug, getPostBySlug } from "../apps/site/src/features/blog/queries";

describe("blog slug filesystem boundary", () => {
  it.each(["../secret", "%2e%2e%2fsecret", "post%2fsecret", "post\\secret", ".hidden", "UPPERCASE"])(
    "rejects malformed slug %s before filesystem access",
    async (slug) => {
      expect(isValidBlogSlug(slug)).toBe(false);
      await expect(getPostBySlug(slug)).resolves.toBeNull();
    },
  );

  it("accepts the canonical lowercase slug format", () => {
    expect(isValidBlogSlug("release-notes-2026")).toBe(true);
  });
});
