import { adminAggregateMetrics } from "../../metrics.js";

function bad(res, status, error) {
  return res.status(status).json({ error });
}

/** Same auth as HoF DELETE / GET /api/metrics — LB_ADMIN_SECRET via Bearer or X-Admin-Secret. */
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Secret");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return bad(res, 405, "Method not allowed");

  try {
    const auth = adminAuthorized(req);
    if (auth.reason === "unconfigured") {
      return bad(res, 503, "Metrics admin is not configured.");
    }
    if (!auth.ok) return bad(res, 401, "Unauthorized.");

    const days = Number(req.query?.days || 7);
    const data = await adminAggregateMetrics(days);
    return res.status(200).json(data);
  } catch (err) {
    console.error("admin metrics error", err);
    const msg = err?.message || "Server error";
    if (/KV_|UPSTASH|ECONN|Missing/i.test(msg)) {
      return bad(res, 503, "Metrics storage is not configured.");
    }
    return bad(res, 500, "Server error");
  }
}
