import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "../env.ts";
import { platformFrom, type CloudflareBindings } from "./platform.ts";
import { githubToken } from "../github/credentials.ts";

/**
 * The only ways out of a workstation container (ADR 0036). The container starts without Internet; the Durable
 * Object routes these hosts to the entrypoints below. Credentials are added here, in the Worker, and never
 * reach the container. What a run may reach comes from `props`, set by the Durable Object, never from the request.
 */
export interface GatewayProps {
  tenantId: string;
  repo: string;
  private: boolean;
  /** Preview uploads only: the one Worker the Cloudflare gateway lets through. */
  previewWorker?: string;
}

const forbidden = (why: string) => new Response(`Von der Workstation nicht erlaubt: ${why}\n`, { status: 403 });

/** Clone and fetch of the run's repository only. Pushing and every other repository are refused. */
export async function gitGateway(request: Request, env: Env, props: GatewayProps): Promise<Response> {
  const url = new URL(request.url);
  if (url.hostname !== "github.com") return forbidden(url.hostname);
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?\/(info\/refs|git-upload-pack)$/);
  if (!match || `${match[1]}/${match[2]}`.toLowerCase() !== props.repo.toLowerCase()) return forbidden("anderes Repository");
  const service = match[3];
  const readsRefs = service === "info/refs" && request.method === "GET" && url.searchParams.get("service") === "git-upload-pack";
  const uploadsPack = service === "git-upload-pack" && request.method === "POST";
  if (!readsRefs && !uploadsPack) return forbidden("nur Klonen und Abrufen");
  const headers = new Headers(request.headers);
  headers.delete("authorization");
  if (props.private) {
    const token = await githubToken(env, props.tenantId, props.repo.split("/")[0] ?? "");
    headers.set("authorization", `Basic ${btoa(`x-access-token:${token}`)}`);
  }
  return fetch(new Request(request, { headers }));
}

/** Package downloads for `pnpm install`: reading only. */
export async function registryGateway(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.hostname !== "registry.npmjs.org") return forbidden(url.hostname);
  if (request.method !== "GET" && request.method !== "HEAD") return forbidden("nur lesend");
  const headers = new Headers(request.headers);
  headers.delete("authorization");
  return fetch(new Request(request, { headers }));
}

/** Wrangler's calls for one preview Worker. The account token is added here; other Workers stay out of reach. */
export async function previewGateway(request: Request, env: Env, props: GatewayProps): Promise<Response> {
  const url = new URL(request.url);
  if (url.hostname !== "api.cloudflare.com" || !props.previewWorker) return forbidden(url.hostname);
  if (!env.AGENT_CF_PREVIEW_TOKEN) return forbidden("kein Preview-Token eingerichtet");
  const account = `/client/v4/accounts/${env.CF_ACCOUNT_ID}`;
  const script = `${account}/workers/scripts/${props.previewWorker}`;
  const allowed =
    url.pathname === script ||
    url.pathname.startsWith(`${script}/`) ||
    (request.method === "GET" && url.pathname === `${account}/workers/subdomain`);
  if (!allowed) return forbidden(url.pathname.replace(env.CF_ACCOUNT_ID, "<konto>"));
  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${env.AGENT_CF_PREVIEW_TOKEN}`);
  return fetch(new Request(request, { headers }));
}

export class GitGateway extends WorkerEntrypoint<CloudflareBindings, GatewayProps> {
  fetch(request: Request): Promise<Response> {
    return gitGateway(request, platformFrom(this.env), this.ctx.props);
  }
}

export class RegistryGateway extends WorkerEntrypoint<CloudflareBindings, GatewayProps> {
  fetch(request: Request): Promise<Response> {
    return registryGateway(request);
  }
}

export class PreviewGateway extends WorkerEntrypoint<CloudflareBindings, GatewayProps> {
  fetch(request: Request): Promise<Response> {
    return previewGateway(request, platformFrom(this.env), this.ctx.props);
  }
}
