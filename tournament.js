/** Headless World Cup path: gauntlet, tables, eight games. No DOM, no Dream Team. */
import { TEAMS, SLOTS, ROUNDS } from "./teams.js";
import { teamRating } from "./teams.js";
import { simGameWithTraits, boxScore } from "./sim.js";
import { rng, shuffleWith, efficiencyFrom } from "./daily.js";

export function lineupOvr(lineup) {
  const filled = SLOTS.filter((s) => lineup?.[s]);
  if (!filled.length) return 0;
  return filled.reduce((s, k) => s + (lineup[k]?.rt || 0), 0) / filled.length;
}

export function buildGauntlet(rand) {
  const avgRt = TEAMS.reduce((s, t) => s + teamRating(t), 0) / TEAMS.length;
  const elite = TEAMS.filter((t) => teamRating(t) >= avgRt);
  const knockouts = shuffleWith(elite, rand).slice(0, 3).sort((a, b) => teamRating(a) - teamRating(b));
  const rest = shuffleWith(TEAMS.filter((t) => !knockouts.includes(t)), rand).slice(0, 5);
  return [...rest, ...knockouts];
}

export function neutralGame(ta, tb, rand = Math.random) {
  const d = (teamRating(ta) - teamRating(tb)) * 1.15;
  const noise = () => (rand() - 0.5) * 22;
  let sa = Math.round(86 + d / 2 + noise());
  let sb = Math.round(86 - d / 2 + noise());
  if (sa === sb) sa += 2;
  return { sa: Math.max(58, sa), sb: Math.max(58, sb) };
}

export function buildDailyBracket(day) {
  const g8 = buildGauntlet(rng(day, "gauntlet"));
  const rivals = g8.slice(0, 3);
  const rivalGames = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => {
    const r = neutralGame(rivals[a], rivals[b], rng(day, "neutral", "g", a, b));
    return { a, b, sa: r.sa, sb: r.sb };
  });
  return { gauntlet: g8, rivalGames };
}

export function computeGroupTable(played, gauntlet, rivalGames) {
  if (played.length < 3 || !gauntlet.length) return null;
  const rows = [
    { id: "me", name: "YOUR FIVE", c: "#E8465A", w: 0, l: 0, pf: 0, pa: 0 },
    ...gauntlet.slice(0, 3).map((t, i) => ({
      id: i, name: `${t.name} '${t.season.slice(2)}`, c: t.c, w: 0, l: 0, pf: 0, pa: 0,
    })),
  ];
  const get = (id) => rows.find((r) => r.id === id);
  const add = (idA, idB, sa, sb) => {
    const A = get(idA);
    const B = get(idB);
    A.pf += sa; A.pa += sb; B.pf += sb; B.pa += sa;
    if (sa > sb) { A.w++; B.l++; } else { B.w++; A.l++; }
  };
  played.slice(0, 3).forEach((g, i) => add("me", i, g.my, g.op));
  rivalGames.forEach((rg) => add(rg.a, rg.b, rg.sa, rg.sb));
  rows.forEach((r) => { r.pts = r.w * 2 + r.l; r.diff = r.pf - r.pa; });
  rows.sort((x, y) => y.pts - x.pts || y.diff - x.diff || y.pf - x.pf);
  return rows;
}

export function setupSecondRound(played, table, gauntlet, day) {
  const coIdx = table.slice(0, 2).find((r) => r.id !== "me").id;
  const rival = gauntlet[coIdx];
  const carried = { my: played[coIdx].my, op: played[coIdx].op };
  const A = gauntlet[3];
  const B = gauntlet[4];
  const n = (lane) => rng(day, "neutral", lane);
  return {
    rival, coIdx, carried,
    abCarry: neutralGame(A, B, n("ab")),
    rivalVsA: neutralGame(rival, A, n("rA")),
    rivalVsB: neutralGame(rival, B, n("rB")),
  };
}

export function computeR2Table(played, gauntlet, r2) {
  if (!r2 || played.length < 5) return null;
  const A = gauntlet[3];
  const B = gauntlet[4];
  const rows = [
    { id: "me", name: "YOUR FIVE", c: "#E8465A", w: 0, l: 0, pf: 0, pa: 0 },
    { id: "riv", name: `${r2.rival.name} '${r2.rival.season.slice(2)}`, c: r2.rival.c, w: 0, l: 0, pf: 0, pa: 0 },
    { id: "A", name: `${A.name} '${A.season.slice(2)}`, c: A.c, w: 0, l: 0, pf: 0, pa: 0 },
    { id: "B", name: `${B.name} '${B.season.slice(2)}`, c: B.c, w: 0, l: 0, pf: 0, pa: 0 },
  ];
  const get = (id) => rows.find((r) => r.id === id);
  const add = (idA, idB, sa, sb) => {
    const X = get(idA);
    const Y = get(idB);
    X.pf += sa; X.pa += sb; Y.pf += sb; Y.pa += sa;
    if (sa > sb) { X.w++; Y.l++; } else { Y.w++; X.l++; }
  };
  add("me", "riv", r2.carried.my, r2.carried.op);
  add("A", "B", r2.abCarry.sa, r2.abCarry.sb);
  add("me", "A", played[3].my, played[3].op);
  add("me", "B", played[4].my, played[4].op);
  add("riv", "A", r2.rivalVsA.sa, r2.rivalVsA.sb);
  add("riv", "B", r2.rivalVsB.sa, r2.rivalVsB.sb);
  rows.forEach((r) => { r.pts = r.w * 2 + r.l; r.diff = r.pf - r.pa; });
  rows.sort((x, y) => y.pts - x.pts || y.diff - x.diff || y.pf - x.pf);
  return rows;
}

function slimOpp(t) {
  return { name: t.name, season: t.season, c: t.c, alt: t.alt || null };
}

function slimBox(box) {
  return (box || []).map((b) => ({ name: b.name, n: b.n, pts: b.pts, pos: b.pos, rt: b.rt }));
}

/**
 * Play the daily eight-game path with a seeded sim RNG.
 * Does not face the Dream Team. Returns enough to render a Tournament Card.
 */
export function playDailyTournament({ lineup, style, day, simRand }) {
  const { gauntlet, rivalGames } = buildDailyBracket(day);
  const lu = SLOTS.map((s) => lineup[s]).filter(Boolean);
  const myRt = lineupOvr(lineup);
  const games = [];
  let groupOut = false;
  let r2Out = false;
  let r2 = null;

  for (let gi = 0; gi < 8; gi++) {
    const g = simGameWithTraits(lu, myRt, style, gauntlet[gi], gi, games.length, simRand);
    const box = boxScore(lu, g.my, simRand);
    games.push({
      my: g.my, op: g.op, round: ROUNDS[gi],
      opp: slimOpp(gauntlet[gi]),
      box: slimBox(box),
    });

    if (gi === 2) {
      const table = computeGroupTable(games, gauntlet, rivalGames);
      const myRank = table.findIndex((r) => r.id === "me") + 1;
      if (myRank > 2) { groupOut = true; break; }
      r2 = setupSecondRound(games, table, gauntlet, day);
    } else if (gi === 4) {
      const table = computeR2Table(games, gauntlet, r2);
      const myRank = table.findIndex((r) => r.id === "me") + 1;
      if (myRank > 2) { r2Out = true; break; }
    } else if (gi >= 5 && g.my < g.op) {
      break;
    }
  }

  const w = games.filter((g) => g.my > g.op).length;
  const l = games.length - w;
  const perfect = games.length === 8 && games.every((g) => g.my > g.op);
  const margins = games.map((g) => g.my - g.op);
  const ovr = Math.round(myRt);
  return {
    games, w, l, perfect, groupOut, r2Out, margins, ovr,
    efficiency: efficiencyFrom(margins, ovr, null),
    styleId: style.id,
  };
}
