import { kv } from "@vercel/kv";
import {
  aggregateMetrics,
  isMetricEvent,
  recordMetric,
  sanitizeTrackBody,
} from "../metrics.js";

const RATE_LIMIT = 120;
const RATE_WINDOW_SEC = 3600;

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function bad(res, status, error) {
  return res.status(status).json({ error });
}

function adminAuthorized(req) {
  const secret = process.env.LB_ADMIN_SECRET;
  if (!secret) return { ok: false, reason: "unconfigured" };
  const header = req.headers.authorization || req.headers["x-admin-secret"] || "";
  const token = typeof header === "string" && header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : String(header).trim();
  if (!token || token !== secret) return { ok: false, reason: "unauthorized" };
  return { ok: true };
}

async function handlePost(req, res) {
  const ip = clientIp(req);
  const rlKey = `metrics:rl:${ip}`;
  const hits = await kv.incr(rlKey);
  if (hits === 1) await kv.expire(rlKey, RATE_WINDOW_SEC);
  if (hits > RATE_LIMIT) return bad(res, 429, "Too many requests.");

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const parsed = sanitizeTrackBody(body);
  if (!parsed || !isMetricEvent(parsed.event)) {
    return bad(res, 400, "Unknown or invalid event.");
  }

  // Clients must not self-report page views of /r/:id — that is recorded server-side.
  if (parsed.event === "shared_result_viewed") {
    return bad(res, 400, "Event not accepted from client.");
  }

  await recordMetric(parsed.event, parsed);
  return res.status(204).end();
}

async function handleGet(req, res) {
  const auth = adminAuthorized(req);
  if (auth.reason === "unconfigured") {
    return bad(res, 503, "Metrics admin is not configured.");
  }
  if (!auth.ok) return bad(res, 401, "Unauthorized.");

  const days = Number(req.query?.days || 7);
  const data = await aggregateMetrics(days);
  return res.status(200).json(data);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Secret");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "POST") return await handlePost(req, res);
    if (req.method === "GET") return await handleGet(req, res);
    return bad(res, 405, "Method not allowed");
  } catch (err) {
    console.error("metrics error", err);
    const msg = err?.message || "Server error";
    if (/KV_|UPSTASH|ECONN|Missing/i.test(msg)) {
      return bad(res, 503, "Metrics storage is not configured.");
    }
    return bad(res, 500, "Server error");
  }
}
