/** Headless game simulation. All scoring RNGs are injectable via `rand`. */
import { SLOTS, teamRating } from "./teams.js";

export function simGame(myRt, style, opp, roundIdx, rand = Math.random) {
  const oppRt = teamRating(opp) - 4 + rand() * 4 + roundIdx * 0.8;
  const base = 86 + style.pace;
  const diff = (myRt + style.off - oppRt) * 1.15;
  const noise = () => (rand() - 0.5) * 22;
  let my = Math.round(base + diff / 2 + style.off + noise());
  let op = Math.round(base - diff / 2 - style.def + noise());
  my = Math.max(58, my); op = Math.max(58, op);
  return { my, op, opp, myQ: splitQ(my, rand), opQ: splitQ(op, rand) };
}

/* FIBA overtime: 5 minutes per period until someone leads */
export function simOvertimePeriod(myRt, style, oppRt, rand = Math.random) {
  const diff = (myRt + style.off - oppRt) * 0.7;
  const noise = () => (rand() - 0.5) * 10;
  const myOT = Math.max(0, Math.round(11 + diff / 4 + noise()));
  const opOT = Math.max(0, Math.round(11 - diff / 4 + noise()));
  return { myOT, opOT };
}

export function resolveOvertime(my, op, myRt, style, oppRt, rand = Math.random) {
  const otMy = [];
  const otOp = [];
  let periods = 0;
  while (my === op && periods < 8) {
    periods++;
    const { myOT, opOT } = simOvertimePeriod(myRt, style, oppRt, rand);
    otMy.push(myOT);
    otOp.push(opOT);
    my += myOT;
    op += opOT;
  }
  if (my === op) my += rand() > 0.5 ? 2 : 1; // safety after 8 OTs
  return { my, op, otMy, otOp, otPeriods: periods };
}

export const splitQ = (tot, rand = Math.random) => {
  let qs = [0, 0, 0, 0].map(() => 0.2 + rand());
  const s = qs.reduce((a, b) => a + b, 0);
  qs = qs.map((q) => Math.round((q / s) * tot));
  qs[3] += tot - qs.reduce((a, b) => a + b, 0);
  return qs;
};

export const qSum = (qs) => qs.reduce((a, b) => a + b, 0);
export const QN = ["Q1", "Q2", "Q3", "Q4"];

/* shift pts into/out of specific quarters; total score changes by delta sum */
export function patchQ(qs, patches) {
  const out = [...qs];
  patches.forEach(({ q, d }) => { out[q] = Math.max(0, out[q] + d); });
  return out;
}

export const TRAIT_DEFS = {
  hackAShaq: {
    label: "HACK-A-SHAQ", pos: false, chance: 0.30,
    desc: "Fouled at the line late when ahead",
    recapNeg: [
      "{player} was hacked relentlessly late — the free-throw parade cost you.",
      "With the lead in hand, {player} couldn't stay on the floor — intentional fouls bled the clock and the score.",
    ],
  },
  playoffFade: {
    label: "PLAYOFF FADE", pos: false, chance: 0.45,
    desc: "Fades as knockouts wear on",
    recapNeg: [
      "{player} went cold down the stretch when it mattered most.",
      "The deeper the tournament got, the more {player} disappeared from the offense.",
    ],
  },
  heroBall: {
    label: "HERO BALL", pos: false, chance: 0.15,
    desc: "Forced midgame shots in tight losses",
    recapNeg: [
      "{player} forced the action in the third and the shots wouldn't fall.",
      "With the game on a knife's edge, {player} went iso-heavy — and paid for it.",
    ],
  },
  brickFactory: {
    label: "BRICK FACTORY", pos: false, chance: 0.10,
    desc: "Forces hero shots that don't fall — empty possessions pile up",
    recapNeg: [
      "{player} hunted every shot and missed nearly all of them — a brick factory that stalled the whole offense.",
      "Iso after iso, nothing went down for {player}. The hero-ball heater never arrived; only airballs and empty trips.",
    ],
  },
  isoBlackHole: {
    label: "ISO BLACK HOLE", pos: false, chance: 0.12,
    desc: "Ball sticks; offense stalls when he hunts",
    recapNeg: [
      "{player} went into iso mode and the ball never came out — the whole offense stalled around him.",
      "One-on-one after one-on-one: {player} became a black hole and the five stopped moving.",
    ],
  },
  refMeltdown: {
    label: "REF MELTDOWN", pos: false, chance: 0.10,
    desc: "Argues with officials — technical energy kills the whole team's rhythm",
    recapNeg: [
      "{player} lost it with the refs — a technical tirade that froze the whole five for two quarters.",
      "After {player}'s meltdown at the officials, the team never got its rhythm back — whistles, dead balls, and cold shots.",
    ],
  },
  goesMissing: {
    label: "GOES MISSING", pos: false, chance: 0.10,
    desc: "Vanishes for a full quarter",
    recapNeg: [
      "{player} vanished in the {qn} quarter and never got going again.",
      "For one entire quarter, {player} was a ghost — no rhythm, no impact.",
    ],
  },
  foulTrouble: {
    label: "FOUL TROUBLE", pos: false, chance: 0.12,
    desc: "Sits midgame with early fouls",
    recapNeg: [
      "{player} picked up fouls early and spent most of the middle quarters on the bench.",
      "Foul trouble had {player} riding the pine through the {qn} and third — your spacing never recovered.",
    ],
  },
  chaosEnergy: {
    label: "CHAOS ENERGY", pos: true, chance: 0.12,
    desc: "Midgame Euro-step burst",
    recapPos: [
      "{player} flipped the game with a chaotic third-quarter burst — Euro-steps, and-ones, pure mayhem.",
      "Out of nowhere, {player} turned the third into a highlight reel and the lead swung.",
    ],
  },
  fibaLegend: {
    label: "FIBA LEGEND", pos: true, chance: 0.15,
    desc: "Sets the tone in Q1",
    recapPos: [
      "{player} set the tone from the opening tip — a first quarter that put {oppN} on their heels.",
    ],
  },
  unicorn: {
    label: "UNICORN", pos: true, chance: 0.18,
    desc: "Stretch spacing in the middle quarters",
    recapPos: [
      "{player} stretched the floor in the middle quarters — impossible to guard at that size.",
      "The unicorn spacing from {player} opened everything up in the second and third.",
    ],
  },
  pointGame42: {
    label: "42-POINT GAME", pos: true, chance: 0.15,
    desc: "Dominates weaker opponents",
    recapPos: [
      "{player} treated this one like a personal scoring record — buckets in every quarter.",
      "Against overmatched opposition, {player} was unstoppable from start to finish.",
    ],
  },
  goldMedalDna: {
    label: "GOLD MEDAL DNA", pos: true, chance: 0.12,
    desc: "Steady scoring every night",
    recapPos: [
      "{player} delivered the steady, winning production that championship teams need.",
    ],
  },
  flameThrower: {
    label: "FLAME THROWER", pos: true, chance: 0.08,
    desc: "Explosive random quarter",
    recapPos: [
      "{player} caught fire in the {qn} quarter — a solo burst that swung the whole game.",
      "One quarter, one player: {player} couldn't miss in the {qn} and the gym felt it.",
    ],
  },
  secondHalfBeast: {
    label: "SECOND HALF BEAST", pos: true, chance: 0.20,
    desc: "Rally when trailing at halftime",
    recapPos: [
      "{player} took over after halftime and dragged your five back into it.",
      "Down at the break, {player} flipped the script in the second half — pure force of will.",
    ],
  },
  elCapitan: {
    label: "EL CAPITÁN", pos: true, chance: 0.15,
    desc: "Clutch fourth quarter when game is close through three",
    recapPos: [
      "{player} took over in the fourth — veteran poise when the game hung in the balance.",
      "With everything on the line, {player} closed it out like a captain should.",
    ],
  },
  mrImportant: {
    label: "MR. IMPORTANT", pos: true, chance: 0.12,
    desc: "Late-game FIBA closer",
    recapPos: [
      "{player} did what he always does in FIBA — showed up when the lights got brightest.",
      "The fourth quarter belonged to {player} — cold-blooded, inevitable, Mr. Important.",
    ],
  },
  greatWall: {
    label: "GREAT WALL", pos: true, chance: 0.12,
    desc: "Early paint dominance",
    recapPos: [
      "{player} walled off the paint early — {oppN} had no answer inside in the first half.",
      "From the opening tip, {player} owned the rim — a Great Wall nobody could breach.",
    ],
  },
  theRussian: {
    label: "THE RUSSIAN", pos: true, chance: 0.15,
    desc: "Two-way lockdown midgame",
    recapPos: [
      "{player} did The Russian thing — blocks, help D, and quiet points that put {oppN} in a vice.",
      "Two-way hell: {player} erased the first half for {oppN} while still finding buckets himself.",
    ],
  },
  twoWayTerror: {
    label: "TWO-WAY TERROR", pos: true, chance: 0.15,
    desc: "Two-way lockdown midgame",
    recapPos: [
      "{player} was a two-way terror — paint dominance and quiet scoring that put {oppN} in a vice.",
      "Both ends: {player} erased the first half for {oppN} while still finding buckets himself.",
    ],
  },
  connector: {
    label: "THE CONNECTOR", pos: true, chance: 0.14,
    desc: "Glue-guy facilitation all game",
    recapPos: [
      "{player} never forced it — just connected every quarter and made the five look smarter.",
      "The Connector effect: {player} kept the offense humming from tip to horn.",
    ],
  },
  risingSun: {
    label: "RISING SUN", pos: true, chance: 0.08,
    desc: "Quiet midrange takeover in Q3",
    recapPos: [
      "{player} rose in the third with that quiet midrange — {oppN} had no answer.",
      "One silent storm in Q3: {player} kept rising until the lead flipped.",
    ],
  },
  theTower: {
    label: "THE TOWER", pos: true, chance: 0.16,
    desc: "Stretch-five punch early and late",
    recapPos: [
      "{player} was The Tower — paint early, stretch threes later, impossible size for {oppN}.",
      "From the rim to the arc, {player} owned the vertical game and cracked the defense open.",
    ],
  },
  glassKnee: {
    label: "GLASS KNEE", pos: false, chance: 0.12,
    desc: "Midgame breakdown from knee issues",
    recapNeg: [
      "{player} couldn't stay on the floor through the middle quarters — the knee just wasn't right.",
      "The burst was still there, but {player}'s knee gave out in the second and third — minutes evaporated.",
    ],
  },
  hotHead: {
    label: "HOT HEAD", pos: false, chance: 0.15,
    desc: "Technical foul derails the third quarter",
    recapNeg: [
      "{player} lost it in the third — a tech foul and the whole rhythm fell apart.",
      "One bad decision cost {player} in the third — ejection energy without the ejection, and the run died.",
    ],
  },
  flopCity: {
    label: "FLOP CITY", pos: false, chance: 0.18,
    desc: "Flopping kills midgame rhythm",
    recapNeg: [
      "{player} spent the middle quarters drawing whistles and killing the flow — nothing ever got in rhythm.",
      "Every drive ended at the ref's whistle — {player}'s flopping turned the second and third into stop-start chaos.",
    ],
  },
};

export const SIGNIFICANT_TRAIT_DELTA = 5;
const rollTrait = (chance, rand = Math.random) => rand() < chance;
const traitChance = (p, def) =>
  typeof p.traitChance === "number" ? p.traitChance : def.chance;

export function playerTraits(p) {
  if (!p) return [];
  if (Array.isArray(p.traits) && p.traits.length) {
    return p.traits.filter((id) => TRAIT_DEFS[id]);
  }
  return p.trait && TRAIT_DEFS[p.trait] ? [p.trait] : [];
}

export function hasTrait(p, id) {
  return playerTraits(p).includes(id);
}

export function applyLineupTraits(lineup, myQ, opQ, ctx, rand = Math.random) {
  const fired = [];
  const add = (player, id, q, delta, note) => {
    if (!delta) return;
    fired.push({ player: player.name, trait: id, label: TRAIT_DEFS[id].label, pos: TRAIT_DEFS[id].pos, q, delta, note });
  };

  let qs = [...myQ];
  let ops = [...opQ];
  const players = lineup.filter(Boolean);

  for (const p of players) {
    for (const id of playerTraits(p)) {
    const def = TRAIT_DEFS[id];
    const chance = traitChance(p, def);

    if (id === "fibaLegend" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 0, d: 3 }]);
      add(p, id, 0, 3, "Opened hot in Q1");
    }
    if (id === "goldMedalDna" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 0, d: 2 }, { q: 2, d: 1 }]);
      add(p, id, 0, 3, "Steady +3 across the game");
    }
    if (id === "chaosEnergy" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 2, d: 6 }]);
      add(p, id, 2, 6, "Midgame chaos in Q3");
    }
    if (id === "flameThrower" && rollTrait(chance, rand)) {
      const q = Math.floor(rand() * 4);
      qs = patchQ(qs, [{ q, d: 10 }]);
      add(p, id, q, 10, `Erupted in ${QN[q]}`);
    }
    if (id === "unicorn" && ctx.style.id === "bal" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 1, d: 3 }, { q: 2, d: 2 }]);
      add(p, id, 1, 5, "Unicorn spacing Q2–Q3");
    }
    if (id === "pointGame42" && ctx.myRt - ctx.oppRt >= 4 && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 0, d: 2 }, { q: 1, d: 2 }, { q: 2, d: 2 }, { q: 3, d: 1 }]);
      add(p, id, 0, 7, "Full-game dominance vs weaker foe");
    }
    if (id === "secondHalfBeast" && qs[0] + qs[1] < ops[0] + ops[1] && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 2, d: 3 }, { q: 3, d: 3 }]);
      add(p, id, 2, 6, "Second-half rally");
    }
    if (id === "playoffFade" && ctx.gi >= 5 && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 1, d: -2 }, { q: 2, d: -2 }, { q: 3, d: -3 }]);
      add(p, id, 2, -7, "Knockout fade Q2–Q4");
    }
    if (id === "foulTrouble" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 1, d: -3 }, { q: 2, d: -3 }]);
      add(p, id, 1, -6, "Foul trouble Q2–Q3");
    }
    if (id === "goesMissing" && rollTrait(chance, rand)) {
      const q = Math.floor(rand() * 4);
      const lost = qs[q];
      if (lost > 0) {
        qs = patchQ(qs, [{ q, d: -lost }]);
        add(p, id, q, -lost, `No-show in ${QN[q]}`);
      }
    }
    if (id === "mrImportant" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 2, d: 4 }, { q: 3, d: 3 }]);
      add(p, id, 2, 7, "Mr. Important Q3–Q4");
    }
    if (id === "greatWall" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 0, d: 3 }, { q: 1, d: 3 }]);
      add(p, id, 0, 6, "Great Wall Q1–Q2");
    }
    if ((id === "theRussian" || id === "twoWayTerror") && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 1, d: 3 }]);
      ops = patchQ(ops, [{ q: 0, d: -2 }, { q: 1, d: -2 }]);
      add(p, id, 1, 7, id === "theRussian" ? "The Russian two-way Q1–Q2" : "Two-way terror Q1–Q2");
    }
    if (id === "connector" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 0, d: 1 }, { q: 1, d: 1 }, { q: 2, d: 1 }, { q: 3, d: 1 }]);
      add(p, id, 0, 4, "Connector glue all four");
    }
    if (id === "risingSun" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 2, d: 6 }]);
      add(p, id, 2, 6, "Rising Sun Q3");
    }
    if (id === "theTower" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 0, d: 3 }, { q: 2, d: 3 }]);
      add(p, id, 0, 6, "The Tower Q1 + Q3");
    }
    if (id === "glassKnee" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 1, d: -3 }, { q: 2, d: -3 }]);
      add(p, id, 1, -6, "Glass knee Q2–Q3");
    }
    if (id === "hotHead" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 2, d: -5 }]);
      add(p, id, 2, -5, "Hot head Q3");
    }
    if (id === "flopCity" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 1, d: -3 }, { q: 2, d: -2 }]);
      add(p, id, 1, -5, "Flop city Q2–Q3");
    }
    if (id === "brickFactory" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 1, d: -3 }, { q: 2, d: -6 }, { q: 3, d: -3 }]);
      add(p, id, 2, -12, "Brick factory — hero shots clank");
    }
    if (id === "isoBlackHole" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 1, d: -3 }, { q: 2, d: -4 }]);
      add(p, id, 2, -7, "Iso black hole — ball stuck Q2–Q3");
    }
    if (id === "refMeltdown" && rollTrait(chance, rand)) {
      qs = patchQ(qs, [{ q: 1, d: -4 }, { q: 2, d: -4 }, { q: 3, d: -2 }]);
      ops = patchQ(ops, [{ q: 1, d: 2 }]);
      add(p, id, 1, -12, "Ref meltdown — whole team loses it");
    }
    if (id === "elCapitan") {
      const through3 = myQ[0] + myQ[1] + myQ[2];
      const opThrough3 = ops[0] + ops[1] + ops[2];
      if (Math.abs(through3 - opThrough3) <= 6 && rollTrait(chance, rand)) {
        qs = patchQ(qs, [{ q: 3, d: 6 }]);
        add(p, id, 3, 6, "El Capitán Q4");
      }
    }
    }
  }

  // conditional traits (need score state)
  let my = qSum(qs);
  let op = qSum(ops);

  for (const p of players) {
    if (hasTrait(p, "hackAShaq") && my > op && rollTrait(traitChance(p, TRAIT_DEFS.hackAShaq), rand)) {
      qs = patchQ(qs, [{ q: 2, d: -3 }, { q: 3, d: -3 }]);
      add(p, "hackAShaq", 3, -6, "Hack-a-Shaq at the line Q3–Q4");
      my = qSum(qs);
    }
  }

  my = qSum(qs);
  op = qSum(ops);
  if (my < op && op - my <= 5) {
    for (const p of players) {
      if (hasTrait(p, "heroBall") && rollTrait(traitChance(p, TRAIT_DEFS.heroBall), rand)) {
        qs = patchQ(qs, [{ q: 2, d: -5 }]);
        add(p, "heroBall", 2, -5, "Hero-ball Q3 in a tight loss");
        my = qSum(qs);
      }
    }
  }

  return { myQ: qs, opQ: ops, my, fired };
}

export function simGameWithTraits(lineup, myRt, style, opp, gi, gamesPlayed, rand = Math.random) {
  const fitStyle = fittedStyle(style, lineup);
  const base = simGame(myRt, fitStyle, opp, gi, rand);
  const ctx = { gi, style: fitStyle, myRt, oppRt: teamRating(opp), gamesPlayed };
  const { myQ, opQ, my, fired } = applyLineupTraits(lineup, base.myQ, base.opQ, ctx, rand);
  let finalMy = my;
  let finalOp = qSum(opQ);
  const regMy = finalMy;
  const regOp = finalOp;
  let otMy = [];
  let otOp = [];
  let otPeriods = 0;
  if (finalMy === finalOp) {
    const ot = resolveOvertime(finalMy, finalOp, myRt, fitStyle, ctx.oppRt, rand);
    finalMy = ot.my;
    finalOp = ot.op;
    otMy = ot.otMy;
    otOp = ot.otOp;
    otPeriods = ot.otPeriods;
  }
  return { ...base, my: finalMy, op: finalOp, myQ, opQ, regMy, regOp, otMy, otOp, otPeriods, traitFired: fired };
}

export function boxScore(lineup, total, rand = Math.random) {
  const w = lineup.map((p) => Math.pow(p.rt - 65, 2) * (0.7 + rand() * 0.6));
  const s = w.reduce((a, b) => a + b, 0);
  const pts = w.map((x) => Math.round((x / s) * total * 0.86));
  return lineup.map((p, i) => ({ ...p, pts: pts[i] })).sort((a, b) => b.pts - a.pts);
}

/** Head-to-head Cup Final: two drafted fives, one shared rand stream. */
export function simCupFinal(lineupA, styleA, lineupB, styleB, rand = Math.random) {
  const luA = SLOTS.map((s) => lineupA[s]).filter(Boolean);
  const luB = SLOTS.map((s) => lineupB[s]).filter(Boolean);
  const rtA = luA.reduce((s, p) => s + p.rt, 0) / Math.max(luA.length, 1);
  const rtB = luB.reduce((s, p) => s + p.rt, 0) / Math.max(luB.length, 1);
  const fitA = fittedStyle(styleA, lineupA);
  const fitB = fittedStyle(styleB, lineupB);
  const oppB = { name: "PLAYER 2", season: "0000", c: "#23b4e2", players: luB };
  const base = simGame(rtA, fitA, oppB, 7, rand);
  const ctxA = { gi: 7, style: fitA, myRt: rtA, oppRt: rtB, gamesPlayed: 0 };
  let { myQ, opQ, fired: firedA } = applyLineupTraits(luA, base.myQ, base.opQ, ctxA, rand);
  // Apply B's traits from B's perspective (their offense = our opp quarters).
  const ctxB = { gi: 7, style: fitB, myRt: rtB, oppRt: rtA, gamesPlayed: 0 };
  const flipped = applyLineupTraits(luB, opQ, myQ, ctxB, rand);
  myQ = flipped.opQ;
  opQ = flipped.myQ;
  let finalMy = qSum(myQ);
  let finalOp = qSum(opQ);
  let otMy = [];
  let otOp = [];
  let otPeriods = 0;
  if (finalMy === finalOp) {
    const ot = resolveOvertime(finalMy, finalOp, rtA, fitA, rtB, rand);
    finalMy = ot.my;
    finalOp = ot.op;
    otMy = ot.otMy;
    otOp = ot.otOp;
    otPeriods = ot.otPeriods;
  }
  const boxA = boxScore(luA, finalMy, rand);
  const boxB = boxScore(luB, finalOp, rand);
  return {
    my: finalMy, op: finalOp, myQ, opQ, otMy, otOp, otPeriods,
    boxA, boxB, traitFired: firedA, firedB: flipped.fired,
    rtA: Math.round(rtA), rtB: Math.round(rtB),
  };
}

/** Guards/wings/forwards can splash; centers only if stretch-flagged or stretch-scoring traits. */
export function canSplashThree(p) {
  if (!p) return false;
  if (p.pos === "PG" || p.pos === "SG" || p.pos === "SF" || p.pos === "PF") return true;
  if (p.stretch) return true;
  return hasTrait(p, "unicorn") || hasTrait(p, "theTower") || hasTrait(p, "flameThrower");
}

/** Traditional paint centers (Shaq, Yao, Gobert…) — not stretch fives. */
export function isPaintBig(p) {
  return !!p && p.pos === "C" && !canSplashThree(p);
}

/** Offense-first / liability guards — soft on Lockdown schemes. */
const SOFT_GUARD_TRAITS = new Set([
  "flameThrower", "playoffFade", "goesMissing", "heroBall", "chaosEnergy", "refMeltdown", "brickFactory",
]);

export function isSoftGuard(p) {
  return !!p && (p.pos === "PG" || p.pos === "SG")
    && playerTraits(p).some((id) => SOFT_GUARD_TRAITS.has(id));
}

export function lineupPlayers(lineup) {
  if (!lineup) return [];
  if (Array.isArray(lineup)) return lineup.filter(Boolean);
  return SLOTS.map((s) => lineup[s]).filter(Boolean);
}

export function lineupCenter(lineup) {
  if (!lineup) return null;
  if (Array.isArray(lineup)) return lineup.find((p) => p?.pos === "C") || null;
  return lineup.C || null;
}

export function topSoftGuard(lineup) {
  return lineupPlayers(lineup)
    .filter(isSoftGuard)
    .sort((a, b) => (b.rt || 0) - (a.rt || 0))[0] || null;
}

/**
 * Style fit:
 * - Paint bigs drag Run & Gun, boost Lockdown.
 * - Soft guards blunt Lockdown (small penalty).
 */
export function fittedStyle(style, lineup) {
  let s = { ...style };
  const paint = isPaintBig(lineupCenter(lineup));
  const softCount = lineupPlayers(lineup).filter(isSoftGuard).length;

  if (paint) {
    if (s.id === "run") {
      s = { ...s, off: s.off - 3, def: s.def - 1, pace: Math.round(s.pace * 0.5) };
    } else if (s.id === "lock") {
      s = { ...s, def: s.def + 2 };
    }
  }

  if (softCount > 0 && s.id === "lock") {
    s = { ...s, def: s.def - (softCount >= 2 ? 3 : 2) };
  }

  return s;
}

/** Prefer poor-fit warnings over good-fit praise when both apply. */
export function styleFitHint(style, lineup) {
  const center = lineupCenter(lineup);
  const soft = topSoftGuard(lineup);

  if (style.id === "run" && isPaintBig(center)) {
    return { tone: "poor", label: "POOR FIT", detail: `${center.name} · halfcourt paint` };
  }
  if (style.id === "lock" && soft) {
    return { tone: "poor", label: "POOR FIT", detail: `${soft.name} · needs space` };
  }
  if (style.id === "lock" && isPaintBig(center)) {
    return { tone: "good", label: "GOOD FIT", detail: `${center.name} · anchors the paint` };
  }
  if (style.id === "run" && center?.pos === "C" && canSplashThree(center)) {
    return { tone: "good", label: "GOOD FIT", detail: `${center.name} · stretches the break` };
  }
  return null;
}
