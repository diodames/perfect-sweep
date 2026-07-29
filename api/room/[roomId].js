import { kv } from "@vercel/kv";
import { isValidCountry } from "../../countries.js";
import { validateNick } from "../../nickValidate.js";
import { isValidRoomId, roomSeed } from "../../daily.js";

const ROOM_TTL_SEC = 2 * 3600;
const ACTION_LIMIT = 60;
const ACTION_WINDOW = 3600;
const SLOTS = ["PG", "SG", "SF", "PF", "C"];
const STYLE_IDS = new Set(["run", "bal", "lock"]);

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function bad(res, status, error, extra = {}) {
  return res.status(status).json({ error, ...extra });
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

async function loadRoom(id) {
  if (!isValidRoomId(id)) return null;
  return kv.get(`room:${id}`);
}

async function saveRoom(room) {
  room.updatedAt = new Date().toISOString();
  await kv.set(`room:${room.id}`, room, { ex: ROOM_TTL_SEC });
}

function findSlot(room, nick, country) {
  return room.players.findIndex(
    (p) => p && p.nick === nick && p.country === country,
  );
}

function sanitizeLineup(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const pos of SLOTS) {
    const p = raw[pos];
    if (!p || p.pos !== pos || !p.name || !p.team || !p.season) return null;
    const rt = Math.round(Number(p.rt));
    if (!Number.isFinite(rt) || rt < 60 || rt > 99) return null;
    out[pos] = {
      pos,
      name: String(p.name).slice(0, 40),
      n: Math.max(0, Math.min(99, Math.round(Number(p.n) || 0))),
      rt,
      team: String(p.team).slice(0, 32),
      season: String(p.season).slice(0, 8),
      tc: p.tc ? String(p.tc).slice(0, 16) : undefined,
      trait: p.trait ? String(p.trait).slice(0, 32) : undefined,
      traits: Array.isArray(p.traits) ? p.traits.slice(0, 4).map((t) => String(t).slice(0, 32)) : undefined,
    };
  }
  return out;
}

async function rateLimit(ip) {
  const rlKey = `room:rl:action:${ip}`;
  const hits = await kv.incr(rlKey);
  if (hits === 1) await kv.expire(rlKey, ACTION_WINDOW);
  return hits <= ACTION_LIMIT;
}

async function handleGet(req, res, roomId) {
  const room = await loadRoom(roomId);
  if (!room) return bad(res, 404, "Room not found or expired.");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ room: publicRoom(room) });
}

async function handlePost(req, res, roomId) {
  const ip = clientIp(req);
  if (!(await rateLimit(ip))) return bad(res, 429, "Too many actions. Slow down.");

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const action = String(body.action || "");
  const expectedVersion = Number(body.expectedVersion);

  const room = await loadRoom(roomId);
  if (!room) return bad(res, 404, "Room not found or expired.");

  if (action !== "join" && (!Number.isInteger(expectedVersion) || expectedVersion !== room.version)) {
    return bad(res, 409, "Room changed. Refresh and retry.", { room: publicRoom(room) });
  }

  if (action === "join") {
    if (room.phase !== "lobby") return bad(res, 400, "Room is not accepting players.");
    if (room.players[1]) return bad(res, 400, "Room is full.");
    const nickCheck = validateNick(body.nick);
    if (!nickCheck.ok) return bad(res, 400, nickCheck.error);
    const country = String(body.country || "").toUpperCase();
    if (!isValidCountry(country)) return bad(res, 400, "Invalid country.");
    if (room.players[0]?.nick === nickCheck.nick) {
      return bad(res, 400, "Nick already taken in this room.");
    }
    room.players[1] = {
      slot: 1,
      nick: nickCheck.nick,
      country,
      ready: false,
      draftDone: false,
      lineup: null,
      styleId: "bal",
    };
    room.version += 1;
    await saveRoom(room);
    return res.status(200).json({ room: publicRoom(room), slot: 1 });
  }

  const nickCheck = validateNick(body.nick);
  if (!nickCheck.ok) return bad(res, 400, nickCheck.error);
  const country = String(body.country || "").toUpperCase();
  if (!isValidCountry(country)) return bad(res, 400, "Invalid country.");
  const slot = findSlot(room, nickCheck.nick, country);
  if (slot < 0) return bad(res, 403, "You are not in this room.");

  if (action === "ready") {
    if (room.phase !== "lobby") return bad(res, 400, "Not in lobby.");
    room.players[slot].ready = true;
    if (room.players[0]?.ready && room.players[1]?.ready) {
      room.phase = "draft";
    }
  } else if (action === "setStyle") {
    const styleId = String(body.styleId || "");
    if (!STYLE_IDS.has(styleId)) return bad(res, 400, "Invalid style.");
    if (room.phase !== "lobby" && room.phase !== "draft") {
      return bad(res, 400, "Cannot change style now.");
    }
    room.players[slot].styleId = styleId;
  } else if (action === "submitDraft") {
    if (room.phase !== "draft") return bad(res, 400, "Draft is not open.");
    if (room.players[slot].draftDone) return bad(res, 400, "Draft already submitted.");
    const lineup = sanitizeLineup(body.lineup);
    if (!lineup) return bad(res, 400, "Invalid lineup.");
    if (body.styleId && STYLE_IDS.has(String(body.styleId))) {
      room.players[slot].styleId = String(body.styleId);
    }
    room.players[slot].lineup = lineup;
    room.players[slot].draftDone = true;
    if (room.players[0]?.draftDone && room.players[1]?.draftDone) {
      room.phase = "sim";
      // Ensure seed matches round (authoritative).
      room.seed = roomSeed(room.id, room.round || 1);
    }
  } else if (action === "ackResult") {
    // Clients finished local sim — mark done once either acks (display sync only).
    if (room.phase !== "sim" && room.phase !== "done") {
      return bad(res, 400, "Result not ready.");
    }
    room.phase = "done";
  } else if (action === "leave") {
    if (slot === 0) {
      await kv.del(`room:${room.id}`);
      return res.status(200).json({ closed: true });
    }
    room.players[1] = null;
    room.phase = "lobby";
    room.players[0].ready = false;
    room.players[0].draftDone = false;
    room.players[0].lineup = null;
  } else {
    return bad(res, 400, "Unknown action.");
  }

  room.version += 1;
  await saveRoom(room);
  return res.status(200).json({ room: publicRoom(room), slot });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const roomId = String(req.query?.roomId || "").toUpperCase();
    if (!isValidRoomId(roomId)) return bad(res, 400, "Invalid room id.");
    if (req.method === "GET") return await handleGet(req, res, roomId);
    if (req.method === "POST") return await handlePost(req, res, roomId);
    return bad(res, 405, "Method not allowed");
  } catch (err) {
    console.error("room error", err);
    const msg = err?.message || "Server error";
    if (/KV_|UPSTASH|ECONN|Missing/i.test(msg)) {
      return bad(res, 503, "Room storage is not configured.");
    }
    return bad(res, 500, "Server error");
  }
}
