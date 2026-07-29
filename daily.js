/** Daily Challenge — UTC day keys, challenge numbers, seeded PRNG streams. */

export const DAILY_EPOCH = "2026-07-29"; // Daily Challenge #1
const LS_PREFIX = "ps:daily:";

export function utcDayKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidDayKey(day) {
  return typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day);
}

/** Days since epoch (inclusive). #1 on DAILY_EPOCH. */
export function dailyNumber(day = utcDayKey()) {
  const [ey, em, ed] = DAILY_EPOCH.split("-").map(Number);
  const [y, m, d] = day.split("-").map(Number);
  const a = Date.UTC(ey, em - 1, ed);
  const b = Date.UTC(y, m - 1, d);
  return Math.max(1, Math.floor((b - a) / 86400000) + 1);
}

export function formatDayLabel(day) {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** ms until next UTC midnight from `now`. */
export function msUntilUtcMidnight(now = Date.now()) {
  const n = new Date(now);
  const next = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1);
  return Math.max(0, next - now);
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** FNV-1a 32-bit → unsigned int for mulberry32. */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derived stream for a lane — independent of how many other lanes were consumed.
 * e.g. rng("2026-07-28", "roll", 3) always yields the same sequence for roll #3.
 */
export function rng(day, lane, ...parts) {
  const key = ["perfectsweep-daily", day, lane, ...parts].join("|");
  return mulberry32(hashSeed(key));
}

/** Fisher-Yates with injectable rand (default Math.random). */
export function shuffleWith(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function efficiencyFrom(margins, ovr, dreamMargin = null) {
  if (!ovr) return 0;
  const sum = (margins || []).reduce((a, b) => a + b, 0) + (dreamMargin != null ? dreamMargin : 0);
  return Math.round((sum / ovr) * 100) / 100;
}

export function dailyLsKey(day) {
  return `${LS_PREFIX}${day}`;
}

export function loadDailyState(day) {
  if (typeof localStorage === "undefined" || !isValidDayKey(day)) return null;
  try {
    const raw = localStorage.getItem(dailyLsKey(day));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

export function saveDailyState(day, data) {
  if (typeof localStorage === "undefined" || !isValidDayKey(day)) return;
  try {
    localStorage.setItem(dailyLsKey(day), JSON.stringify(data));
  } catch { /* quota / private mode */ }
}

export function clearDailyState(day) {
  if (typeof localStorage === "undefined" || !isValidDayKey(day)) return;
  try {
    localStorage.removeItem(dailyLsKey(day));
  } catch { /* ignore */ }
}

/** Strip heavy game objects down to what we need to resume / show results. */
export function serializeLineup(lineup) {
  const out = {};
  for (const s of ["PG", "SG", "SF", "PF", "C"]) {
    const p = lineup?.[s];
    if (!p) continue;
    out[s] = {
      name: p.name, n: p.n, pos: p.pos, rt: p.rt,
      team: p.team, season: p.season, tc: p.tc,
      trait: p.trait, traits: p.traits,
    };
  }
  return out;
}

export function serializeGames(games) {
  return (games || []).map((g) => ({
    my: g.my, op: g.op,
    round: g.round,
    opp: g.opp ? { name: g.opp.name, season: g.opp.season, c: g.opp.c, alt: g.opp.alt } : null,
    box: (g.box || []).map((b) => ({ name: b.name, n: b.n, pts: b.pts })),
  }));
}
