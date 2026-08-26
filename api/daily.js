import { kv } from "@vercel/kv";
import { randomUUID } from "crypto";
import { isValidCountry } from "../countries.js";
import { validateNick } from "../nickValidate.js";
import { CPU_FLAG_KEY, CPU_N_KEY, CPU_TARGET_N_DEFAULT, compareDailyEntries } from "../daily.js";

const TOP_N = 50;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function bad(res, status, error) {
  return res.status(status).json({ error });
}

function utcToday() {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Rank: perfect first, then higher efficiency, then more wins, then higher ovr, then earlier.
 * Encoded as a single float for the ZSET (higher = better).
 */
function rankScore({ perfect, w, efficiency, ovr, atIso }) {
  const FAR_SEC = 4_102_444_800;
  const tSec = Math.floor((atIso ? Date.parse(atIso) : Date.now()) / 1000);
  const timePart = Math.max(0, FAR_SEC - tSec) / FAR_SEC;
  const eff = Math.max(-50, Math.min(50, Number(efficiency) || 0));
  const o = Math.max(0, Math.min(99, Number(ovr) || 0));
  const wins = Math.max(0, Math.min(9, Number(w) || 0));
  return (perfect ? 1e14 : 0)
    + (eff + 50) * 1e10
    + wins * 1e6
    + o * 1e3
    + timePart * 999;
}

function parseMargins(raw) {
  if (Array.isArray(raw)) return raw.map((m) => Number(m) || 0);
  if (typeof raw !== "string" || !raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map((m) => Number(m) || 0) : [];
  } catch {
    return [];
  }
}

async function handleGet(req, res) {
  const day = String(req.query?.day || utcToday()).trim();
  if (!DAY_RE.test(day)) return bad(res, 400, "Invalid day.");

  const scoresKey = `daily:${day}:scores`;
  const rows = await kv.zrange(scoresKey, 0, TOP_N * 4 - 1, { rev: true, withScores: true });
  const entries = [];

  if (Array.isArray(rows) && rows.length) {
    if (typeof rows[0] === "object" && rows[0] !== null && "member" in rows[0]) {
      for (const row of rows) {
        const meta = await kv.hgetall(`daily:${day}:entry:${row.member}`);
        if (!meta || !meta.nick) continue;
        entries.push({
          id: row.member,
          nick: meta.nick,
          country: meta.country,
          w: Number(meta.w) || 0,
          l: Number(meta.l) || 0,
          perfect: meta.perfect === "1" || meta.perfect === true || meta.perfect === "true",
          ovr: Number(meta.ovr) || 0,
          efficiency: Number(meta.efficiency) || 0,
          margins: parseMargins(meta.margins),
          runId: meta.runId || null,
          at: meta.at || null,
        });
      }
    } else {
      for (let i = 0; i < rows.length; i += 2) {
        const id = rows[i];
        const meta = await kv.hgetall(`daily:${day}:entry:${id}`);
        if (!meta || !meta.nick) continue;
        entries.push({
          id,
          nick: meta.nick,
          country: meta.country,
          w: Number(meta.w) || 0,
          l: Number(meta.l) || 0,
          perfect: meta.perfect === "1" || meta.perfect === true || meta.perfect === "true",
          ovr: Number(meta.ovr) || 0,
          efficiency: Number(meta.efficiency) || 0,
          margins: parseMargins(meta.margins),
          runId: meta.runId || null,
          at: meta.at || null,
        });
      }
    }
  }

  entries.sort(compareDailyEntries);
  const top = entries.slice(0, TOP_N);
  const count = await kv.zcard(scoresKey).catch(() => top.length);

  let cpuDrafters = true;
  let cpuTargetN = CPU_TARGET_N_DEFAULT;
  try {
    const flag = await kv.get(CPU_FLAG_KEY);
    if (flag === "0" || flag === 0 || flag === false || flag === "false") cpuDrafters = false;
    const nRaw = await kv.get(CPU_N_KEY);
    const n = Math.round(Number(nRaw));
    if (Number.isFinite(n) && n >= 1 && n <= 50) cpuTargetN = n;
  } catch { /* default on */ }

  return res.status(200).json({
    day,
    count: Number(count) || top.length,
    cpuDrafters,
    cpuTargetN,
    entries: top.map((e, i) => ({
      rank: i + 1,
      id: e.id,
      nick: e.nick,
      country: e.country,
      w: e.w,
      l: e.l,
      perfect: e.perfect,
      ovr: e.ovr,
      efficiency: e.efficiency,
      margins: e.margins,
      runId: e.runId,
      at: e.at,
    })),
  });
}

async function handlePost(req, res) {
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const day = String(body.day || "").trim();
  if (!DAY_RE.test(day)) return bad(res, 400, "Invalid day.");
  if (day !== utcToday()) return bad(res, 400, "Can only submit today's challenge.");

  const ip = clientIp(req);
  const rlKey = `daily:rl:${day}:${ip}`;
  const hits = await kv.incr(rlKey);
  if (hits === 1) await kv.expire(rlKey, 86400 + 3600);
  if (hits > 1) return bad(res, 429, "Already submitted today from this network.");

  const nickCheck = validateNick(body.nick);
  if (!nickCheck.ok) return bad(res, 400, nickCheck.error);
  const nick = nickCheck.nick;
  const country = String(body.country || "").toUpperCase();
  if (!isValidCountry(country)) return bad(res, 400, "Invalid country.");

  const w = Math.max(0, Math.min(9, Math.round(Number(body.w) || 0)));
  const l = Math.max(0, Math.min(9, Math.round(Number(body.l) || 0)));
  const perfect = !!body.perfect;
  const ovr = Math.max(0, Math.min(99, Math.round(Number(body.ovr) || 0)));
  const efficiency = Math.round((Number(body.efficiency) || 0) * 100) / 100;
  const margins = Array.isArray(body.margins)
    ? body.margins.slice(0, 8).map((m) => Math.max(-99, Math.min(99, Math.round(Number(m) || 0))))
    : [];
  const runId = body.runId ? String(body.runId).slice(0, 16) : null;

  if (perfect && (w !== 8 || l !== 0)) return bad(res, 400, "Perfect sweep must be 8–0.");

  const id = randomUUID();
  const at = new Date().toISOString();
  const entry = {
    nick, country, w, l,
    perfect: perfect ? "1" : "0",
    ovr: String(ovr),
    efficiency: String(efficiency),
    margins: JSON.stringify(margins),
    runId: runId || "",
    at,
  };

  const scoresKey = `daily:${day}:scores`;
  const z = rankScore({ perfect, w, efficiency, ovr, atIso: at });
  await kv.hset(`daily:${day}:entry:${id}`, entry);
  await kv.zadd(scoresKey, { score: z, member: id });
  // Keep daily boards for ~90 days
  await kv.expire(scoresKey, 90 * 86400);
  await kv.expire(`daily:${day}:entry:${id}`, 90 * 86400);

  return res.status(201).json({ id, day });
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
    console.error("daily error", err);
    const msg = err?.message || "Server error";
    if (/KV_|UPSTASH|ECONN|Missing/i.test(msg)) {
      return bad(res, 503, "Daily standings are not configured.");
    }
    return bad(res, 500, "Server error");
  }
}
