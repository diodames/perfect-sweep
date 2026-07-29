/**
 * Anonymous KV counters for share-loop health.
 * Keys: metrics:{event}:{YYYY-MM-DD} (+ optional dimension suffixes).
 * TTL ~90 days so the keyspace stays bounded.
 */
import { kv } from "@vercel/kv";

export const METRICS_TTL_SEC = 90 * 24 * 60 * 60;

export const METRIC_EVENTS = [
  "run_completed",
  "share_clicked",
  "shared_result_viewed",
  "shared_result_opened",
  "came_from_share",
];

const EVENT_SET = new Set(METRIC_EVENTS);
const MODES = new Set(["daily", "casual", "multiplayer"]);
const RESULTS = new Set(["sweep", "champion", "eliminated"]);
const CHANNELS = new Set(["web_share", "clipboard", "story"]);

const BOT_UA_RE = /bot|crawl|spider|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|embedly|quora link preview|pinterest|redditbot|applebot|discordbot|whatsapp|telegrambot|skypeuripreview|vkshare|w3c_validator|preview/i;

export function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function isBotUserAgent(ua) {
  return typeof ua === "string" && ua.length > 0 && BOT_UA_RE.test(ua);
}

export function isMetricEvent(name) {
  return EVENT_SET.has(name);
}

/** @returns {string[]} KV keys to bump for this event + props */
export function metricKeys(event, props = {}, day = utcDayKey()) {
  if (!EVENT_SET.has(event)) return [];
  const keys = [`metrics:${event}:${day}`];
  if (event === "run_completed") {
    const mode = MODES.has(props.mode) ? props.mode : null;
    const result = RESULTS.has(props.result) ? props.result : null;
    if (mode && result) keys.push(`metrics:run_completed:${mode}:${result}:${day}`);
  }
  if (event === "share_clicked") {
    const channel = CHANNELS.has(props.channel) ? props.channel : null;
    if (channel) keys.push(`metrics:share_clicked:${channel}:${day}`);
  }
  return keys;
}

export async function bumpKeys(keys) {
  for (const key of keys) {
    const n = await kv.incr(key);
    if (n === 1) await kv.expire(key, METRICS_TTL_SEC);
  }
}

export async function recordMetric(event, props = {}) {
  const keys = metricKeys(event, props);
  if (!keys.length) return false;
  await bumpKeys(keys);
  return true;
}

function dayOffset(fromDay, delta) {
  const d = new Date(`${fromDay}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function daysBack(n, end = utcDayKey()) {
  const days = [];
  for (let i = n - 1; i >= 0; i -= 1) days.push(dayOffset(end, -i));
  return days;
}

async function readCount(key) {
  const v = await kv.get(key);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Aggregate counters for the last `days` UTC days.
 * Breakdown covers known mode/result and share channel dimensions only.
 */
export async function aggregateMetrics(days = 7) {
  const n = Math.max(1, Math.min(90, Math.round(Number(days) || 7)));
  const dayList = daysBack(n);
  const totals = Object.fromEntries(METRIC_EVENTS.map((e) => [e, 0]));
  const daily = [];
  const runBreakdown = {};
  const shareChannels = {};

  for (const day of dayList) {
    const row = { day };
    for (const event of METRIC_EVENTS) {
      const c = await readCount(`metrics:${event}:${day}`);
      row[event] = c;
      totals[event] += c;
    }
    daily.push(row);

    for (const mode of MODES) {
      for (const result of RESULTS) {
        const c = await readCount(`metrics:run_completed:${mode}:${result}:${day}`);
        if (!c) continue;
        const k = `${mode}:${result}`;
        runBreakdown[k] = (runBreakdown[k] || 0) + c;
      }
    }
    for (const channel of CHANNELS) {
      const c = await readCount(`metrics:share_clicked:${channel}:${day}`);
      if (!c) continue;
      shareChannels[channel] = (shareChannels[channel] || 0) + c;
    }
  }

  const completed = totals.run_completed;
  const shared = totals.share_clicked;
  const viewed = totals.shared_result_viewed;
  const opened = totals.shared_result_opened;

  return {
    days: n,
    from: dayList[0],
    to: dayList[dayList.length - 1],
    totals,
    daily,
    rates: {
      share_rate: completed > 0 ? Math.round((shared / completed) * 1000) / 1000 : null,
      shared_link_ctr: viewed > 0 ? Math.round((opened / viewed) * 1000) / 1000 : null,
    },
    breakdown: {
      run_completed: runBreakdown,
      share_clicked: shareChannels,
    },
  };
}

export function sanitizeTrackBody(body) {
  const event = String(body?.event || "").trim();
  if (!EVENT_SET.has(event)) return null;
  const out = { event };
  if (MODES.has(body?.mode)) out.mode = body.mode;
  if (RESULTS.has(body?.result)) out.result = body.result;
  if (CHANNELS.has(body?.channel)) out.channel = body.channel;
  // runId is accepted for forward-compat but never persisted (avoid per-id key growth).
  return out;
}

function rate(num, den) {
  if (!den) return null;
  return Math.round((num / den) * 1000) / 1000;
}

/**
 * Admin UI payload: daily rows with result categories + derived rates.
 * Missing KV keys read as 0.
 */
export async function adminAggregateMetrics(days = 7) {
  const n = Math.max(1, Math.min(90, Math.round(Number(days) || 7)));
  const dayList = daysBack(n);
  const totals = {
    run_completed: 0,
    run_completed_sweep: 0,
    run_completed_champion: 0,
    run_completed_eliminated: 0,
    share_clicked: 0,
    shared_result_viewed: 0,
    shared_result_opened: 0,
    came_from_share: 0,
  };
  const daily = [];

  for (const day of dayList) {
    const run_completed = await readCount(`metrics:run_completed:${day}`);
    const share_clicked = await readCount(`metrics:share_clicked:${day}`);
    const shared_result_viewed = await readCount(`metrics:shared_result_viewed:${day}`);
    const shared_result_opened = await readCount(`metrics:shared_result_opened:${day}`);
    const came_from_share = await readCount(`metrics:came_from_share:${day}`);

    let run_completed_sweep = 0;
    let run_completed_champion = 0;
    let run_completed_eliminated = 0;
    for (const mode of MODES) {
      run_completed_sweep += await readCount(`metrics:run_completed:${mode}:sweep:${day}`);
      run_completed_champion += await readCount(`metrics:run_completed:${mode}:champion:${day}`);
      run_completed_eliminated += await readCount(`metrics:run_completed:${mode}:eliminated:${day}`);
    }

    const row = {
      date: day,
      run_completed,
      run_completed_sweep,
      run_completed_champion,
      run_completed_eliminated,
      share_clicked,
      shared_result_viewed,
      shared_result_opened,
      came_from_share,
      shareRate: rate(share_clicked, run_completed),
      resultCTR: rate(shared_result_opened, shared_result_viewed),
    };
    daily.push(row);

    totals.run_completed += run_completed;
    totals.run_completed_sweep += run_completed_sweep;
    totals.run_completed_champion += run_completed_champion;
    totals.run_completed_eliminated += run_completed_eliminated;
    totals.share_clicked += share_clicked;
    totals.shared_result_viewed += shared_result_viewed;
    totals.shared_result_opened += shared_result_opened;
    totals.came_from_share += came_from_share;
  }

  return {
    range: { from: dayList[0], to: dayList[dayList.length - 1], days: n },
    daily,
    totals,
    derived: {
      shareRate: rate(totals.share_clicked, totals.run_completed),
      resultCTR: rate(totals.shared_result_opened, totals.shared_result_viewed),
    },
  };
}
