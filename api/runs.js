import { kv } from "@vercel/kv";
import { createHash } from "crypto";

const MAX_PAYLOAD_CHARS = 2048;
const RATE_LIMIT = 30;
const RATE_WINDOW_SEC = 3600;
const ID_RE = /^[A-Za-z0-9_-]{4,16}$/;
const PAYLOAD_RE = /^[A-Za-z0-9_-]+$/;
const RESULTS = new Set(["sweep", "champs", "group", "r2", "elim", "run"]);

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function bad(res, status, error) {
  return res.status(status).json({ error });
}

const str = (v, max) => String(v ?? "").slice(0, max);
const int = (v, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : 0;
};

function sanitizeGame(g) {
  return {
    stage: str(g?.stage, 20),
    my: int(g?.my, 0, 200),
    op: int(g?.op, 0, 200),
    m: int(g?.m, -99, 99),
  };
}

/** Display-only summary for the share page / OG image. Never trusted for gameplay. */
function sanitizeMeta(meta) {
  if (!meta || typeof meta !== "object") return null;
  const players = Array.isArray(meta.players)
    ? meta.players.slice(0, 5).map((p) => ({
        pos: str(p?.pos, 2),
        name: str(p?.name, 26),
        rt: int(p?.rt, 0, 99),
        t: str(p?.t, 22),
      }))
    : [];
  if (players.length !== 5 || players.some((p) => !p.name)) return null;
  const day = typeof meta.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(meta.day) ? meta.day : null;
  const mode = meta.mode === "daily" ? "daily" : "free";
  const games = Array.isArray(meta.games)
    ? meta.games.slice(0, 8).map(sanitizeGame)
    : [];
  const dreamGame = meta.dreamGame && typeof meta.dreamGame === "object"
    ? sanitizeGame(meta.dreamGame)
    : null;
  return {
    v: 1,
    result: RESULTS.has(meta.result) ? meta.result : "run",
    w: int(meta.w, 0, 9),
    l: int(meta.l, 0, 9),
    margins: Array.isArray(meta.margins)
      ? meta.margins.slice(0, 8).map((m) => int(m, -99, 99))
      : [],
    games,
    dream: meta.dream == null ? null : int(meta.dream, -99, 99),
    dreamGame,
    score: meta.score == null ? null : int(meta.score, 0, 999),
    ovr: int(meta.ovr, 0, 99),
    players,
    mode,
    day: mode === "daily" ? day : null,
    n: mode === "daily" ? int(meta.n, 1, 99999) : null,
    efficiency: meta.efficiency == null || !Number.isFinite(Number(meta.efficiency))
      ? null
      : Math.round(Number(meta.efficiency) * 100) / 100,
  };
}

async function handlePost(req, res) {
  const ip = clientIp(req);
  const rlKey = `run:rl:${ip}`;
  const hits = await kv.incr(rlKey);
  if (hits === 1) await kv.expire(rlKey, RATE_WINDOW_SEC);
  if (hits > RATE_LIMIT) return bad(res, 429, "Too many shares. Try again later.");

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const payload = String(body.payload || "");
  if (!payload || payload.length > MAX_PAYLOAD_CHARS || !PAYLOAD_RE.test(payload)) {
    return bad(res, 400, "Invalid payload.");
  }
  const meta = sanitizeMeta(body.meta);
  if (!meta) return bad(res, 400, "Invalid meta.");

  // Content-addressed id: the same run always maps to the same short link.
  const id = createHash("sha256").update(payload).digest("base64url").slice(0, 8);
  await kv.set(`run:${id}`, { payload, meta, at: new Date().toISOString() });

  return res.status(201).json({ id });
}

async function handleGet(req, res) {
  const id = String(req.query?.id || "").trim();
  if (!ID_RE.test(id)) return bad(res, 400, "Invalid id.");
  const run = await kv.get(`run:${id}`);
  if (!run || !run.payload) return bad(res, 404, "Run not found.");
  // Ids are content hashes, so responses never change — cache hard at the CDN.
  res.setHeader("Cache-Control", "public, s-maxage=86400, max-age=3600, immutable");
  return res.status(200).json({ id, payload: run.payload, meta: run.meta || null });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "POST") return await handlePost(req, res);
    return bad(res, 405, "Method not allowed");
  } catch (err) {
    console.error("runs error", err);
    const msg = err?.message || "Server error";
    if (/KV_|UPSTASH|ECONN|Missing/i.test(msg)) {
      return bad(res, 503, "Share storage is not configured.");
    }
    return bad(res, 500, "Server error");
  }
}
