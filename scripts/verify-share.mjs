/* Temporary verification harness for the viral share loop.
   Runs the api/ handlers directly against the real KV store. */
import fs from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";

// Vercel marks KV credentials as sensitive (pulled empty), so emulate the
// Upstash REST protocol @vercel/kv speaks against an in-memory store.
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

// api/og.js fetches bundled fonts via file: URLs at import time — teach fetch to serve them.
const origFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const u = input instanceof URL ? input : new URL(String(input), "file:///");
  if (u.protocol === "file:") return new Response(fs.readFileSync(fileURLToPath(u)));
  return origFetch(input, init);
};

const mockRes = () => {
  const res = {
    headers: {}, statusCode: 200, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    send(b) { this.body = b; return this; },
    writeHead(c, h) { this.statusCode = c; Object.assign(this.headers, h || {}); return this; },
    end() { return this; },
  };
  return res;
};

const meta = {
  result: "sweep", w: 8, l: 0,
  margins: [12, 5, 18, 3, 9, 14, 7, 11], dream: 6, score: 85, ovr: 91,
  players: [
    { pos: "PG", name: "S. Curry", rt: 96, t: "USA '16" },
    { pos: "SG", name: "M. Ginobili", rt: 89, t: "ARG '04" },
    { pos: "SF", name: "L. James", rt: 97, t: "USA '12" },
    { pos: "PF", name: "D. Nowitzki", rt: 94, t: "GER '11" },
    { pos: "C", name: "N. Jokic", rt: 95, t: "SRB '23" },
  ],
};
const payload = "eyJ2IjoxfQtestpayload123";

const runs = (await import("../api/runs.js")).default;

// 1) POST /api/runs
let res = mockRes();
await runs(
  { method: "POST", headers: { "x-forwarded-for": "127.0.0.1" }, body: { payload, meta }, query: {} },
  res
);
console.log("POST /api/runs →", res.statusCode, JSON.stringify(res.body));
if (res.statusCode !== 201 || !res.body?.id) process.exit(1);
const id = res.body.id;

// idempotence: same payload → same id
res = mockRes();
await runs({ method: "POST", headers: {}, body: { payload, meta }, query: {} }, res);
console.log("POST again    →", res.statusCode, "same id:", res.body?.id === id);

// 2) GET /api/runs?id=
res = mockRes();
await runs({ method: "GET", headers: {}, query: { id } }, res);
console.log("GET /api/runs →", res.statusCode, "payload ok:", res.body?.payload === payload, "meta ok:", res.body?.meta?.result === "sweep");

// invalid meta rejected
res = mockRes();
await runs({ method: "POST", headers: {}, body: { payload: "x".repeat(3000), meta }, query: {} }, res);
console.log("POST too-long →", res.statusCode);

// 3) /r/:id share HTML
const share = (await import("../api/share.js")).default;
res = mockRes();
await share({ method: "GET", headers: { host: "perfectsweep.test" }, query: { id } }, res);
const html = String(res.body || "");
const checks = {
  status: res.statusCode,
  title: html.includes("PERFECT SWEEP ✅ 8–0"),
  ogImage: html.includes(`/api/og?id=${id}`),
  twitterCard: html.includes("summary_large_image"),
  redirect: html.includes(`/?r=${id}`),
};
console.log("GET /r/:id    →", JSON.stringify(checks));

// unknown id → redirect home
res = mockRes();
await share({ method: "GET", headers: { host: "perfectsweep.test" }, query: { id: "nonexist" } }, res);
console.log("GET /r/bad    →", res.statusCode, res.headers.Location || res.headers.location);

// 4) OG images (landscape + story)
const og = (await import("../api/og.js")).default;
for (const [label, qs, out] of [
  ["og 1200x630 ", `id=${id}`, "/tmp/og-landscape.png"],
  ["og 1080x1920", `id=${id}&format=story`, "/tmp/og-story.png"],
]) {
  const resp = await og(new Request(`https://perfectsweep.test/api/og?${qs}`));
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(out, buf);
  console.log(label, "→", resp.status, resp.headers.get("content-type"), `${(buf.length / 1024).toFixed(0)} KB`, "→", out);
}

// loss variant: red tiles, no dream star, "out" headline
const lossMeta = { ...meta, result: "group", w: 1, l: 2, margins: [7, -4, -12], dream: null, score: null };
res = mockRes();
await runs({ method: "POST", headers: {}, body: { payload: "lossPayload987", meta: lossMeta }, query: {} }, res);
const lossId = res.body?.id;
const respLoss = await og(new Request(`https://perfectsweep.test/api/og?id=${lossId}`));
fs.writeFileSync("/tmp/og-loss.png", Buffer.from(await respLoss.arrayBuffer()));
console.log("og loss       →", respLoss.status, "→ /tmp/og-loss.png");

// unknown id → redirect to static og.png
const respBad = await og(new Request("https://perfectsweep.test/api/og?id=nonexist"));
console.log("og bad id     →", respBad.status, respBad.headers.get("location"));

console.log("ALL DONE, id =", id);
kvServer.close();
process.exit(0);
