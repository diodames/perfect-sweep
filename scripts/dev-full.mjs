/* Local full-stack harness: serves api/runs, api/share, api/og with an
   in-memory KV mock and proxies everything else to the Vite dev server —
   mirrors the production vercel.json routing for end-to-end testing. */
import fs from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";

const VITE = "http://localhost:5178";
const PORT = 3400;

// --- in-memory Upstash REST mock (same protocol @vercel/kv speaks) ---
const store = new Map();
const kvServer = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const run = ([cmd, ...args]) => {
      switch (String(cmd).toLowerCase()) {
        case "set": store.set(args[0], args[1]); return "OK";
        case "get": return store.has(args[0]) ? store.get(args[0]) : null;
        case "incr": {
          const n = (Number(store.get(args[0])) || 0) + 1;
          store.set(args[0], String(n)); return n;
        }
        case "expire": return 1;
        default: return null;
      }
    };
    let out = { result: null };
    try {
      const parsed = JSON.parse(body || "[]");
      out = req.url.includes("pipeline")
        ? parsed.map((c) => ({ result: run(c) }))
        : { result: run(parsed) };
    } catch {}
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(out));
  });
});
await new Promise((ok) => kvServer.listen(0, "127.0.0.1", ok));
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvServer.address().port}`;
process.env.KV_REST_API_TOKEN = "local-test-token";

// og.js loads bundled fonts via file: URLs — teach fetch to serve them
const origFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const u = input instanceof URL ? input : new URL(String(input), "file:///");
  if (u.protocol === "file:") return new Response(fs.readFileSync(fileURLToPath(u)));
  return origFetch(input, init);
};

const runsHandler = (await import("../api/runs.js")).default;
const shareHandler = (await import("../api/share.js")).default;
const ogHandler = (await import("../api/og.js")).default;

const nodeRes = (res) => ({
  setHeader: (k, v) => res.setHeader(k, v),
  writeHead: (c, h) => res.writeHead(c, h),
  end: (b) => res.end(b),
  status(c) { res.statusCode = c; return this; },
  json(o) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); return this; },
  send(b) { res.end(b); return this; },
});

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/api/runs") {
      let body = "";
      req.on("data", (c) => (body += c));
      await new Promise((ok) => req.on("end", ok));
      const mockReq = {
        method: req.method,
        headers: req.headers,
        query: Object.fromEntries(url.searchParams),
        body: body ? JSON.parse(body) : {},
        socket: req.socket,
      };
      return await runsHandler(mockReq, nodeRes(res));
    }
    if (url.pathname.startsWith("/r/")) {
      const mockReq = { method: "GET", headers: req.headers, query: { id: url.pathname.slice(3) } };
      return await shareHandler(mockReq, nodeRes(res));
    }
    if (url.pathname === "/api/og") {
      const resp = await ogHandler(new Request(`http://localhost:${PORT}${req.url}`));
      res.writeHead(resp.status, Object.fromEntries(resp.headers));
      return res.end(Buffer.from(await resp.arrayBuffer()));
    }
    // proxy the SPA to Vite
    const upstream = await origFetch(`${VITE}${req.url}`, { headers: { host: "localhost" } });
    res.writeHead(upstream.status, Object.fromEntries(upstream.headers));
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    console.error(req.url, err.message);
    res.writeHead(500);
    res.end("harness error");
  }
}).listen(PORT, () => console.log(`full-stack harness → http://localhost:${PORT}`));
