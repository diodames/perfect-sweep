import { kv } from "@vercel/kv";
import { isValidCountry } from "../../countries.js";
import { validateNick } from "../../nickValidate.js";
import {
  generateRoomCode, isValidRoomId, roomSeed,
} from "../../daily.js";

const ROOM_TTL_SEC = 2 * 3600;
const CREATE_LIMIT = 10;
const CREATE_WINDOW = 3600;

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function bad(res, status, error, extra = {}) {
  return res.status(status).json({ error, ...extra });
}

function emptyPlayer(slot, nick, country) {
  return {
    slot,
    nick,
    country,
    ready: false,
    draftDone: false,
    lineup: null,
    styleId: "bal",
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    version: room.version,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    mode: room.mode,
    phase: room.phase,
    seed: room.seed,
    round: room.round,
    players: room.players,
  };
}

async function rateLimit(ip, key, limit, windowSec) {
  const rlKey = `${key}:${ip}`;
  const hits = await kv.incr(rlKey);
  if (hits === 1) await kv.expire(rlKey, windowSec);
  return hits <= limit;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return bad(res, 405, "Method not allowed");

  try {
    const ip = clientIp(req);
    if (!(await rateLimit(ip, "room:rl:create", CREATE_LIMIT, CREATE_WINDOW))) {
      return bad(res, 429, "Too many rooms. Try again later.");
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const nickCheck = validateNick(body.nick);
    if (!nickCheck.ok) return bad(res, 400, nickCheck.error);
    const country = String(body.country || "").toUpperCase();
    if (!isValidCountry(country)) return bad(res, 400, "Invalid country.");

    let id = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = generateRoomCode();
      if (!isValidRoomId(candidate)) continue;
      const existing = await kv.get(`room:${candidate}`);
      if (!existing) { id = candidate; break; }
    }
    if (!id) return bad(res, 503, "Could not allocate room code.");

    const now = new Date().toISOString();
    const round = 1;
    const room = {
      id,
      version: 1,
      createdAt: now,
      updatedAt: now,
      mode: "cup_final",
      phase: "lobby",
      seed: roomSeed(id, round),
      round,
      players: [emptyPlayer(0, nickCheck.nick, country), null],
    };

    await kv.set(`room:${id}`, room, { ex: ROOM_TTL_SEC });
    return res.status(201).json({ room: publicRoom(room), slot: 0 });
  } catch (err) {
    console.error("room create error", err);
    const msg = err?.message || "Server error";
    if (/KV_|UPSTASH|ECONN|Missing/i.test(msg)) {
      return bad(res, 503, "Room storage is not configured.");
    }
    return bad(res, 500, "Server error");
  }
}
