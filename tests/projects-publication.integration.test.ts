import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { useTestDatabase } from "./_helpers/test-db";

describe("CMS project publication (Postgres integration)", () => {
  let server: typeof import("@ugur/server");
  let close: () => Promise<void>;
  beforeAll(async () => {
    ({ server, close } = await useTestDatabase());
  });
  afterAll(() => close());

  it("keeps drafts and secret projects private through publish and unpublish", async () => {
    const draftSlug = "publication-draft";
    const secretSlug = "publication-secret";
    const publicSlug = "publication-public";

    await server.createProject(server.CreateProjectSchema.parse({ slug: draftSlug, title: "Draft", status: "draft" }));
    await server.createProject(
      server.CreateProjectSchema.parse({ slug: secretSlug, title: "Secret", status: "published", isSecret: true }),
    );
    const canonicalInput = server.CreateProjectSchema.parse({ slug: publicSlug.toUpperCase(), title: "Public", status: "draft" });
    expect(canonicalInput.slug).toBe(publicSlug);
    const project = await server.createProject(canonicalInput);
    expect(project.id).toMatch(/^[0-9a-f-]{36}$/);

    expect(await server.getProjectBySlug(draftSlug, { publicOnly: true })).toBeNull();
    expect(await server.getProjectBySlug(secretSlug, { publicOnly: true })).toBeNull();
    expect(await server.getProjects({ publicOnly: true })).toEqual([]);

    expect(await server.updateProject(project.id, { status: "published" })).toBe(true);
    expect(await server.getProjectBySlug(publicSlug, { publicOnly: true })).toMatchObject({ status: "published" });
    const published = await server.getProjects({ publicOnly: true });
    expect(published.map((item) => item.slug)).toEqual([publicSlug]);
    expect(typeof published[0].publishedAt).toBe("string");

    await server.updateProject(project.id, { isSecret: true });
    expect(await server.getProjectBySlug(publicSlug, { publicOnly: true })).toBeNull();
    await server.updateProject(project.id, { isSecret: false });

    await server.updateProject(project.id, { status: "draft" });
    expect(await server.getProjectBySlug(publicSlug, { publicOnly: true })).toBeNull();
    expect(await server.getProjects({ publicOnly: true })).toEqual([]);
  });

  it("orders, reorders and soft-deletes projects", async () => {
    const first = await server.createProject(server.CreateProjectSchema.parse({ slug: "order-a", title: "A" }));
    const second = await server.createProject(server.CreateProjectSchema.parse({ slug: "order-b", title: "B" }));

    await server.reorderProjects([second.id, first.id]);
    const ordered = (await server.getProjects()).filter((item) => item.slug.startsWith("order-"));
    expect(ordered.map((item) => item.slug)).toEqual(["order-b", "order-a"]);

    expect(await server.softDeleteProject(first.id)).toBe(true);
    expect(await server.getProjectById(first.id)).toBeNull();
    expect(await server.getProjectBySlug("order-a")).toBeNull();
  });

  it("treats malformed ids as not found instead of failing", async () => {
    expect(await server.getProjectById("not-a-uuid")).toBeNull();
    expect(await server.updateProject("not-a-uuid", { title: "x" })).toBe(false);
    expect(await server.softDeleteProject("507f1f77bcf86cd799439011")).toBe(false);
  });

  it("rejects a duplicate slug", async () => {
    await server.createProject(server.CreateProjectSchema.parse({ slug: "unique-slug", title: "One" }));
    await expect(
      server.createProject(server.CreateProjectSchema.parse({ slug: "unique-slug", title: "Two" })),
    ).rejects.toThrow();
  });

  it("enforces the contact limit and resets each window", async () => {
    const address = "203.0.113.10";
    const currentWindowStart = Math.floor(Date.now() / (10 * 60 * 1000)) * (10 * 60 * 1000);
    const firstWindow = new Date(currentWindowStart + 1000);
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(server.consumeContactRateLimit(address, firstWindow)).resolves.toMatchObject({ allowed: true });
    }
    await expect(server.consumeContactRateLimit(address, firstWindow)).resolves.toMatchObject({ allowed: false, remaining: 0 });

    const nextWindow = new Date(currentWindowStart + 10 * 60 * 1000 + 1000);
    await expect(server.consumeContactRateLimit(address, nextWindow)).resolves.toMatchObject({ allowed: true, remaining: 4 });
  });

  it("removes rate-limit buckets after their retention window", async () => {
    const longAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await server.consumeContactRateLimit("203.0.113.20", longAgo);
    await server.consumeContactRateLimit("203.0.113.21");
    const rows = await server.getDb().select().from(server.schema.contactRateLimits);
    expect(rows.every((row) => row.expiresAt.getTime() > Date.now())).toBe(true);
  });

  it("counts simultaneous first requests atomically", async () => {
    const now = new Date();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => server.consumeContactRateLimit("203.0.113.30", now)),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(5);
  });

  it("stores contact requests and pages and searches them safely", async () => {
    const ids: string[] = [];
    for (const name of ["Ada", "Grace", "100%_real"]) {
      ids.push(await server.createContactRequest({ name, email: `${name.toLowerCase()}@example.com`, message: "Hello" }));
    }
    const firstPage = await server.listContactRequests({ limit: 2 });
    expect(firstPage.items.map((item) => item.name)).toEqual(["100%_real", "Grace"]);
    const secondPage = await server.listContactRequests({ limit: 2, cursor: firstPage.nextCursor ?? undefined });
    expect(secondPage.items.map((item) => item.name)).toEqual(["Ada"]);

    expect((await server.listContactRequests({ q: "grace" })).items).toHaveLength(1);
    // Wildcards in the search term are literals, not patterns.
    expect((await server.listContactRequests({ q: "%" })).items.map((item) => item.name)).toEqual(["100%_real"]);
    expect(await server.countContactRequests()).toBe(3);
  });
});
