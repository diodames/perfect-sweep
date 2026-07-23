import { kv } from "@vercel/kv";
import { randomUUID } from "crypto";
import { isValidCountry } from "../countries.js";
import { validateNick } from "../nickValidate.js";

const SCORES_KEY = "lb:scores";
const TOP_N = 50;
const RATE_LIMIT = 5;
const RATE_WINDOW_SEC = 3600;

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function sumMargins(tournamentMargins, dreamMargin) {
  return tournamentMargins.reduce((a, b) => a + b, 0) + dreamMargin;
}

function bad(res, status, error) {
  return res.status(status).json({ error });
}

async function handleGet(res) {
  const rows = await kv.zrange(SCORES_KEY, 0, TOP_N - 1, { rev: true, withScores: true });
  // withScores:true returns [member, score, member, score, ...] or objects depending on version
  const entries = [];
  if (Array.isArray(rows) && rows.length) {
    if (typeof rows[0] === "object" && rows[0] !== null && "member" in rows[0]) {
      for (const row of rows) {
        const meta = await kv.hgetall(`lb:entry:${row.member}`);
        if (!meta || !meta.nick) continue;
        entries.push({
          id: row.member,
          nick: meta.nick,
          country: meta.country,
          score: Number(meta.score ?? row.score),
          at: meta.at || null,
        });
      }
    } else {
      for (let i = 0; i < rows.length; i += 2) {
        const id = rows[i];
        const score = Number(rows[i + 1]);
        const meta = await kv.hgetall(`lb:entry:${id}`);
        if (!meta || !meta.nick) continue;
        entries.push({
          id,
          nick: meta.nick,
          country: meta.country,
          score: Number(meta.score ?? score),
          at: meta.at || null,
        });
      }
    }
  }

  return res.status(200).json({
    entries: entries.map((e, i) => ({
      rank: i + 1,
      nick: e.nick,
      country: e.country,
      score: e.score,
      at: e.at,
    })),
  });
}

async function handlePost(req, res) {
  const ip = clientIp(req);
  const rlKey = `lb:rl:${ip}`;
  const hits = await kv.incr(rlKey);
  if (hits === 1) await kv.expire(rlKey, RATE_WINDOW_SEC);
  if (hits > RATE_LIMIT) {
    return bad(res, 429, "Too many submissions. Try again later.");
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const nickCheck = validateNick(body.nick);
  if (!nickCheck.ok) {
    return bad(res, 400, nickCheck.error);
  }
  const nick = nickCheck.nick;
  const country = String(body.country || "").toUpperCase();
  const score = Number(body.score);
  const tournamentMargins = body.tournamentMargins;
  const dreamMargin = Number(body.dreamMargin);
  if (!isValidCountry(country)) {
    return bad(res, 400, "Invalid country.");
  }
  if (!Array.isArray(tournamentMargins) || tournamentMargins.length !== 8) {
    return bad(res, 400, "tournamentMargins must be an array of 8 positive margins.");
  }
  const margins = tournamentMargins.map(Number);
  if (margins.some((m) => !Number.isFinite(m) || m <= 0)) {
    return bad(res, 400, "All tournament margins must be positive (Perfect Sweep required).");
  }
  if (!Number.isFinite(dreamMargin) || dreamMargin <= 0) {
    return bad(res, 400, "Dream Team margin must be positive.");
  }
  const expected = sumMargins(margins, dreamMargin);
  if (!Number.isFinite(score) || score !== expected) {
    return bad(res, 400, "Score does not match sum of margins.");
  }

  const id = randomUUID();
  const at = new Date().toISOString();
  await kv.hset(`lb:entry:${id}`, { nick, country, score: String(score), at });
  await kv.zadd(SCORES_KEY, { score, member: id });

  return res.status(201).json({ ok: true, id, rank: null, score, at });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") return await handleGet(res);
    if (req.method === "POST") return await handlePost(req, res);
    return bad(res, 405, "Method not allowed");
  } catch (err) {
    console.error("leaderboard error", err);
    const msg = err?.message || "Server error";
    if (/KV_|UPSTASH|ECONN|Missing/i.test(msg)) {
      return bad(res, 503, "Hall of Fame storage is not configured.");
    }
    return bad(res, 500, "Server error");
  }
}
