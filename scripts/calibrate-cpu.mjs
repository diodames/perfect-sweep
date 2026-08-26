/** Calibrate CPU drafters across 200 UTC days. Tune so the top CPU sits near p80. */
import { PERSISTENT_BOTS, ROTATING_BOTS, daysRoster, runCpuBot, draftWithBot } from "../cpuDrafters.js";
import { playDailyTournament } from "../tournament.js";
import { STYLES } from "../teams.js";
import { rng, utcDayKey, dailyNumber, DAILY_EPOCH } from "../daily.js";

const DAYS = Number(process.argv[2]) || 200;

function dayFromOffset(i) {
  const [y, m, d] = DAILY_EPOCH.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + i));
  return utcDayKey(dt);
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}

function randomLegalBot(day, i) {
  const rand = rng(day, "cpu", "envelope", i);
  const base = PERSISTENT_BOTS[Math.floor(rand() * PERSISTENT_BOTS.length)];
  return {
    ...base,
    id: `env${i}`,
    name: `Envelope ${i}`,
    persistent: false,
    blunder: 0.04 + rand() * 0.12,
  };
}

function stats(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return {
    n: s.length,
    median: +quantile(s, 0.5).toFixed(3),
    p20: +quantile(s, 0.2).toFixed(3),
    p80: +quantile(s, 0.8).toFixed(3),
    min: +s[0].toFixed(3),
    max: +s[s.length - 1].toFixed(3),
  };
}

const perBot = new Map();
const topCpuPct = [];
const topVsP80 = [];
const topName = new Map();
let topBeatsOracle = 0;

const t0 = Date.now();
for (let i = 0; i < DAYS; i++) {
  const day = dayFromOffset(i);
  const roster = daysRoster(day);
  const cpu = roster.map((bot) => runCpuBot(day, bot));
  for (const r of cpu) {
    if (!perBot.has(r.botId)) perBot.set(r.botId, []);
    perBot.get(r.botId).push(r.efficiency);
  }
  const ranked = [...cpu].sort((a, b) => b.efficiency - a.efficiency || b.w - a.w);
  const top = ranked[0];
  topName.set(top.botId, (topName.get(top.botId) || 0) + 1);

  const oracles = [];
  for (const base of PERSISTENT_BOTS) {
    const oracle = { ...base, id: `or-${base.id}`, blunder: 0, persistent: false };
    const drafted = draftWithBot(day, oracle);
    oracles.push(playDailyTournament({
      lineup: drafted.lineup,
      style: STYLES.find((s) => s.id === base.styleId) || STYLES[1],
      day,
      simRand: rng(day, "cpu", oracle.id, "sim"),
    }).efficiency);
  }
  const bestOracle = Math.max(...oracles);
  const envelope = [];
  for (let k = 0; k < 36; k++) {
    envelope.push(runCpuBot(day, randomLegalBot(day, k)).efficiency);
  }
  envelope.sort((a, b) => a - b);
  const idx = envelope.filter((x) => x <= top.efficiency).length;
  topCpuPct.push(idx / envelope.length);
  topVsP80.push(top.efficiency - quantile(envelope, 0.8));
  if (top.efficiency >= bestOracle) topBeatsOracle++;
}

const elapsed = Date.now() - t0;
const pct = stats(topCpuPct.map((x) => x * 100));

console.log(JSON.stringify({
  days: DAYS,
  ms: elapsed,
  topCpuPercentile: pct,
  topMinusEnvelopeP80: stats(topVsP80),
  topBeatsOracleRate: +(topBeatsOracle / DAYS).toFixed(3),
  boardTopShare: Object.fromEntries(
    [...topName.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => [id, +((n / DAYS) * 100).toFixed(1)]),
  ),
  bots: Object.fromEntries(
    [...PERSISTENT_BOTS, ...ROTATING_BOTS].map((bot) => {
      const arr = perBot.get(bot.id) || [];
      return [bot.name, arr.length ? stats(arr) : { n: 0 }];
    }),
  ),
}, null, 2));

const p80 = pct.median;
if (p80 < 65 || p80 > 92) {
  console.warn(`warn: top CPU median percentile ${p80} is outside 65–92 (target ~80)`);
}
const hog = [...topName.entries()].sort((a, b) => b[1] - a[1])[0];
if (hog && hog[1] / DAYS > 0.25) {
  console.warn(`warn: ${hog[0]} tops the CPU board ${(100 * hog[1] / DAYS).toFixed(1)}% of days (cap 25%)`);
}
