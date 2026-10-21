import { secretValues } from "../lib/infisical.ts";

type Check = { name: string; ok: boolean; detail?: string };

export interface SmokeOptions {
  site?: string;
  portal?: string;
  /** The commit the deployment must report, full or abbreviated. */
  commit?: string;
}

interface Health {
  ok?: boolean;
  app?: string;
  commit?: string | null;
  database?: string;
  client?: string | null;
}

interface HealthResult {
  report: Health | null;
  detail?: string;
}

const TIMEOUT_MS = 30_000;
/** An address from a documentation range: no real client has it, so it can only come from us. */
const FORGED_ADDRESS = "203.0.113.250";
/** Case studies that this portfolio release promises to publish. Keep routes and covers in the smoke gate. */
const PUBLIC_PROJECTS = [
  { slug: "viralsync", title: "ViralSync", cover: "/projects/viralsync/calendar-month-light.webp", live: "https://viralsync.io" },
  { slug: "video-lab", title: "Video Lab", cover: "/projects/video-lab/golden-recipe-contact-sheet.webp", live: undefined },
] as const;

/** Per origin: the header that lets this run through Vercel's deployment protection. */
const bypass = new Map<string, string>();

async function request(url: string, init: RequestInit = {}): Promise<Response | Error> {
  const secret = bypass.get(new URL(url).origin);
  const headers = { ...(init.headers as Record<string, string> | undefined), ...(secret ? { "x-vercel-protection-bypass": secret } : {}) };
  try {
    return await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), ...init, headers });
  } catch (error) {
    return error as Error;
  }
}

async function status(name: string, url: string, expected: number, init?: RequestInit): Promise<Check> {
  const response = await request(url, init);
  if (response instanceof Error) return { name, ok: false, detail: response.message };
  return { name, ok: response.status === expected, detail: `HTTP ${response.status}, expected ${expected}` };
}

async function health(origin: string, headers?: Record<string, string>): Promise<HealthResult> {
  const response = await request(`${origin}/api/health`, { headers });
  if (response instanceof Error) return { report: null, detail: response.message };
  if (!response.ok) return { report: null, detail: `HTTP ${response.status}` };
  const report = (await response.json().catch(() => null)) as Health | null;
  return report ? { report } : { report: null, detail: `HTTP ${response.status}, response was not JSON` };
}

function healthChecks(app: string, result: HealthResult, commit?: string, local = false): Check[] {
  const { report } = result;
  if (!report) return [{ name: `${app}: /api/health answers`, ok: false, detail: result.detail ?? "no JSON answer" }];
  const deployed = report.commit ?? "";
  return [
    { name: `${app}: /api/health answers`, ok: report.ok === true && report.app === app },
    { name: `${app}: database reachable`, ok: report.database === "ok", detail: `database: ${report.database}` },
    commit
      ? { name: `${app}: serves commit ${commit.slice(0, 7)}`, ok: deployed.startsWith(commit), detail: `serves ${deployed || "an unknown commit"}` }
      : { name: `${app}: reports its commit`, ok: deployed.length >= 7 || local, detail: deployed ? `serves ${deployed.slice(0, 7)}` : "no commit reported" },
  ];
}

/** A local production build has no hosting proxy in front of it and no deploy commit. */
const isLocal = (url: string) => ["localhost", "127.0.0.1"].includes(new URL(url).hostname);

const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

async function smokeSite(origin: string, commit?: string): Promise<Check[]> {
  const healthResult = await health(origin);
  const report = healthResult.report;
  const forged = await health(origin, { "x-vercel-forwarded-for": FORGED_ADDRESS, "x-forwarded-for": FORGED_ADDRESS, "x-real-ip": FORGED_ADDRESS });
  const sitemap = await request(`${origin}/sitemap.xml`);
  const sitemapText = sitemap instanceof Error ? "" : await sitemap.text();
  const catalog = await request(`${origin}/projects`);
  const catalogText = catalog instanceof Error ? "" : await catalog.text();
  const contact = `${origin}/api/contact`;
  const forgedClient = forged.report?.client;

  // Only the hosting proxy sets the client address; a local server has none in front of it.
  const proxied = !isLocal(origin);
  const addressChecks: Check[] = proxied
    ? [
        // The contact rate limit keys on this address; without it the form answers 503.
        { name: "site: sees a client address", ok: Boolean(report?.client), detail: "x-vercel-forwarded-for did not reach the app" },
        {
          name: "site: a client cannot choose its address",
          ok: Boolean(forgedClient) && forgedClient !== FORGED_ADDRESS,
          detail: forgedClient === FORGED_ADDRESS ? "a forged address header was accepted" : "no address seen",
        },
      ]
    : [];

  const projectChecks = await Promise.all(PUBLIC_PROJECTS.flatMap(async (project) => {
    const path = `/projects/${project.slug}`;
    const url = `${origin}${path}`;
    const canonicalUrls = (isLocal(origin) ? [origin, "https://uguroezdamar.com"] : ["https://uguroezdamar.com"])
      .map((canonicalOrigin) => `${canonicalOrigin}${path}`);
    const page = await request(url);
    const html = page instanceof Error ? "" : await page.text();
    const title = new RegExp(`<title[^>]*>[^<]*${project.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^<]*</title>`, "i");
    const canonical = (html.match(/<link\b[^>]*>/gi) ?? []).some((tag) =>
      /rel=["']canonical["']/i.test(tag) && canonicalUrls.some((canonicalUrl) => tag.includes(`href="${canonicalUrl}"`)),
    );
    const sitemapHasProject = Array.from(sitemapText.matchAll(/<loc>(.*?)<\/loc>/gi)).some(([, location]) => {
      if (!location) return false;
      try {
        const sitemapUrl = new URL(location);
        const allowedHost = sitemapUrl.hostname === "uguroezdamar.com" || sitemapUrl.hostname.endsWith(".vercel.app");
        return (sitemapUrl.protocol === "https:" && allowedHost || isLocal(origin) && sitemapUrl.origin === origin) && sitemapUrl.pathname === path;
      } catch {
        return false;
      }
    });
    const cover = await request(`${origin}${project.cover}`, { method: "HEAD" });
    const checks: Check[] = [
      { name: `site: ${project.title} card is published`, ok: catalogText.includes(project.title), detail: `missing ${project.title} in /projects` },
      { name: `site: ${project.title} is in sitemap`, ok: sitemapHasProject, detail: `missing public sitemap route ${path}` },
      { name: `site: ${project.title} case study answers`, ok: !(page instanceof Error) && page.status === 200 && title.test(html), detail: page instanceof Error ? page.message : `HTTP ${page.status}, expected page title ${project.title}` },
      { name: `site: ${project.title} has canonical URL`, ok: canonical, detail: `missing canonical URL for ${project.slug}` },
      { name: `site: ${project.title} cover is served`, ok: !(cover instanceof Error) && cover.status === 200, detail: cover instanceof Error ? cover.message : `HTTP ${cover.status}, expected 200` },
    ];
    if (project.live && !isLocal(origin)) {
      const live = await request(project.live);
      checks.push({ name: `site: ${project.title} project link answers`, ok: !(live instanceof Error) && live.status >= 200 && live.status < 400, detail: live instanceof Error ? live.message : `HTTP ${live.status}, expected 2xx or 3xx` });
    }
    return checks;
  })).then((groups) => groups.flat());

  return [
    ...healthChecks("site", healthResult, commit, !proxied),
    ...addressChecks,
    await status("site: home page", `${origin}/`, 200),
    { name: "site: project catalog", ok: !(catalog instanceof Error) && catalog.status === 200, detail: catalog instanceof Error ? catalog.message : `HTTP ${catalog.status}, expected 200` },
    await status("site: /work redirects", `${origin}/work`, 308),
    { name: "site: sitemap lists the catalog", ok: sitemapText.includes("/projects"), detail: "no /projects entry" },
    ...projectChecks,
    await status("site: contact refuses a wrong content type", contact, 415, { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" }),
    await status("site: contact refuses another origin", contact, 403, json({}, { origin: "https://attacker.example" })),
    await status("site: contact refuses invalid input", contact, 400, json({ name: "" })),
    // A filled honeypot field fails validation, so nothing is stored.
    await status("site: contact refuses a filled honeypot", contact, 400, json({ name: "Smoke", email: "smoke@example.com", message: "Smoke test.", nickname: "bot" })),
  ];
}

async function smokePortal(origin: string, commit?: string): Promise<Check[]> {
  const healthResult = await health(origin);
  return [
    ...healthChecks("portal", healthResult, commit, isLocal(origin)),
    await status("portal: login page", `${origin}/login`, 200),
    await status("portal: admin API refuses anonymous callers", `${origin}/api/admins`, 401),
    await status("portal: invite API refuses anonymous callers", `${origin}/api/admins/invites`, 401, json({})),
  ];
}

const origin = (url: string) => new URL(url).origin;

/**
 * Checks a deployed site and portal over HTTP: that they serve the expected commit, reach the
 * database, see the real client address and refuse what they must. It stores nothing.
 */
export async function smoke({ site, portal, commit }: SmokeOptions): Promise<number> {
  if (!site && !portal) {
    console.error("Usage: pnpm ugur smoke --site <url> [--portal <url>] [--commit <sha>]");
    return 1;
  }
  // Previews are protected by default. The bypass secrets come from Infisical `dev`, in memory;
  // without them a protected preview answers 401 and the checks say so.
  for (const [url, key] of [[site, "VERCEL_BYPASS_SITE"], [portal, "VERCEL_BYPASS_PORTAL"]] as const) {
    if (!url || isLocal(url)) continue;
    const secret = secretValues("dev", [key])?.[key];
    if (secret) bypass.set(origin(url), secret);
  }

  const checks = [
    ...(site ? await smokeSite(origin(site), commit) : []),
    ...(portal ? await smokePortal(origin(portal), commit) : []),
  ];
  for (const check of checks) {
    console.log(`${check.ok ? "✓" : "✗"} ${check.name}${check.ok || !check.detail ? "" : ` — ${check.detail}`}`);
  }
  const failed = checks.filter((check) => !check.ok).length;
  console.log(failed === 0 ? `\nAll ${checks.length} checks passed.` : `\n${failed} of ${checks.length} checks failed.`);
  return failed === 0 ? 0 : 1;
}
