import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appJwt, installationToken, toPkcs8 } from "../apps/api/src/github/app.ts";
import { githubStatus, githubToken } from "../apps/api/src/github/credentials.ts";
import { listRepositories } from "../apps/api/src/projects/repositories.ts";
import type { Env } from "../apps/api/src/env.ts";

const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pkcs1 = pair.privateKey.export({ type: "pkcs1", format: "pem" }).toString();
const pkcs8 = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();

function kv() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => void store.set(key, value),
  };
}

function envWith(extra: Record<string, unknown> = {}) {
  const config = kv();
  const env = {
    CONFIG: config,
    DB: { prepare: () => ({ all: async () => ({ results: [] }) }) },
    AGENT_GH_APP_ID: "123",
    AGENT_GH_APP_PRIVATE_KEY: pkcs1,
    GITHUB_OWNERS: "devUgur",
    ...extra,
  } as unknown as Env;
  return { env, config };
}

interface Call {
  method: string;
  url: string;
  authorization: string;
}

/** Plays GitHub: the app is installed on devUgur only; installation repositories and the personal listing differ. */
function stubGithub() {
  const calls: Call[] = [];
  const expires = new Date(Date.now() + 3_600_000).toISOString();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ method: init?.method ?? "GET", url, authorization: headers.authorization ?? "" });
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
      if (url.includes("/app/installations?")) return json([{ id: 7, account: { login: "devUgur" }, repository_selection: "all" }]);
      if (url.endsWith("/app/installations/7/access_tokens")) return json({ token: "ghs_install", expires_at: expires });
      const repo = (full: string) => ({ full_name: full, name: full.split("/")[1], owner: { login: full.split("/")[0] }, private: true, default_branch: "main", archived: false, fork: false, description: null, pushed_at: null });
      if (url.includes("/installation/repositories")) return json({ repositories: [repo("devUgur/a"), repo("devUgur/b")] });
      if (url.includes("/user/repos")) return json([repo("devUgur/b"), repo("devUgur/c")]);
      return json({});
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("GitHub App sign-in", () => {
  it("wraps the PKCS#1 key GitHub hands out into the PKCS#8 form WebCrypto reads, and leaves PKCS#8 alone", () => {
    const expected = pair.privateKey.export({ type: "pkcs8", format: "der" });
    expect(Buffer.from(toPkcs8(pkcs1)).equals(expected)).toBe(true);
    expect(Buffer.from(toPkcs8(pkcs8)).equals(expected)).toBe(true);
    expect(Buffer.from(toPkcs8(pkcs1.replace(/\n/g, "\\n"))).equals(expected)).toBe(true);
  });

  it("signs a JWT that GitHub can verify with the app's public key, valid for under ten minutes", async () => {
    const { env } = envWith();
    const now = 1_800_000_000;
    const [header, claims, signature] = (await appJwt(env, now)).split(".") as [string, string, string];
    const verify = createVerify("RSA-SHA256");
    verify.update(`${header}.${claims}`);
    expect(verify.verify(pair.publicKey, Buffer.from(signature, "base64url"))).toBe(true);
    const payload = JSON.parse(Buffer.from(claims, "base64url").toString()) as { iss: string; iat: number; exp: number };
    expect(payload.iss).toBe("123");
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(600);
  });

  it("fetches an installation token once and serves the next calls from the cache", async () => {
    const calls = stubGithub();
    const { env } = envWith();
    expect(await installationToken(env, "devUgur")).toBe("ghs_install");
    const used = calls.length;
    expect(await installationToken(env, "devugur")).toBe("ghs_install");
    expect(calls).toHaveLength(used);
  });

  it("returns nothing for an account the app is not installed on", async () => {
    stubGithub();
    const { env } = envWith();
    expect(await installationToken(env, "viralsync-app")).toBeNull();
  });
});

describe("which credential speaks for an account", () => {
  it("prefers the app, falls back to the personal token elsewhere, and says so when neither fits", async () => {
    stubGithub();
    const { env } = envWith({ AGENT_GITHUB_TOKEN: "pat" });
    expect(await githubToken(env, "devUgur")).toBe("ghs_install");
    expect(await githubToken(env, "viralsync-app")).toBe("pat");
    const { env: appOnly } = envWith();
    await expect(githubToken(appOnly, "viralsync-app")).rejects.toThrow(/nicht installiert/);
  });

  it("uses the token alone when no app is configured", async () => {
    const { env } = envWith({ AGENT_GH_APP_ID: undefined, AGENT_GH_APP_PRIVATE_KEY: undefined, AGENT_GITHUB_TOKEN: "pat" });
    expect(await githubToken(env, "devUgur")).toBe("pat");
    expect((await githubStatus(env, ["devugur"])).mode).toBe("token");
  });

  it("reports installations and whether their account is on the allow-list", async () => {
    stubGithub();
    const { env } = envWith();
    expect(await githubStatus(env, ["devugur"])).toMatchObject({ mode: "app", installations: [{ account: "devUgur", allowed: true }] });
    expect((await githubStatus(env, [])).installations[0]?.allowed).toBe(false);
  });
});

describe("listing repositories through the app", () => {
  it("lists the installation's repositories with the installation token and adds the token's extras once", async () => {
    const calls = stubGithub();
    const { env } = envWith({ AGENT_GITHUB_TOKEN: "pat" });
    const names = (await listRepositories(env)).map((repo) => repo.fullName).sort();
    expect(names).toEqual(["devUgur/a", "devUgur/b", "devUgur/c"]);
    expect(calls.find((call) => call.url.includes("/installation/repositories"))?.authorization).toBe("Bearer ghs_install");
    expect(calls.find((call) => call.url.includes("/user/repos"))?.authorization).toBe("Bearer pat");
  });

  it("works with the app alone", async () => {
    stubGithub();
    const { env } = envWith();
    expect((await listRepositories(env)).map((repo) => repo.fullName)).toEqual(["devUgur/a", "devUgur/b"]);
  });
});
