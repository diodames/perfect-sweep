/** Smoke: CPU drafters are deterministic, headless, and never touch the Hall of Fame. */
import { utcDayKey, compareDailyEntries } from "../daily.js";
import { cpuRunsForDay, mixDailyBoard, runCpuBot, daysRoster, PERSISTENT_BOTS } from "../cpuDrafters.js";
import { playDailyTournament } from "../tournament.js";
import { STYLES } from "../teams.js";
import { rng } from "../daily.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const day = "2026-08-26";
const a = daysRoster(day).map((bot) => runCpuBot(day, bot));
const b = daysRoster(day).map((bot) => runCpuBot(day, bot));
assert(a.length >= 8 && a.length <= 10, `roster size ${a.length}`);
assert(JSON.stringify(a.map((r) => ({ id: r.id, nick: r.nick, w: r.w, l: r.l, efficiency: r.efficiency, at: r.at })))
  === JSON.stringify(b.map((r) => ({ id: r.id, nick: r.nick, w: r.w, l: r.l, efficiency: r.efficiency, at: r.at }))),
  "same day must match");

for (const r of a) {
  assert(r.cpu === true, `${r.nick} missing cpu flag`);
  assert(r.nick.startsWith("CPU · "), `${r.nick} must be prefixed`);
  assert(r.wc, `${r.nick} missing World Cup label`);
  assert(!r.country, `${r.nick} must not have a country`);
  assert(r.games.every((g) => g.opp?.name !== "DREAM TEAM"), `${r.nick} played Dream Team`);
  assert(Object.keys(r.lineup).length === 5, `${r.nick} incomplete lineup`);
}

assert(a.some((r) => r.nick === "CPU · Mike Krzyzewski"), "Mike Krzyzewski must be on every day's board");

const off = mixDailyBoard([{ id: "h1", nick: "Ada", w: 8, l: 0, perfect: true, ovr: 88, efficiency: 1.2, at: `${day}T01:00:00.000Z` }], a, {
  now: Date.parse(`${day}T23:59:00.000Z`),
  enabled: false,
  targetN: 10,
});
assert(off.every((e) => !e.cpu) && off.length === 1, "flag off must drop every CPU row");

const mixed = mixDailyBoard(
  Array.from({ length: 12 }, (_, i) => ({
    id: `h${i}`, nick: `P${i}`, w: 6, l: 2, perfect: false, ovr: 80, efficiency: 0.4 + i * 0.01, at: `${day}T02:00:00.000Z`,
  })),
  a,
  { now: Date.parse(`${day}T23:59:00.000Z`), enabled: true, targetN: 10 },
);
const cpuN = mixed.filter((e) => e.cpu).length;
const realN = mixed.filter((e) => !e.cpu).length;
assert(cpuN <= realN, `CPU ${cpuN} vs real ${realN} after fade`);
assert(cpuN <= Math.floor(mixed.length / 2) + 0.1, "CPU must not exceed half once humans outnumber");

const bot = PERSISTENT_BOTS[0];
const seeded = playDailyTournament({
  lineup: a[0].lineup,
  style: STYLES.find((s) => s.id === a[0].styleId),
  day,
  simRand: rng(day, "cpu", a[0].botId, "sim"),
});
assert(seeded.efficiency === a[0].efficiency, "replay sim must match stored efficiency");

const sorted = [
  { nick: "wall", w: 5, l: 1, perfect: false, ovr: 84, efficiency: 0.51, at: `${day}T01:00:00.000Z` },
  { nick: "star", w: 4, l: 2, perfect: false, ovr: 87, efficiency: 0.59, at: `${day}T01:00:00.000Z` },
  { nick: "opt", w: 1, l: 2, perfect: false, ovr: 87, efficiency: 0.08, at: `${day}T01:00:00.000Z` },
  { nick: "era", w: 2, l: 1, perfect: false, ovr: 88, efficiency: 0.06, at: `${day}T01:00:00.000Z` },
  { nick: "inv", w: 1, l: 2, perfect: false, ovr: 83, efficiency: -0.42, at: `${day}T01:00:00.000Z` },
  { nick: "slot", w: 0, l: 3, perfect: false, ovr: 87, efficiency: -0.38, at: `${day}T01:00:00.000Z` },
].sort(compareDailyEntries);
assert(sorted.map((e) => e.nick).join(",") === "star,wall,opt,era,slot,inv", `efficiency-first order: ${sorted.map((e) => e.nick)}`);

const today = utcDayKey();
const cached = cpuRunsForDay(today);
assert(cpuRunsForDay(today) === cached, "cache hits");

console.log("verify-cpu ok", { day, n: a.length, names: a.map((r) => r.nick), cpuAfter12: cpuN });
