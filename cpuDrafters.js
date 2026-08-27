/** CPU drafters for the Daily Challenge board. Client-derived from the date seed. */
import { TEAMS, SLOTS, STYLES } from "./teams.js";
import { playerTraits, isPaintBig, isSoftGuard, canSplashThree } from "./sim.js";
import { playDailyTournament, lineupOvr } from "./tournament.js";
import {
  rng, shuffleWith, isValidDayKey, utcDayAt, compareDailyEntries, serializeLineup,
  CPU_TARGET_N_DEFAULT,
} from "./daily.js";

export { CPU_TARGET_N_DEFAULT, CPU_FLAG_KEY, CPU_N_KEY } from "./daily.js";

const MAX_ROLLS = 48;
const STAR_TIER = 87;
const SLOT_GAP = 3;

const DEF_TRAITS = new Set(["greatWall", "theRussian", "twoWayTerror", "goldMedalDna"]);
const OFF_TRAITS = new Set([
  "flameThrower", "pointGame42", "chaosEnergy", "fibaLegend", "unicorn",
  "theTower", "risingSun", "secondHalfBeast", "mrImportant",
]);
const DEF_PENALTY = new Set(["hackAShaq", "flopCity", "foulTrouble", "softGuard"]);

function styleById(id) {
  return STYLES.find((s) => s.id === id) || STYLES[1];
}

function eligiblePlayers(team, lineup) {
  return (team?.players || []).filter((p) => !lineup[p.pos] && !SLOTS.some((s) => lineup[s]?.name === p.name));
}

function filledCount(lineup) {
  return SLOTS.filter((s) => lineup[s]).length;
}

function nationPool(cur, seenNations) {
  return TEAMS.filter((t) => t.season === cur.season && !seenNations.includes(t.name));
}

function yearPool(cur, seenYears) {
  return TEAMS.filter((t) => t.name === cur.name && !seenYears.includes(t.season));
}

function bestRt(players) {
  if (!players.length) return -Infinity;
  return Math.max(...players.map((p) => p.rt));
}

function applyBlunder(ranked, rate, rand) {
  if (!ranked.length) return null;
  if (ranked.length < 2 || rand() >= rate) return ranked[0];
  const pickSecond = ranked.length < 3 || rand() < 0.55;
  return ranked[pickSecond ? 1 : 2];
}

function signPlayer(lineup, team, p) {
  lineup[p.pos] = { ...p, team: team.name, season: team.season, tc: team.c };
}

function scoreRt(p) {
  return p.rt;
}

function scoreCoachK(p) {
  let s = p.rt;
  for (const id of playerTraits(p)) {
    if (DEF_TRAITS.has(id)) s += 2;
    if (DEF_PENALTY.has(id)) s -= 2;
  }
  return s;
}

function scoreScarce(p, eligible, invert = false) {
  const counts = {};
  for (const e of eligible) counts[e.pos] = (counts[e.pos] || 0) + 1;
  const scarcity = invert ? (counts[p.pos] || 0) : 8 - (counts[p.pos] || 0);
  return scarcity * 100 + Math.round(p.rt / SLOT_GAP) * SLOT_GAP;
}

function scoreWall(p) {
  let s = p.rt;
  for (const id of playerTraits(p)) {
    if (DEF_TRAITS.has(id)) s += 5;
    if (DEF_PENALTY.has(id)) s -= 3;
  }
  if (isPaintBig(p) || p.pos === "C" || p.pos === "PF") s += 3;
  if (isSoftGuard(p)) s -= 4;
  return s;
}

function scoreTempo(p) {
  let s = p.rt;
  for (const id of playerTraits(p)) {
    if (OFF_TRAITS.has(id)) s += 5;
  }
  if (canSplashThree(p)) s += 2;
  if (p.stretch) s += 3;
  if (p.pos === "PG" || p.pos === "SG" || p.pos === "SF") s += 2;
  if (isPaintBig(p)) s -= 4;
  return s;
}

function scoreHomer(p, home) {
  return p.rt + (p.team === home || home && p._nation === home ? 8 : 0);
}

function scoreEra(p, minY, maxY) {
  const y = Number(p._season);
  if (y >= minY && y <= maxY) return p.rt + 12;
  return p.rt - 8;
}

function rankEligible(eligible, team, bot, homeNation) {
  const tagged = eligible.map((p) => ({ ...p, _nation: team.name, _season: team.season }));
  const scoreOf = (p) => {
    switch (bot.heuristic) {
      case "optimizer": return scoreRt(p);
      case "coachk": return scoreCoachK(p);
      case "filler": return scoreScarce(p, tagged, !!bot.invertSlots);
      case "star": return scoreRt(p);
      case "wall": return scoreWall(p);
      case "tempo": return scoreTempo(p);
      case "homer": return scoreHomer(p, homeNation);
      case "era": return scoreEra(p, bot.eraMin ?? 1986, bot.eraMax ?? 2000);
      case "year": return scoreEra(p, bot.eraMin ?? 2023, bot.eraMax ?? 2023);
      case "paint": return scoreRt(p) + ((p.pos === "C" || p.pos === "PF") ? 10 : 0);
      default: return scoreRt(p);
    }
  };
  return tagged
    .map((p) => ({ p, s: scoreOf(p) }))
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name) || a.p.n - b.p.n)
    .map((x) => x.p);
}

function doSwap(kind, cur, seenNations, seenYears, day) {
  if (kind === "nation") {
    const pool = nationPool(cur, seenNations);
    if (!pool.length) return null;
    const t = shuffleWith(pool, rng(day, "swapNation", seenNations.length))[0];
    return { team: t, seenNations: [...seenNations, t.name], seenYears };
  }
  const pool = yearPool(cur, seenYears);
  if (!pool.length) return null;
  const t = shuffleWith(pool, rng(day, "swapYear", seenYears.length))[0];
  return { team: t, seenNations, seenYears: [...seenYears, t.season] };
}

function wantSwap(bot, { lineup, eligible, swapsLeft, filled, rolls }) {
  if (swapsLeft <= 0) return null;
  if (bot.swap === "never") return null;

  if (bot.swap === "immediate") return "nation-then-year";
  if (bot.swap === "early") {
    return bestRt(eligible) < (bot.starTier ?? STAR_TIER) ? "best-pool" : null;
  }
  if (bot.swap === "mid") {
    if (filled >= 2 && filled < 5 && rolls >= 3) {
      const needBig = !lineup.C || !lineup.PF;
      const hasBig = eligible.some((p) => p.pos === "C" || p.pos === "PF");
      if (needBig && !hasBig) return "best-pool";
    }
    return null;
  }
  if (bot.swap === "late") {
    if (filled >= 4) {
      const open = SLOTS.find((s) => !lineup[s]);
      if (open && !eligible.some((p) => p.pos === open)) return "best-pool";
    }
    return null;
  }
  return null;
}

function chooseSwapKind(cur, lineup, seenNations, seenYears) {
  const nPool = nationPool(cur, seenNations);
  const yPool = yearPool(cur, seenYears);
  const curBest = bestRt(eligiblePlayers(cur, lineup));
  let nationBest = -Infinity;
  for (const t of nPool.slice(0, 12)) nationBest = Math.max(nationBest, bestRt(eligiblePlayers(t, lineup)));
  let yearBest = -Infinity;
  for (const t of yPool) yearBest = Math.max(yearBest, bestRt(eligiblePlayers(t, lineup)));
  if (nPool.length && nationBest >= yearBest && nationBest > curBest) return "nation";
  if (yPool.length && yearBest > curBest) return "year";
  if (nPool.length) return "nation";
  if (yPool.length) return "year";
  return null;
}

export function draftWithBot(day, bot, opts = {}) {
  const blunderRand = opts.blunderRand || rng(day, "cpu", bot.id, "blunder");
  const lineup = {};
  let rolls = 0;
  let swapsLeft = 2;
  let seenNations = [];
  let seenYears = [];
  let cur = null;
  let homeNation = null;
  let immediateSwapsDone = false;
  const log = [];

  const rollNext = () => {
    rolls += 1;
    cur = shuffleWith(TEAMS, rng(day, "roll", rolls))[0];
    seenNations = [cur.name];
    seenYears = [cur.season];
    log.push({ n: rolls, team: cur.name, season: cur.season, action: "roll" });
  };

  rollNext();

  while (filledCount(lineup) < 5 && rolls < MAX_ROLLS) {
    let eligible = eligiblePlayers(cur, lineup);
    if (!eligible.length) {
      rollNext();
      continue;
    }

    const filled = filledCount(lineup);
    let plan = wantSwap(bot, { lineup, eligible, swapsLeft, filled, rolls });
    if (plan === "nation-then-year" && !immediateSwapsDone) {
      immediateSwapsDone = true;
      for (const kind of ["nation", "year"]) {
        if (swapsLeft <= 0) break;
        const swapped = doSwap(kind, cur, seenNations, seenYears, day);
        if (!swapped) continue;
        cur = swapped.team;
        seenNations = swapped.seenNations;
        seenYears = swapped.seenYears;
        swapsLeft -= 1;
        homeNation = cur.name;
        log.push({ n: rolls, team: cur.name, season: cur.season, action: kind === "nation" ? "swapNation" : "swapYear" });
      }
      eligible = eligiblePlayers(cur, lineup);
      if (!eligible.length) { rollNext(); continue; }
    } else {
      while (plan === "best-pool" && swapsLeft > 0) {
        const kind = chooseSwapKind(cur, lineup, seenNations, seenYears);
        const swapped = kind ? doSwap(kind, cur, seenNations, seenYears, day) : null;
        if (!swapped) break;
        cur = swapped.team;
        seenNations = swapped.seenNations;
        seenYears = swapped.seenYears;
        swapsLeft -= 1;
        log.push({ n: rolls, team: cur.name, season: cur.season, action: kind === "nation" ? "swapNation" : "swapYear" });
        eligible = eligiblePlayers(cur, lineup);
        if (!eligible.length) break;
        plan = wantSwap(bot, { lineup, eligible, swapsLeft, filled, rolls });
      }
      if (!eligible.length) { rollNext(); continue; }
    }

    if (!homeNation && bot.heuristic === "homer") homeNation = cur.name;

    const ranked = rankEligible(eligible, cur, bot, homeNation);
    const pick = applyBlunder(ranked, bot.blunder, blunderRand);
    signPlayer(lineup, cur, pick);
    log.push({
      n: rolls, team: cur.name, season: cur.season, action: "sign",
      player: pick.name, pos: pick.pos, rt: pick.rt,
    });

    if (filledCount(lineup) < 5) rollNext();
  }

  return { lineup, rolls, swapsLeft, log, homeNation };
}

/** World Cup national-team coaches, matched to how each bot drafts. Ids stay stable for the date seed. */
export const PERSISTENT_BOTS = [
  { id: "optimizer", name: "Mike Krzyzewski", wc: "USA 2006–14", heuristic: "coachk", styleId: "run", swap: "early", blunder: 0.02, persistent: true },
  { id: "filler", name: "Sergio Scariolo", wc: "Spain 2019", heuristic: "filler", styleId: "bal", swap: "late", blunder: 0.10, persistent: true },
  { id: "star", name: "Don Nelson", wc: "USA 1994", heuristic: "star", styleId: "run", swap: "early", blunder: 0.22, persistent: true },
  { id: "wall", name: "Željko Obradović", wc: "Yugoslavia 1998", heuristic: "wall", styleId: "lock", swap: "mid", blunder: 0.10, persistent: true },
  { id: "tempo", name: "Ergin Ataman", wc: "Turkey 2014", heuristic: "tempo", styleId: "run", swap: "never", blunder: 0.26, persistent: true },
  { id: "homer", name: "Pepu Hernández", wc: "Spain 2006", heuristic: "homer", styleId: "bal", swap: "immediate", blunder: 0.10, persistent: true },
];

export const ROTATING_BOTS = [
  { id: "sloppy", name: "Gianmarco Pozzecco", wc: "Italy 2023", heuristic: "optimizer", styleId: "bal", swap: "never", blunder: 0.32 },
  { id: "inverted", name: "Nick Nurse", wc: "Canada 2019", heuristic: "filler", styleId: "bal", swap: "late", blunder: 0.20, invertSlots: true },
  { id: "era", name: "Dušan Ivković", wc: "Yugoslavia 1990", heuristic: "era", styleId: "bal", swap: "early", blunder: 0.18, eraMin: 1986, eraMax: 2000 },
  { id: "mismatch", name: "George Karl", wc: "USA 2002", heuristic: "wall", styleId: "run", swap: "mid", blunder: 0.28 },
  { id: "coldlock", name: "Gregg Popovich", wc: "USA 2019", heuristic: "tempo", styleId: "lock", swap: "never", blunder: 0.24 },
  { id: "chaserx", name: "Jordi Fernández", wc: "Canada 2023", heuristic: "star", styleId: "run", swap: "early", blunder: 0.36, starTier: 92 },
  { id: "tourist", name: "Svetislav Pešić", wc: "Yugoslavia 2002", heuristic: "homer", styleId: "bal", swap: "immediate", blunder: 0.24 },
  { id: "panic", name: "Juan Antonio Orenga", wc: "Spain 2014", heuristic: "filler", styleId: "lock", swap: "late", blunder: 0.26 },
  { id: "twenty3", name: "Gordon Herbert", wc: "Germany 2023", heuristic: "year", styleId: "bal", swap: "early", blunder: 0.18, eraMin: 2023, eraMax: 2023 },
  { id: "paint", name: "Vincent Collet", wc: "France 2019", heuristic: "paint", styleId: "lock", swap: "mid", blunder: 0.16 },
];

export function cpuDisplayName(bot) {
  return `CPU · ${bot.name}`;
}

export function daysRoster(day) {
  const nRot = 2 + Math.floor(rng(day, "cpu", "rotCount")() * 3);
  const shuffled = shuffleWith(ROTATING_BOTS, rng(day, "cpu", "rotating"));
  return [...PERSISTENT_BOTS, ...shuffled.slice(0, nRot)];
}

function botPostAt(day, botId) {
  const rand = rng(day, "cpu", "reveal", botId);
  const skewed = rand() ** 1.55;
  const sec = 120 + Math.floor(skewed * 85800);
  return utcDayAt(day, sec);
}

export function runCpuBot(day, bot) {
  const { lineup, rolls, log, homeNation } = draftWithBot(day, bot);
  const style = styleById(bot.styleId);
  const simRand = rng(day, "cpu", bot.id, "sim");
  const result = playDailyTournament({ lineup, style, day, simRand });
  const ovr = Math.round(lineupOvr(lineup));
  return {
    id: `cpu:${day}:${bot.id}`,
    cpu: true,
    botId: bot.id,
    persistent: !!bot.persistent,
    nick: cpuDisplayName(bot),
    blurb: bot.wc || bot.name,
    wc: bot.wc || null,
    w: result.w,
    l: result.l,
    perfect: result.perfect,
    ovr: result.ovr || ovr,
    efficiency: result.efficiency,
    at: botPostAt(day, bot.id),
    styleId: style.id,
    rolls,
    groupOut: result.groupOut,
    r2Out: result.r2Out,
    margins: result.margins,
    lineup: serializeLineup(lineup),
    games: result.games,
    log,
    homeNation: homeNation || null,
    country: null,
    runId: null,
  };
}

const _cache = new Map();

export function cpuRunsForDay(day) {
  if (!isValidDayKey(day)) return [];
  if (_cache.has(day)) return _cache.get(day);
  const runs = daysRoster(day).map((bot) => runCpuBot(day, bot));
  _cache.set(day, runs);
  return runs;
}

export function visibleCpuRuns(runs, { now = Date.now(), realCount = 0, targetN = CPU_TARGET_N_DEFAULT } = {}) {
  let cpu = (runs || []).filter((r) => {
    const t = Date.parse(r.at);
    return Number.isFinite(t) && t <= now;
  });
  if (realCount >= targetN) {
    cpu = [...cpu].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }
  const extra = Math.max(0, realCount - targetN);
  if (extra > 0) {
    cpu = [...cpu].sort(compareDailyEntries);
    cpu = cpu.slice(0, Math.max(0, cpu.length - extra));
  }
  if (realCount > cpu.length) {
    const maxCpu = Math.floor((realCount + cpu.length) / 2);
    if (cpu.length > maxCpu) cpu = [...cpu].sort(compareDailyEntries).slice(0, maxCpu);
  }
  return cpu;
}

export function mixDailyBoard(realEntries, cpuRuns, opts = {}) {
  const now = opts.now ?? Date.now();
  const targetN = opts.targetN ?? CPU_TARGET_N_DEFAULT;
  const enabled = opts.enabled !== false;
  const real = (realEntries || []).map((e) => ({ ...e, cpu: false }));
  if (!enabled) {
    return [...real].sort(compareDailyEntries).map((e, i) => ({ ...e, rank: i + 1 }));
  }
  const cpu = visibleCpuRuns(cpuRuns, { now, realCount: real.length, targetN });
  const mixed = [...real, ...cpu].sort(compareDailyEntries);
  return mixed.map((e, i) => ({ ...e, rank: i + 1 }));
}
