import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { useTestDatabase } from "./_helpers/test-db";

describe("career and profile repositories (Postgres integration)", () => {
  let server: typeof import("@ugur/server");
  let close: () => Promise<void>;
  beforeAll(async () => {
    ({ server, close } = await useTestDatabase());
  });
  afterAll(() => close());

  it("returns an empty list from an empty database", async () => {
    expect(await server.getCareerEntries()).toEqual([]);
    expect(await server.getProfile()).toBeNull();
  });

  it("round-trips entries, filters by visibility and sorts newest first", async () => {
    const study = await server.createCareerEntry(
      server.CreateCareerEntrySchema.parse({
        type: "education",
        slug: "study",
        title: "Study",
        date: { start: "2018-10-01T00:00:00.000Z", end: "2022-03-31T00:00:00.000Z" },
        visibility: { education: true, career: false },
        status: "published",
      }),
    );
    await server.createCareerEntry(
      server.CreateCareerEntrySchema.parse({
        type: "work",
        slug: "job",
        title: "Job",
        date: { start: "2023-01-01T00:00:00.000Z", isCurrent: true },
        highlights: ["Built things"],
      }),
    );

    expect(study).toMatchObject({
      slug: "study",
      date: { start: "2018-10-01T00:00:00.000Z", end: "2022-03-31T00:00:00.000Z", isCurrent: false },
    });
    expect((await server.getCareerEntries()).map((entry) => entry.slug)).toEqual(["job", "study"]);
    expect((await server.getCareerEntries({ visibility: "education" })).map((entry) => entry.slug)).toEqual(["study"]);
    expect((await server.getCareerEntries({ type: "work", status: "draft" })).map((entry) => entry.slug)).toEqual(["job"]);
    expect(await server.getCareerEntryBySlug("job")).toMatchObject({ highlights: ["Built things"] });

    expect(await server.updateCareerEntry(study.id, { title: "Studies" })).toBe(true);
    expect(await server.getCareerEntryById(study.id)).toMatchObject({
      title: "Studies",
      date: { start: "2018-10-01T00:00:00.000Z" },
    });
    expect(await server.getCareerEntryById("not-a-uuid")).toBeNull();
    expect(await server.deleteCareerEntry(study.id)).toBe(true);
    expect(await server.deleteCareerEntry(study.id)).toBe(false);
  });

  it("creates and then updates the single profile row per handle", async () => {
    const created = await server.upsertProfile("main", { headline: "Hello", bio: "Bio" });
    const updated = await server.upsertProfile("main", {
      headline: "Hello again",
      bio: "Bio",
      links: { github: "https://github.com/example" },
    });
    expect(updated.id).toBe(created.id);
    expect(await server.getProfile()).toMatchObject({
      headline: "Hello again",
      links: { github: "https://github.com/example", linkedin: null, website: null },
    });
  });
});
