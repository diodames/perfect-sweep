/* Smoke-test KV metrics: POST events, share view (bot vs human), GET admin aggregate. */
import http from "node:http";

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
process.env.LB_ADMIN_SECRET = "test-admin-secret";

const { default: metricsHandler } = await import("../api/metrics.js");
const { default: adminMetricsHandler } = await import("../api/admin/metrics.js");
const { default: shareHandler } = await import("../api/share.js");
const { kv } = await import("@vercel/kv");

await kv.set("run:abcd", {
  payload: "x",
  meta: {
    v: 1, result: "sweep", w: 8, l: 0, margins: [1, 2, 3, 4, 5, 6, 7, 8],
    games: [], dream: null, dreamGame: null, score: 10, ovr: 90,
    players: [
      { pos: "PG", name: "A", rt: 90, t: "USA '94" },
      { pos: "SG", name: "B", rt: 90, t: "USA '94" },
      { pos: "SF", name: "C", rt: 90, t: "USA '94" },
      { pos: "PF", name: "D", rt: 90, t: "USA '94" },
      { pos: "C", name: "E", rt: 90, t: "USA '94" },
    ],
    mode: "daily", day: "2026-07-29", n: 1, efficiency: 1,
  },
});

function mockRes() {
  const r = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(c, h) { this.statusCode = c; Object.assign(this.headers, h || {}); },
    end(b) { this.body = b; return this; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = JSON.stringify(o); return this; },
    send(b) { this.body = b; return this; },
  };
  return r;
}

async function post(event, props = {}) {
  const res = mockRes();
  await metricsHandler({
    method: "POST",
    headers: { "x-forwarded-for": "1.2.3.4" },
    query: {},
    body: { event, ...props },
    socket: {},
  }, res);
  return res.statusCode;
}

const c1 = await post("run_completed", { mode: "daily", result: "sweep" });
const c2 = await post("share_clicked", { channel: "clipboard" });
const c3 = await post("shared_result_opened");
const c4 = await post("came_from_share");
const bad = await post("shared_result_viewed"); // client must not self-report
const unknown = await post("nope");

const human = mockRes();
await shareHandler({
  method: "GET",
  headers: { host: "localhost", "user-agent": "Mozilla/5.0" },
  query: { id: "abcd" },
}, human);

const bot = mockRes();
await shareHandler({
  method: "GET",
  headers: { host: "localhost", "user-agent": "facebookexternalhit/1.1" },
  query: { id: "abcd" },
}, bot);

const admin = mockRes();
await metricsHandler({
  method: "GET",
  headers: { authorization: "Bearer test-admin-secret" },
  query: { days: "7" },
  socket: {},
}, admin);
const agg = JSON.parse(admin.body);

const adminUi = mockRes();
await adminMetricsHandler({
  method: "GET",
  headers: { authorization: "Bearer test-admin-secret" },
  query: { days: "7" },
  socket: {},
}, adminUi);
const ui = JSON.parse(adminUi.body);

const adminDenied = mockRes();
await adminMetricsHandler({
  method: "GET",
  headers: {},
  query: { days: "7" },
  socket: {},
}, adminDenied);

const checks = {
  post_ok: c1 === 204 && c2 === 204 && c3 === 204 && c4 === 204,
  reject_viewed_client: bad === 400,
  reject_unknown: unknown === 400,
  human_html: human.statusCode === 200 && String(human.body).includes("Open Perfect Sweep"),
  bot_html: bot.statusCode === 200,
  admin_ok: admin.statusCode === 200,
  run_completed: agg.totals.run_completed === 1,
  share_clicked: agg.totals.share_clicked === 1,
  viewed_humans_only: agg.totals.shared_result_viewed === 1,
  opened: agg.totals.shared_result_opened === 1,
  came_from_share: agg.totals.came_from_share === 1,
  share_rate: agg.rates.share_rate === 1,
  ctr: agg.rates.shared_link_ctr === 1,
  breakdown: agg.breakdown.run_completed["daily:sweep"] === 1,
  admin_ui_ok: adminUi.statusCode === 200,
  admin_ui_denied: adminDenied.statusCode === 401,
  admin_ui_shape: ui.range?.days === 7
    && ui.totals?.run_completed === 1
    && ui.totals?.run_completed_sweep === 1
    && ui.derived?.shareRate === 1
    && ui.derived?.resultCTR === 1
    && Array.isArray(ui.daily)
    && ui.daily.at(-1)?.run_completed_sweep === 1,
};

console.log(JSON.stringify(checks, null, 2));
const failed = Object.entries(checks).filter(([, v]) => !v);
if (failed.length) {
  console.error("FAILED", failed.map(([k]) => k).join(", "));
  process.exit(1);
}
console.log("verify-metrics OK");
process.exit(0);
