import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { WebSocketServer } from "ws";
import api from "../../api/src/index.ts";
import type { NodePlatform } from "../../api/src/node/platform.ts";

/**
 * HTTP and WebSocket for the Node host (ADR 0045, R1). Every request goes to the same fetch handler as on
 * Cloudflare; only `/api/live` is upgraded here, with the hub's one-time ticket.
 */
async function toRequest(message: IncomingMessage, origin: string): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(message.headers)) {
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else if (value !== undefined) headers.set(name, value);
  }
  const method = message.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  return new Request(new URL(message.url ?? "/", origin), {
    method,
    headers,
    body: hasBody ? (Readable.toWeb(message) as unknown as ReadableStream<Uint8Array>) : undefined,
    // Node's fetch needs this for a streamed request body.
    ...(hasBody ? { duplex: "half" } : {}),
    redirect: "manual",
  } as RequestInit);
}

async function send(response: Response, out: ServerResponse): Promise<void> {
  out.statusCode = response.status;
  response.headers.forEach((value, name) => {
    if (name === "set-cookie") return;
    out.setHeader(name, value);
  });
  // Node's Headers keep several Set-Cookie values apart; the Workers types do not declare it.
  const cookies = (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  if (cookies.length) out.setHeader("set-cookie", cookies);
  if (!response.body) {
    out.end();
    return;
  }
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) out.write(chunk);
  out.end();
}

export function startServer(platform: NodePlatform, options: { port: number; host: string }): Server {
  const origin = `http://${options.host === "0.0.0.0" ? "localhost" : options.host}:${options.port}`;
  const sockets = new WebSocketServer({ noServer: true });

  const server = createServer((message, out) => {
    void (async () => {
      try {
        await send(await api.fetch(await toRequest(message, origin), platform.env), out);
      } catch (error) {
        console.error("node-host request failed", error);
        if (!out.headersSent) out.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        out.end(JSON.stringify({ error: "Interner Fehler" }));
      }
    })();
  });

  server.on("upgrade", (message, socket, head) => {
    const url = new URL(message.url ?? "/", origin);
    if (url.pathname !== "/api/live" || !platform.hub.redeem(url.searchParams.get("ticket"))) {
      socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      return;
    }
    sockets.handleUpgrade(message, socket, head, (ws) => {
      const live = { send: (text: string) => ws.send(text), close: () => ws.close() };
      ws.on("message", (data) => void platform.hub.message(live, data.toString()).catch((error) => console.error("live message failed", error)));
      ws.on("close", () => void platform.hub.disconnect(live).catch((error) => console.error("live close failed", error)));
      void platform.hub.connect(live).catch((error) => console.error("live connect failed", error));
    });
  });

  server.listen(options.port, options.host);
  return server;
}
