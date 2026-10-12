import { beforeAll, describe, expect, it } from "vitest";

const testMongoUri = process.env.TEST_MONGODB_URI;
process.env.CONTACT_RATE_LIMIT_SECRET ??= "test-only-contact-rate-limit-secret-32";
if (testMongoUri) {
  const parsed = new URL(testMongoUri);
  if (!new Set(["localhost", "127.0.0.1", "[::1]"]).has(parsed.hostname)) {
    throw new Error("TEST_MONGODB_URI must point to a local MongoDB instance.");
  }
  process.env.MONGODB_URI = testMongoUri;
}

describe("CMS project publication (MongoDB integration)", () => {
  let server: typeof import("@ugur/server");
  beforeAll(async () => { server = await import("@ugur/server"); });
  const integrationTest = testMongoUri ? it : it.skip;

  integrationTest("keeps drafts and secret projects private through publish and unpublish", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const draftSlug = `publication-draft-${suffix}`;
    const secretSlug = `publication-secret-${suffix}`;
    const publicSlug = `publication-public-${suffix}`;
    const created: string[] = [];

    try {
      const draft = await server.createProject({ slug: draftSlug, title: "Draft", status: "draft" });
      created.push(draft._id);
      const secret = await server.createProject({ slug: secretSlug, title: "Secret", status: "published", isSecret: true });
      created.push(secret._id);
      const canonicalInput = server.CreateProjectSchema.parse({ slug: publicSlug.toUpperCase(), title: "Public", status: "draft" });
      expect(canonicalInput.slug).toBe(publicSlug);
      const project = await server.createProject(canonicalInput);
      created.push(project._id);

      expect(await server.getProjectBySlugMongo(draftSlug, { publicOnly: true })).toBeNull();
      expect(await server.getProjectBySlugMongo(secretSlug, { publicOnly: true })).toBeNull();
      const initiallyPublic = await server.getProjects({ publicOnly: true });
      expect(initiallyPublic).not.toEqual(expect.arrayContaining([expect.objectContaining({ slug: draftSlug })]));
      expect(initiallyPublic).not.toEqual(expect.arrayContaining([expect.objectContaining({ slug: secretSlug })]));

      await server.updateProject(project._id, { status: "published" });
      expect(await server.getProjectBySlugMongo(publicSlug, { publicOnly: true })).toMatchObject({ status: "published" });
      expect(await server.getProjects({ publicOnly: true })).toEqual(expect.arrayContaining([
        expect.objectContaining({ slug: publicSlug, status: "published" }),
      ]));

      const sitemap = (await import("../apps/site/app/sitemap")).default;
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.NODE_ENV === "production" ? "https://uguroezdamar.com" : "http://localhost:3000");
      expect((await sitemap()).map((entry) => entry.url)).toContain(`${baseUrl}/projects/${publicSlug}`);

      await server.updateProject(project._id, { isSecret: true });
      expect(await server.getProjectBySlugMongo(publicSlug, { publicOnly: true })).toBeNull();
      await server.updateProject(project._id, { isSecret: false });

      await server.updateProject(project._id, { status: "draft" });
      expect(await server.getProjectBySlugMongo(publicSlug, { publicOnly: true })).toBeNull();
      expect(await server.getProjects({ publicOnly: true })).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ slug: publicSlug }),
      ]));
    } finally {
      await Promise.all(created.map((id) => server.softDeleteProject(id)));
    }
  });

  integrationTest("enforces the MongoDB-backed contact limit and resets each window", async () => {
    const address = `test-address-${Date.now()}-${Math.random()}`;
    const currentWindowStart = Math.floor(Date.now() / (10 * 60 * 1000)) * (10 * 60 * 1000);
    const firstWindow = new Date(currentWindowStart + 1000);
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(server.consumeContactRateLimit(address, firstWindow)).resolves.toMatchObject({ allowed: true });
    }
    await expect(server.consumeContactRateLimit(address, firstWindow)).resolves.toMatchObject({ allowed: false, remaining: 0 });

    const nextWindow = new Date(currentWindowStart + 10 * 60 * 1000 + 1000);
    await expect(server.consumeContactRateLimit(address, nextWindow)).resolves.toMatchObject({ allowed: true, remaining: 4 });

    const db = await server.getDb();
    const indexes = await db.collection("contact_rate_limits").listIndexes().toArray();
    expect(indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    ]));
  });

  integrationTest("counts simultaneous first requests atomically", async () => {
    const address = `race-address-${Date.now()}-${Math.random()}`;
    const now = new Date();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => server.consumeContactRateLimit(address, now)),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(5);
  });
});
