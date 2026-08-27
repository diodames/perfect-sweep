import React, { useState, useMemo, useRef, useEffect } from "react";
import { COUNTRIES, countryByCode, countryMatchesQuery } from "./countries.js";
import { validateNick } from "./nickValidate.js";
import {
  utcDayKey, isValidDayKey, dailyNumber, formatDayLabel,
  msUntilUtcMidnight, formatCountdown, rng, shuffleWith,
  efficiencyFrom, loadDailyState, saveDailyState, clearDailyState,
  serializeLineup, serializeGames, formatRelativeTime,
  roomSeed, roomRng, generateRoomCode, isValidRoomId,
  loadDailyStreak, recordDailyStreak, streakIsLive, formatStreakShare, streakMilestone,
} from "./daily.js";
import {
  ROOM_POLL_MS, saveRoomSession, loadRoomSession, clearRoomSession,
  createRoom, fetchRoom, roomAction, roomActionWithRetry,
} from "./roomClient.js";
import { shareCopy } from "./shareCopy.js";
import {
  TEAMS, DREAM_TEAM, DREAM_TEAM_ROUND, OPPONENTS, SLOTS, STYLES, ROUNDS,
  TEAM_INDEX, NATIONS_ARCHIVE, ARCHIVE_STATS, teamRating, resolveTeamRef,
  isDreamGame, nationSlug,
} from "./teams.js";
import {
  TRAIT_DEFS, SIGNIFICANT_TRAIT_DELTA, playerTraits,
  simGameWithTraits, boxScore, simCupFinal, canSplashThree, styleFitHint, QN,
} from "./sim.js";
import { buildDailyBracket, buildGauntlet, neutralGame } from "./tournament.js";
import { cpuRunsForDay, mixDailyBoard, CPU_TARGET_N_DEFAULT } from "./cpuDrafters.js";

/** Fire-and-forget anonymous metric → POST /api/metrics (KV counters). */
function trackEvent(event, props = {}) {
  try {
    fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...props }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}

function trackMode(mode) {
  if (mode === "daily") return "daily";
  if (mode === "cup" || mode === "cupOnline") return "multiplayer";
  return "casual";
}

function trackResult({ perfect, worldChampions, eliminated }) {
  if (perfect) return "sweep";
  if (worldChampions) return "champion";
  if (eliminated) return "eliminated";
  return "eliminated";
}

function lineupPlayerRef(lineup, slot) {
  const p = lineup[slot];
  if (!p) return null;
  const ti = TEAM_INDEX[`${p.team}|${p.season}`];
  if (ti == null) return null;
  const pi = TEAMS[ti].players.findIndex((pl) => pl.name === p.name && pl.n === p.n);
  return pi >= 0 ? [ti, pi] : null;
}

function encodeRunShare({ rolls, groupOut, r2Out, lineup, games }) {
  const payload = {
    v: 1,
    r: rolls,
    g: groupOut ? 1 : 0,
    x: r2Out ? 1 : 0,
    l: SLOTS.map((s) => lineupPlayerRef(lineup, s)),
    m: games.map((g) => {
      const oi = TEAM_INDEX[`${g.opp.name}|${g.opp.season}`];
      const box = SLOTS.map((s) => g.box?.find((b) => b.name === lineup[s]?.name && b.n === lineup[s]?.n)?.pts ?? 0);
      return [g.my, g.op, oi, ...box];
    }),
  };
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${window.location.pathname}?card=${b64}`;
}

function decodeRunShare(search) {
  const raw = new URLSearchParams(search).get("card");
  if (!raw) return null;
  try {
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(padded)));
    const p = JSON.parse(json);
    if (p.v !== 1 || !Array.isArray(p.l) || !Array.isArray(p.m) || !p.m.length) return null;

    const lineup = {};
    p.l.forEach((entry, slotIdx) => {
      if (!entry) return;
      const [ti, pi] = entry;
      const team = TEAMS[ti];
      const player = team?.players[pi];
      const slot = SLOTS[slotIdx];
      if (!team || !player || player.pos !== slot) return;
      lineup[slot] = { ...player, team: team.name, season: team.season, tc: team.c };
    });
    if (SLOTS.some((s) => !lineup[s])) return null;

    const games = p.m.map((row, i) => {
      const [my, op, oi, ...boxPts] = row;
      const opp = OPPONENTS[oi];
      if (!opp) return null;
      const box = SLOTS.map((s, j) => {
        const pl = lineup[s];
        return pl ? { name: pl.name, n: pl.n, pts: boxPts[j] ?? 0 } : null;
      }).filter(Boolean);
      return {
        my, op, opp,
        round: ROUNDS[i] || (oi >= TEAMS.length ? DREAM_TEAM_ROUND : ROUNDS[ROUNDS.length - 1]),
        box,
      };
    }).filter(Boolean);
    if (!games.length) return null;

    return {
      lineup,
      games,
      rolls: p.r ?? 0,
      groupOut: !!p.g,
      r2Out: !!p.x,
      gi: games.length,
    };
  } catch {
    return null;
  }
}

function readShareFromUrl() {
  if (typeof window === "undefined") return null;
  return decodeRunShare(window.location.search);
}

function readShortIdFromUrl() {
  if (typeof window === "undefined") return null;
  const id = new URLSearchParams(window.location.search).get("r");
  return id && /^[A-Za-z0-9_-]{4,16}$/.test(id) ? id : null;
}

function readRoomFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = (params.get("room") || "").toUpperCase();
  if (!isValidRoomId(raw)) return null;
  return { roomId: raw };
}

function readBrowseFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.has("card") || params.has("r") || params.has("daily") || params.has("room")) return null;
  const teamSlug = params.get("team");
  if (teamSlug) {
    const nation = NATIONS_ARCHIVE.find((n) => n.slug === teamSlug);
    if (nation) return { screen: "team", browseNation: nation.name };
  }
  if (params.has("teams")) return { screen: "teams", browseNation: null };
  if (params.has("howto")) return { screen: "howto", browseNation: null };
  if (params.has("about")) return { screen: "about", browseNation: null };
  if (params.has("leaderboard") || params.has("daily-board")) {
    return { screen: "leaderboard", browseNation: null, dailyBoard: params.has("daily-board") };
  }
  return null;
}

function readDailyFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("daily")) return null;
  const raw = params.get("daily");
  const day = raw && isValidDayKey(raw) ? raw : utcDayKey();
  return { day };
}

const shuffle = (a, rand = Math.random) => shuffleWith(a, rand);

/* 2K-style rating gem tiers */
const tier = (rt) =>
  rt >= 95 ? { bg: "linear-gradient(160deg,#ffd1f4,#f368e0 60%,#c93bbf)", fg: "#3c0836", name: "PINK DIAMOND" } :
  rt >= 90 ? { bg: "linear-gradient(160deg,#d9fbff,#67e8f9 55%,#22b8d4)", fg: "#083a44", name: "DIAMOND" } :
  rt >= 87 ? { bg: "linear-gradient(160deg,#e5d4ff,#a78bfa 55%,#7c3aed)", fg: "#2a0a54", name: "AMETHYST" } :
  rt >= 84 ? { bg: "linear-gradient(160deg,#ffc9c9,#f87171 55%,#dc2626)", fg: "#450a0a", name: "RUBY" } :
  rt >= 81 ? { bg: "linear-gradient(160deg,#c7ddff,#60a5fa 55%,#2563eb)", fg: "#0a1e45", name: "SAPPHIRE" } :
  rt >= 78 ? { bg: "linear-gradient(160deg,#c9f7d4,#4ade80 55%,#16a34a)", fg: "#052e13", name: "EMERALD" } :
             { bg: "linear-gradient(160deg,#fbe8b3,#facc15 55%,#ca8a04)", fg: "#3b2a03", name: "GOLD" };


/* ============ SIMULATION ============ */
const rndT = (arr) => arr[Math.floor(Math.random() * arr.length)];

function buildEvents(g, box, opp) {
  const buckets = (total) => {
    const b = []; let t = total;
    while (t > 0) {
      let p = t >= 3 && Math.random() < 0.33 ? 3 : Math.min(2, t);
      if (p === 2 && Math.random() < 0.1) p = 1;
      b.push(p); t -= p;
    }
    return b;
  };
  const pickScorer = (pool = box) => {
    const list = pool.length ? pool : box;
    const tot = list.reduce((s, p) => s + p.pts, 0) || 1;
    let r = Math.random() * tot;
    for (const p of list) { r -= p.pts; if (r <= 0) return p; }
    return list[0];
  };
  const oppName = `${opp.name} '${opp.season.slice(2)}`;
  const myText = (p, pts) => {
    const n = p.name;
    if (pts === 3) {
      return rndT([`${n} splashes a triple!`, `${n} pulls up from deep — BANG!`, `${n} buries the corner three`]);
    }
    if (pts === 1) return `${n} sinks the free throw`;
    if (p.pos === "C") {
      return rndT([
        `${n} finishes strong at the rim`,
        `${n} drops in the hook`,
        `${n} seals and scores on the block`,
        `${n} scores off the pick and roll`,
        `${n} puts it back at the rim`,
      ]);
    }
    return rndT([
      `${n} finishes strong at the rim`,
      `${n} knocks down the mid-range`,
      `${n} spins baseline for two`,
      `${n} scores off the pick and roll`,
      `${n} beats his man off the dribble`,
    ]);
  };
  const opText = (pts) =>
    pts === 3 ? rndT([`${oppName} answers from downtown`, `${oppName} hits a deep three`]) :
    pts === 1 ? `${oppName} converts at the line` :
    rndT([`${oppName} scores inside`, `${oppName} gets to the rim`, `${oppName} hits a tough jumper`]);
  const regMy = g.regMy ?? g.my;
  const regOp = g.regOp ?? g.op;
  // Prefer real quarter splits so scoring development matches the Q1–Q4 table.
  const myQ = Array.isArray(g.myQ) && g.myQ.length >= 4 ? g.myQ.slice(0, 4) : splitQ(regMy);
  const opQ = Array.isArray(g.opQ) && g.opQ.length >= 4 ? g.opQ.slice(0, 4) : splitQ(regOp);
  const stamp = (e, sec) => {
    const q = Math.min(4, Math.floor(sec / 600) + 1);
    const rem = 600 - (sec % 600);
    const clock = sec < 2400
      ? `Q${q} ${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, "0")}`
      : (() => {
          const otSec = sec - 2400;
          const otNum = Math.floor(otSec / 300) + 1;
          const otRem = 300 - (otSec % 300);
          return `OT${otNum} ${Math.floor(otRem / 60)}:${String(otRem % 60).padStart(2, "0")}`;
        })();
    let text;
    if (e.team === "me") {
      if (e.pts === 3) {
        const splashers = box.filter(canSplashThree);
        if (splashers.length) text = myText(pickScorer(splashers), 3);
        else text = myText(pickScorer(), 2); // no shooter — interior copy; pts stay 3 for totals
      } else {
        text = myText(pickScorer(), e.pts);
      }
    } else {
      text = opText(e.pts);
    }
    return { ...e, sec, q: sec < 2400 ? q : 4 + Math.floor((sec - 2400) / 300), clock, text };
  };
  const stampInWindow = (e, base, len) => {
    // Keep events inside the period (avoid landing exactly on the next tip).
    const sec = base + Math.floor(Math.random() * Math.max(1, len - 1));
    return stamp(e, sec);
  };
  const regEvs = [0, 1, 2, 3].flatMap((qi) => {
    const base = qi * 600;
    return [
      ...buckets(myQ[qi] || 0).map((p) => stampInWindow({ team: "me", pts: p }, base, 600)),
      ...buckets(opQ[qi] || 0).map((p) => stampInWindow({ team: "op", pts: p }, base, 600)),
    ];
  });
  const otEvs = (g.otMy || []).flatMap((myOT, i) => {
    const opOT = g.otOp[i];
    const base = 2400 + i * 300;
    return [
      ...buckets(myOT).map((p) => stampInWindow({ team: "me", pts: p }, base, 300)),
      ...buckets(opOT).map((p) => stampInWindow({ team: "op", pts: p }, base, 300)),
    ];
  });
  return [...regEvs, ...otEvs].sort((a, b) => a.sec - b.sec);
}

function chunkEvents(evs, n) {
  const per = Math.max(1, Math.ceil(evs.length / n));
  const steps = [];
  for (let i = 0; i < evs.length; i += per) {
    const grp = evs.slice(i, i + per);
    const last = grp[grp.length - 1];
    steps.push({
      dMy: grp.reduce((s, e) => s + (e.team === "me" ? e.pts : 0), 0),
      dOp: grp.reduce((s, e) => s + (e.team === "op" ? e.pts : 0), 0),
      q: last.q, clock: last.clock, text: last.text, team: last.team,
    });
  }
  return steps;
}

/* Your five is always red — keep opponents visually distinct from it.
   If a nation's color is reddish (or too dark), swap in a contrasting accent. */
const OPP_FALLBACKS = ["#23b4e2", "#f5a524", "#8b5cf6", "#22c55e"];
const oppColor = (team) => {
  if (team.alt) return team.alt;               // curated jersey-accurate contrast color
  const hex = team.c.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hue = 0;
  if (d) {
    if (max === r) hue = 60 * (((g - b) / d) % 6);
    else if (max === g) hue = 60 * ((b - r) / d + 2);
    else hue = 60 * ((r - g) / d + 4);
  }
  if (hue < 0) hue += 360;
  const redHue = d > 0.15 && (hue < 22 || hue > 338); // never let an opponent read as YOUR FIVE's red
  const tooDark = max < 0.28;
  if (!redHue && !tooDark) return team.c;
  const i = (team.name.length + team.season.charCodeAt(3)) % OPP_FALLBACKS.length;
  return OPP_FALLBACKS[i];
};

/* ---- scoring development (cumulative margin, stepped) ---- */
function buildFlow(evs) {
  let my = 0, op = 0;
  const pts = [{ sec: 0, m: 0 }];
  for (const e of evs) {
    if (e.team === "me") my += e.pts;
    else op += e.pts;
    const last = pts[pts.length - 1];
    if (last.sec === e.sec) last.m = my - op;
    else pts.push({ sec: e.sec, m: my - op });
  }
  const endSec = Math.max(2400, pts[pts.length - 1]?.sec || 0);
  if (pts[pts.length - 1].sec < endSec) pts.push({ sec: endSec, m: pts[pts.length - 1].m });
  return pts;
}

function marginAt(flow, sec) {
  let m = 0;
  for (const p of flow) {
    if (p.sec <= sec) m = p.m;
    else break;
  }
  return m;
}

function traitMarkerCopy(t, oppN) {
  const def = TRAIT_DEFS[t.trait];
  const pool = t.pos ? def?.recapPos : def?.recapNeg;
  const qn = ["first", "second", "third", "fourth"][t.q] || "late";
  const story = (pool?.[0] || t.note || def?.desc || "")
    .replaceAll("{player}", t.player)
    .replaceAll("{qn}", qn)
    .replaceAll("{oppN}", oppN);
  return {
    title: t.label,
    sub: `${t.player} · ${QN[t.q] || "OT"}`,
    body: story,
  };
}

function scoreDevSegments(flow, x, y, myC, oc) {
  const segs = [];
  let d = "", color = null;
  const flush = () => { if (d && color) segs.push({ d, color }); d = ""; };
  const col = (m, fallback) => (m > 0 ? myC : m < 0 ? oc : fallback);
  for (let i = 0; i < flow.length - 1; i++) {
    const a = flow[i], b = flow[i + 1];
    const x0 = x(a.sec), y0 = y(a.m), x1 = x(b.sec), y1 = y(b.m);
    const hC = col(a.m, col(b.m, myC));
    if (color !== hC) { flush(); color = hC; d = `M${x0.toFixed(1)},${y0.toFixed(1)}`; }
    else if (!d) d = `M${x0.toFixed(1)},${y0.toFixed(1)}`;
    d += `H${x1.toFixed(1)}`;
    if (a.m === b.m) continue;
    if ((a.m > 0 && b.m < 0) || (a.m < 0 && b.m > 0)) {
      const midY = y(0);
      d += `V${midY.toFixed(1)}`;
      flush();
      color = col(b.m, hC);
      d = `M${x1.toFixed(1)},${midY.toFixed(1)}V${y1.toFixed(1)}`;
    } else {
      const vC = col(b.m, hC);
      if (color !== vC) { flush(); color = vC; d = `M${x1.toFixed(1)},${y0.toFixed(1)}`; }
      d += `V${y1.toFixed(1)}`;
    }
  }
  flush();
  return segs;
}

function flowYDomain(flow) {
  const ms = flow.length ? flow.map((p) => p.m) : [0];
  const dataMin = Math.min(0, ...ms);
  const dataMax = Math.max(0, ...ms);
  const span = Math.max(8, dataMax - dataMin);
  const step = span > 50 ? 10 : 5;
  const pad = step / 2;
  let yMin = Math.floor((dataMin - (dataMin < 0 ? pad : 0)) / step) * step;
  let yMax = Math.ceil((dataMax + (dataMax > 0 ? pad : 0)) / step) * step;
  yMin = Math.min(yMin, -10); // keep a negative band so 0 isn't glued to the floor
  yMax = Math.max(yMax, 0);
  if (yMax === yMin) { yMin = -10; yMax = step; }
  if (dataMax > 0 && yMax <= dataMax) yMax += step;
  if (dataMin < 0 && yMin >= dataMin) yMin -= step;
  return { yMin, yMax, step };
}

const GameFlow = ({ flow, opp, traits = [] }) => {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const oc = oppColor(opp);
  const myC = "#E8465A";
  const oppN = `${opp.name} '${opp.season.slice(2)}`;
  const W = 560, H = 188;
  const left = 32, right = 10, top = 10, bot = 24;
  const plotW = W - left - right, plotH = H - top - bot;
  const maxSec = Math.max(2400, flow[flow.length - 1]?.sec || 2400);
  const { yMin, yMax, step } = flowYDomain(flow);
  const yRange = yMax - yMin || 1;
  const x = (sec) => left + (sec / maxSec) * plotW;
  const y = (m) => top + ((yMax - m) / yRange) * plotH;
  const midY = y(0);
  const periods = Math.max(4, Math.ceil(maxSec / 600));
  const yTicks = [];
  for (let t = yMax; t >= yMin - 0.001; t -= step) yTicks.push(t);
  const segs = scoreDevSegments(flow, x, y, myC, oc);
  const markers = (traits || []).map((t, i) => {
    const sec = Math.min(maxSec - 30, Math.max(30, (t.q + 0.55) * 600 + i * 36));
    const m = marginAt(flow, sec);
    const copy = traitMarkerCopy(t, oppN);
    return { ...t, cx: x(sec), cy: y(m), copy };
  });
  const tipPos = (() => {
    if (!hover) return null;
    const wrapW = wrapRef.current?.clientWidth || W;
    const anchorX = (hover.cx / W) * wrapW;
    const tipHalf = 112;
    const pad = 8;
    let shift = 0;
    if (anchorX - tipHalf < pad) shift = tipHalf + pad - anchorX;
    else if (anchorX + tipHalf > wrapW - pad) shift = wrapW - pad - tipHalf - anchorX;
    return { left: anchorX, top: `${(hover.cy / H) * 100}%`, shift, below: hover.cy < H * 0.38 };
  })();
  return (
    <div className="scoreDev" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {Array.from({ length: periods }, (_, q) => {
          const x0 = x(q * 600), x1 = x(Math.min(maxSec, (q + 1) * 600));
          return (
            <rect key={q} x={x0} y={top} width={Math.max(0, x1 - x0)} height={plotH}
              fill={q % 2 === 0 ? "rgba(255,255,255,.03)" : "transparent"} />
          );
        })}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)}
              stroke={t === 0 ? "#5f6b7d" : "#232b3d"} strokeWidth={t === 0 ? 1.25 : 1} />
            <text x={left - 6} y={y(t) + 3.5} textAnchor="end"
              fill="#5f6b7d" fontSize="10" fontFamily="Saira Condensed, sans-serif"
              fontStyle="italic" fontWeight="700">{t}</text>
          </g>
        ))}
        {Array.from({ length: periods - 1 }, (_, i) => (
          <line key={`p${i}`} x1={x((i + 1) * 600)} x2={x((i + 1) * 600)}
            y1={top} y2={top + plotH} stroke="#2a3348" strokeDasharray="3 4" />
        ))}
        {segs.map((s, i) => (
          <path key={i} d={s.d} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="miter" strokeLinecap="square" />
        ))}
        <line x1={left} x2={W - right} y1={midY} y2={midY} stroke="#8fa0b8" strokeWidth="1" opacity="0.55" />
        {Array.from({ length: periods }, (_, q) => {
          const label = q < 4 ? `Q${q + 1}` : `OT${q - 3}`;
          const cx = (x(q * 600) + x(Math.min(maxSec, (q + 1) * 600))) / 2;
          return (
            <text key={label} x={cx} y={H - 6} textAnchor="middle"
              fill="#5f6b7d" fontSize="10" fontFamily="Saira Condensed, sans-serif"
              fontWeight="700" letterSpacing="0.12em">{label}</text>
          );
        })}
        {markers.map((mk, i) => {
          const fill = mk.pos ? "#7ee2a8" : "#f08a8a";
          return (
            <g key={`${mk.trait}-${i}`} className="traitDot"
              onMouseEnter={() => setHover(mk)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(mk)} onBlur={() => setHover(null)}
              tabIndex={0} style={{ cursor: "pointer" }}>
              <circle cx={mk.cx} cy={mk.cy} r="9" fill="transparent" />
              <circle cx={mk.cx} cy={mk.cy} r="5.5" fill={fill} stroke="#0b0e15" strokeWidth="2" />
              <circle cx={mk.cx} cy={mk.cy} r="2" fill="#fff" />
              <title>{`${mk.copy.title} — ${mk.copy.body}`}</title>
            </g>
          );
        })}
      </svg>
      {hover && tipPos && (
        <div className={`traitTip ${tipPos.below ? "traitTipBelow" : ""}`} role="tooltip"
          style={{ left: tipPos.left, top: tipPos.top, ["--tip-shift"]: `${tipPos.shift}px` }}>
          <div className="traitTipLabel" style={{ color: hover.pos ? "#7ee2a8" : "#f08a8a" }}>{hover.copy.title}</div>
          <div className="traitTipSub">{hover.copy.sub}</div>
          <div className="traitTipBody">{hover.copy.body}</div>
        </div>
      )}
    </div>
  );
};
function significantTraitRecap(fired, oppN) {
  const hit = (fired || [])
    .filter((t) => Math.abs(t.delta) >= SIGNIFICANT_TRAIT_DELTA)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  if (!hit) return "";
  const pool = hit.pos ? TRAIT_DEFS[hit.trait].recapPos : TRAIT_DEFS[hit.trait].recapNeg;
  if (!pool?.length) return "";
  const qn = ["first", "second", "third", "fourth"][hit.q];
  return rndT(pool).replace("{player}", hit.player).replace("{qn}", qn).replace("{oppN}", oppN);
}
function buildStory(g, box, style) {
  const top = box[0];
  const m = g.my - g.op;
  const oppN = `${g.opp.name} '${g.opp.season.slice(2)}`;
  const bestQ = Math.max(...g.myQ);
  const qn = ["1st", "2nd", "3rd", "4th"][g.myQ.indexOf(bestQ)];
  let story;
  if (m >= 18) story = rndT([
    `${top.name} was unstoppable — ${top.pts} points, and ${oppN} never got within double digits.`,
    `Total demolition: ${top.name} caught fire early, and a ${bestQ}-point ${qn} quarter buried ${oppN}.`,
    `${oppN} had no answer for ${top.name} (${top.pts} pts) on either end of the floor.`,
  ]);
  else if (m >= 10) story = rndT([
    canSplashThree(top)
      ? `${top.name} caught fire from the three-point line — ${top.pts} points powered a comfortable win.`
      : `${top.name} dominated inside — ${top.pts} points powered a comfortable win.`,
    `A ${bestQ}-point ${qn} quarter broke it open; ${top.name} led the way with ${top.pts}.`,
    style.id === "lock"
      ? `The lockdown defense wore ${oppN} down while ${top.name} did the scoring (${top.pts} pts).`
      : `The pace was too much for ${oppN} — ${top.name} poured in ${top.pts} in transition.`,
  ]);
  else if (m > 0) story = rndT([
    `Nail-biter: ${top.name} hit the big shots late to hold off ${oppN}.`,
    `${top.name} (${top.pts} pts) closed it out from the line in a grinder of a finish.`,
    `${oppN} pushed to the final buzzer, but ${top.name} answered every run.`,
  ]);
  else if (m <= -15) story = rndT([
    `${oppN} ran your five off the floor — cold shooting everywhere except ${top.name} (${top.pts} pts).`,
    `Nothing worked: ${oppN} controlled all four quarters and the paint.`,
  ]);
  else story = rndT([
    `Heartbreaker — ${oppN} hit the shots down the stretch that your five couldn't.`,
    `${top.name} kept it alive with ${top.pts}, but ${oppN} made one more play at the end.`,
    `It slipped away in the ${["1st", "2nd", "3rd", "4th"][g.opQ.indexOf(Math.max(...g.opQ))]} quarter — ${oppN} went on the decisive run.`,
  ]);
  const traitLine = significantTraitRecap(g.traitFired, oppN);
  let out = traitLine ? `${story} ${traitLine}` : story;
  if (g.otPeriods > 0) {
    const otNote = g.otPeriods === 1
      ? " Regulation ended tied — it took one five-minute overtime to settle it."
      : ` Regulation ended tied — it took ${g.otPeriods} overtimes before someone finally broke through.`;
    out += otNote;
  }
  return out;
}

/* ============ 2K-STYLE UI ============ */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Saira+Condensed:ital,wght@0,500;0,700;0,800;1,700;1,800;1,900&family=Saira:wght@400;500;600&display=swap');
.ps-root{font-family:'Saira',sans-serif;color:#EAF0F7;min-height:100vh;position:relative;
  background:
    radial-gradient(1000px 420px at 50% -120px, rgba(232,70,90,.18), transparent 60%),
    radial-gradient(800px 500px at 90% 110%, rgba(35,180,226,.10), transparent 60%),
    linear-gradient(180deg,#0b0e15 0%, #0a0c12 100%);}
.ps-root::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.5;
  background:repeating-linear-gradient(115deg, rgba(255,255,255,.016) 0 2px, transparent 2px 90px);}
.dsp{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:800;
  text-transform:uppercase;letter-spacing:.02em;}
.dsp9{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:900;
  text-transform:uppercase;letter-spacing:.01em;}
.eyebrow{font-family:'Saira Condensed',sans-serif;font-weight:700;text-transform:uppercase;
  letter-spacing:.28em;font-size:11px;color:#5f6b7d;}
.cardRunMeta{display:flex;align-items:center;gap:.65rem;flex-wrap:nowrap;
  font-family:'Saira Condensed',sans-serif;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;font-size:12px;color:#c6d2e3;white-space:nowrap;
  overflow-x:auto;padding:.55rem 0;margin:0;
  -webkit-overflow-scrolling:touch;scrollbar-width:none;}
.cardRunMeta::-webkit-scrollbar{display:none;}
.cardRunMetaSep{color:#5f6b7d;flex-shrink:0;}
@media (min-width:640px){
  .cardRunMeta{font-size:11px;letter-spacing:.1em;color:#93a1b5;}
}
.panel{background:linear-gradient(180deg,#141926 0%,#10141f 100%);
  border:1px solid #232b3d;border-top:2px solid #2c3650;
  clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);}
.boardRow{background:transparent;border:0;font:inherit;color:inherit;cursor:pointer;}
.boardRow:hover{background:rgba(148,163,184,.07);}
.cpuRow{background:rgba(148,163,184,.04);border:0;font:inherit;color:inherit;cursor:pointer;}
.cpuRow:hover{background:rgba(148,163,184,.09);}
.cpuBadge{display:inline-block;font-size:9px;letter-spacing:.14em;padding:2px 6px;margin-right:6px;
  border:1px solid #3d4a66;color:#8b9bb3;background:#0e1420;vertical-align:middle;}
.chip{clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);}
.skew{transform:skewX(-8deg);}
.unskew{transform:skewX(8deg);display:inline-block;}
.btnP{background:linear-gradient(180deg,#ff5468,#e8465a 55%,#c92840);color:#fff;
  border:0;box-shadow:0 0 24px rgba(232,70,90,.4), inset 0 1px 0 rgba(255,255,255,.35);
  transition:filter .1s ease, transform .08s ease;}
.btnP:hover{filter:brightness(1.1);} .btnP:active{transform:skewX(-8deg) scale(.97);}
.btnG{background:#1a2132;color:#c6d2e3;border:1px solid #303c56;transition:filter .1s;}
.btnG:hover{filter:brightness(1.25);} .btnG:active{transform:skewX(-8deg) scale(.97);}
.btnDead{background:#12161f;color:#414c60;border:1px solid #1e2635;cursor:not-allowed;}
.segCtrl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:#1a2132;border:1px solid #303c56;
  overflow:visible;}
.segCtrl button{position:relative;display:flex;align-items:center;justify-content:center;
  background:transparent;border:0;border-right:1px solid #303c56;color:#c6d2e3;
  padding:.3rem .4rem;min-height:34px;cursor:pointer;white-space:nowrap;
  transition:filter .1s ease, transform .08s ease;}
.segCtrl button:last-child{border-right:0;}
.segCtrl button:hover{filter:brightness(1.2);z-index:2;}
.segCtrl button:active{transform:scale(.96);}
.segCtrl button.active{background:linear-gradient(180deg,#ff5468,#e8465a 55%,#c92840);color:#fff;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.35);}
.segCtrl .unskew{white-space:nowrap;}
.segTip{position:absolute;left:50%;bottom:calc(100% + 8px);transform:skewX(8deg) translateX(-50%);
  width:max-content;max-width:240px;padding:.45rem .6rem;pointer-events:none;
  background:#0f1420;border:1px solid #303c56;color:#c6d2e3;
  font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:700;
  font-size:11px;letter-spacing:.04em;text-transform:uppercase;line-height:1.25;text-align:center;
  white-space:normal;opacity:0;visibility:hidden;transition:opacity .12s ease, visibility .12s ease;
  box-shadow:0 6px 18px rgba(0,0,0,.45);z-index:5;}
.segTip::after{content:"";position:absolute;left:50%;top:100%;transform:translateX(-50%);
  border:5px solid transparent;border-top-color:#303c56;}
.segCtrl button:hover .segTip,.segCtrl button:focus-visible .segTip{opacity:1;visibility:visible;}
.fitChip{display:inline-flex;align-items:center;margin-top:.55rem;padding:.35rem .7rem;
  font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:800;
  font-size:11px;letter-spacing:.04em;text-transform:uppercase;line-height:1.2;}
.fitChip.good{background:#1d3a2a;color:#7ee2a8;border:1px solid #2c5c40;}
.fitChip.poor{background:#3a1d22;color:#f08a8a;border:1px solid #5c2c34;}
.fitChipLabel{letter-spacing:.14em;}
.fitChipSep{margin:0 .45rem;opacity:.45;font-style:normal;}
.fitChipDetail{font-weight:700;letter-spacing:.06em;opacity:.92;}
.scoreDev{position:relative;overflow:visible;}
.traitTip{position:absolute;transform:translate(calc(-50% + var(--tip-shift, 0px)),calc(-100% - 12px));width:max-content;max-width:220px;
  padding:.55rem .7rem;pointer-events:none;z-index:6;
  background:#0f1420;border:1px solid #303c56;box-shadow:0 8px 22px rgba(0,0,0,.5);}
.traitTip::after{content:"";position:absolute;left:calc(50% - var(--tip-shift, 0px));top:100%;transform:translateX(-50%);
  border:5px solid transparent;border-top-color:#303c56;}
.traitTip.traitTipBelow{transform:translate(calc(-50% + var(--tip-shift, 0px)),14px);}
.traitTip.traitTipBelow::after{top:auto;bottom:100%;border-top-color:transparent;border-bottom-color:#303c56;}
.traitTipLabel{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:800;
  font-size:12px;letter-spacing:.04em;text-transform:uppercase;line-height:1.2;}
.traitTipSub{font-family:'Saira Condensed',sans-serif;font-weight:700;font-size:10px;
  letter-spacing:.1em;text-transform:uppercase;color:#5f6b7d;margin-top:.15rem;}
.traitTipBody{font-family:'Saira',sans-serif;font-size:12px;line-height:1.35;color:#c6d2e3;margin-top:.35rem;
  text-wrap:pretty;}
.traitLabelWrap{outline:none;}
.traitLabelTrigger{text-decoration-line:underline;text-decoration-style:dotted;text-decoration-color:currentColor;text-underline-offset:3px;text-decoration-thickness:1px;}
.traitLabelWrap:hover .traitLabelTrigger,.traitLabelWrap:focus-within .traitLabelTrigger{text-decoration-style:solid;}
.traitLabelTip{position:absolute;left:calc(100% + 10px);top:50%;transform:translateY(-50%) translateX(-4px);
  width:max-content;max-width:200px;padding:.65rem .75rem .7rem;pointer-events:none;z-index:40;
  background:#121826;border:1px solid #303c56;border-left:3px solid var(--trait-c,#7ee2a8);
  box-shadow:0 10px 28px rgba(0,0,0,.55);opacity:0;visibility:hidden;
  transition:opacity .14s ease,transform .14s ease,visibility .14s;}
.traitLabelTip::before{content:"";position:absolute;right:100%;top:50%;transform:translateY(-50%);
  border:5px solid transparent;border-right-color:#303c56;}
.traitLabelWrap:hover .traitLabelTip,.traitLabelWrap:focus-within .traitLabelTip{opacity:1;visibility:visible;transform:translateY(-50%) translateX(0);}
.traitLabelTipKind{font-family:'Saira Condensed',sans-serif;font-weight:700;font-size:10px;
  letter-spacing:.14em;text-transform:uppercase;color:#7d8ba0;display:block;line-height:1;}
.traitLabelTipDesc{font-family:'Saira',sans-serif;font-size:12px;line-height:1.4;color:#c6d2e3;margin-top:.4rem;
  display:block;text-wrap:pretty;}
@media (max-width:639px){
  .traitLabelTip{left:0;top:calc(100% + 8px);transform:translateY(-4px);max-width:min(200px,70vw);}
  .traitLabelTip::before{right:auto;left:14px;top:auto;bottom:100%;transform:none;
    border:5px solid transparent;border-bottom-color:#303c56;border-right-color:transparent;}
  .traitLabelWrap:hover .traitLabelTip,.traitLabelWrap:focus-within .traitLabelTip{transform:translateY(0);}
}
.scoreNum{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:900;
  color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.7);}
.qByQ{display:grid;gap:.2rem .35rem;align-items:center;text-align:center;}
.qByQHead{font-family:'Saira Condensed',sans-serif;font-size:10px;letter-spacing:.1em;
  color:#5f6b7d;font-weight:700;line-height:1;}
.qByQSide{font-family:'Saira Condensed',sans-serif;font-size:10px;letter-spacing:.08em;
  font-weight:700;text-align:left;line-height:1;}
.qByQCell{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:800;
  font-size:16px;font-variant-numeric:tabular-nums;line-height:1.15;}
.rowHover{transition:background .1s;} .rowHover:hover{background:rgba(232,70,90,.10);}
.gemShield{clip-path:polygon(50% 0,100% 22%,100% 78%,50% 100%,0 78%,0 22%);}
.matchCard{display:flex;align-items:stretch;padding:0;overflow:hidden;}
.matchCardRound{display:flex;flex-direction:column;justify-content:center;padding:.65rem .7rem;min-width:4.25rem;
  background:rgba(0,0,0,.22);border-right:1px solid #1c2333;flex-shrink:0;}
.matchCardRound .eyebrow{letter-spacing:.06em;font-size:9px;line-height:1.35;}
.matchCardBody{flex:1;min-width:0;padding:.65rem .75rem;}
.matchCardScore{display:flex;flex-direction:row;align-items:center;justify-content:flex-end;
  padding:.65rem .8rem;flex-shrink:0;gap:.35rem;white-space:nowrap;}
.matchCardScoreNum{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:900;
  font-size:1.2rem;white-space:nowrap;line-height:1;}
.matchCardScoreIcon{font-family:'Saira Condensed',sans-serif;font-size:.95rem;line-height:1;flex-shrink:0;}
.runHero{text-align:center;position:relative;}
.runHeroAccent{position:absolute;top:0;left:14px;right:0;height:2px;pointer-events:none;}
.runHeroRecord{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:900;
  font-size:clamp(2.75rem,14vw,4.5rem);line-height:1;-webkit-text-fill-color:currentColor;}
.runHeroStats{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-top:1rem;padding-top:1rem;}
.runHeroStatVal{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:900;font-size:1.5rem;}
.runHeroStatLbl{font-family:'Saira Condensed',sans-serif;font-weight:700;text-transform:uppercase;
  letter-spacing:.1em;font-size:9px;margin-top:.15rem;opacity:.75;}
@media (prefers-reduced-motion: no-preference){
  .pop{animation:pop .28s cubic-bezier(.2,.9,.3,1.2);}
  @keyframes pop{from{transform:translateY(10px) scale(.97);opacity:0}to{transform:none;opacity:1}}
  .slideL{animation:slideL .35s cubic-bezier(.2,.9,.3,1);}
  @keyframes slideL{from{transform:translateX(-24px);opacity:0}to{transform:none;opacity:1}}
}
`;

const BtnArrow = () => <span className="whitespace-nowrap">{"\u00A0"}▸</span>;
const BallIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
    style={{ display: "inline-block", verticalAlign: "-0.12em", marginRight: "0.35em" }}>
    <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
    <path d="M12 2.75v18.5M3.4 12h17.2M5.2 6.2c2.4 1.9 5.1 2.85 6.8 2.85S16.4 8.1 18.8 6.2M5.2 17.8c2.4-1.9 5.1-2.85 6.8-2.85s4.4.95 6.8 2.85"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

function roundShortLabel(i, round) {
  if (round === DREAM_TEAM_ROUND) return "DREAM";
  if (i < 3) return "GROUPS";
  if (i < 5) return "2ND RD";
  if (i === 5) return "QF";
  if (i === 6) return "SF";
  return "FINAL";
}

function roundGameIndex(i) {
  if (i < 3) return i + 1;
  if (i < 5) return i - 2;
  return null;
}

/** Full stage label for OG share tiles (distinct from compact UI roundShortLabel). */
function ogStageLabel(i, round) {
  if (round === DREAM_TEAM_ROUND) return "DREAM TEAM";
  const sub = roundGameIndex(i);
  if (i < 3) return `GROUP · G${sub}`;
  if (i < 5) return `2ND RD · G${sub}`;
  if (i === 5) return "QUARTERFINAL";
  if (i === 6) return "SEMIFINAL";
  return "THE FINAL";
}

function gameMarginLabel(g, i) {
  if (isDreamGame(g)) return g.my > g.op ? "BONUS WIN" : "DREAM TEAM WINS";
  if (g.my > g.op) return "✓ WIN";
  return i < 3 ? "GROUP LOSS — SWEEP GONE" : i < 5 ? "2ND ROUND LOSS — SWEEP GONE" : "ELIMINATED";
}

function QuarterByQ({ myQ, opQ, otMy = [], otOp = [], myColor = "#E8465A", opColor = "#93a1b5" }) {
  const otN = Math.max(otMy.length, otOp.length);
  const headers = ["Q1", "Q2", "Q3", "Q4", ...Array.from({ length: otN }, (_, i) => (otN === 1 ? "OT" : `OT${i + 1}`))];
  const my = [...myQ, ...otMy];
  const op = [...opQ, ...otOp];
  const cellColor = (a, b) => (a > b ? "#EAF0F7" : a < b ? "#5f6b7d" : "#93a1b5");
  return (
    <div className="qByQ" style={{ gridTemplateColumns: `2.4rem repeat(${headers.length}, minmax(0, 1fr))` }}>
      <span aria-hidden="true" />
      {headers.map((h) => <span key={h} className="qByQHead">{h}</span>)}
      <span className="qByQSide" style={{ color: myColor }}>YOU</span>
      {my.map((n, i) => (
        <span key={`m${i}`} className="qByQCell" style={{ color: cellColor(n, op[i] ?? 0) }}>{n}</span>
      ))}
      <span className="qByQSide" style={{ color: opColor }}>OPP</span>
      {op.map((n, i) => (
        <span key={`o${i}`} className="qByQCell" style={{ color: cellColor(n, my[i] ?? 0) }}>{n}</span>
      ))}
    </div>
  );
}

const GAME_RESULT_STYLES = {
  win: { background: "#1d3a2a", color: "#7ee2a8", border: "1px solid #2c5c40" },
  loss: { background: "#3a1d22", color: "#f08a8a", border: "1px solid #5c2c34" },
};

function gameResultState(g) {
  if (!g) return null;
  return g.my > g.op ? "win" : "loss";
}

function marginColor(m) {
  return m > 0 ? GAME_RESULT_STYLES.win.color : GAME_RESULT_STYLES.loss.color;
}

const MatchSummaryCard = ({ g, i }) => {
  const state = gameResultState(g);
  const icon = state === "loss" ? "✕" : "✓";
  const resultStyle = GAME_RESULT_STYLES[state];
  const subIdx = roundGameIndex(i);
  const scorers = g.box?.slice(0, 3).map((p) => `${p.name} ${p.pts}`).join(", ") || "";
  const oc = oppColor(g.opp);

  return (
    <div className="matchCard panel slideL">
      <div className="matchCardRound">
        <span className="eyebrow">{roundShortLabel(i, g.round)}</span>
        {subIdx != null && <span className="eyebrow" style={{ color: "#93a1b5", fontSize: 8 }}>· G{subIdx}</span>}
      </div>
      <div className="matchCardBody">
        <div className="dsp text-sm" style={{ color: oc }}>
          VS {g.opp.name.toUpperCase()}{"\u00A0"}'{g.opp.season.slice(2)}
        </div>
        {scorers && (
          <div className="text-[11px] mt-0.5 truncate" style={{ color: "#5f6b7d" }}>
            TOP PTS · {scorers}
          </div>
        )}
      </div>
      <div className="matchCardScore" style={{
        background: resultStyle.background,
        borderLeft: resultStyle.border,
        color: resultStyle.color,
      }}>
        <div className="matchCardScoreNum">{g.my}{"\u00A0"}—{"\u00A0"}{g.op}</div>
        <span className="matchCardScoreIcon">{icon}</span>
      </div>
    </div>
  );
};

const RUN_HERO_THEMES = {
  sweep: { color: "#7ee2a8", stroke: "#2c5c40" },
  close: { color: "#e8d48a", stroke: "#5c4f28" },
  loss: { color: "#f08a8a", stroke: "#5c2c34" },
};

function runOutcomeKey(perfect, eliminated) {
  if (perfect) return "sweep";
  if (eliminated) return "loss";
  return "close";
}

function runOutcomeTheme(perfect, eliminated) {
  return RUN_HERO_THEMES[runOutcomeKey(perfect, eliminated)];
}

const RunSummaryHero = ({ perfect, eliminated, groupOut, r2Out, runStats }) => {
  if (!runStats) return null;
  const { w, l, ppgF, ppgA, bigWin } = runStats;
  const theme = runOutcomeTheme(perfect, eliminated);

  let headline, record, subLabel, statThirdLabel, statThirdValue;
  if (perfect) {
    headline = "THE PERFECT SWEEP";
    record = "8–0";
    subLabel = "UNDEFEATED";
    statThirdLabel = "BIG WIN";
    statThirdValue = `+${bigWin}`;
  } else if (eliminated) {
    headline = groupOut ? "OUT IN THE GROUP STAGE" : r2Out ? "OUT IN THE 2ND ROUND" : "ELIMINATED";
    record = `${w}–${l}`;
    subLabel = `${w} WIN${w !== 1 ? "S" : ""}`;
    statThirdLabel = "WINS";
    statThirdValue = w;
  } else {
    headline = "WORLD CHAMPIONS";
    record = `${w}–${l}`;
    subLabel = l === 1 ? "1 LOSS · STILL CHAMPIONS" : `${l} LOSSES · STILL CHAMPIONS`;
    statThirdLabel = "BIG WIN";
    statThirdValue = bigWin > 0 ? `+${bigWin}` : "—";
  }

  return (
    <div className="runHero panel p-4 sm:p-5">
      <div className="runHeroAccent" style={{ background: theme.stroke }} aria-hidden />
      <div className="eyebrow mb-1" style={{ letterSpacing: ".14em", color: theme.color, opacity: 0.8 }}>{headline}</div>
      <div className="runHeroRecord" style={{ color: theme.color }}>{record}</div>
      <div className="dsp text-sm mt-2" style={{ color: theme.color, opacity: 0.85 }}>{subLabel}</div>
      <div className="runHeroStats" style={{ borderTop: "1px solid #1c2333" }}>
        {[
          [ppgF.toFixed(1), "PTS FOR / G"],
          [ppgA.toFixed(1), "AGAINST / G"],
          [statThirdValue, statThirdLabel],
        ].map(([v, l]) => (
          <div key={l}>
            <div className="runHeroStatVal" style={{ color: theme.color }}>{v}</div>
            <div className="runHeroStatLbl" style={{ color: theme.color }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Gem = ({ rt, size = 34 }) => {
  const t = tier(rt);
  return (
    <span className="gemShield inline-flex items-center justify-center dsp9"
      style={{ width: size, height: size * 1.12, background: t.bg, color: t.fg, fontSize: size * 0.44, fontStyle: "italic" }}>
      {rt}
    </span>
  );
};

const TraitLabel = ({ traitId }) => {
  const def = TRAIT_DEFS[traitId];
  if (!def) return null;
  const color = def.pos ? "#7ee2a8" : "#f08a8a";
  return (
    <span className="traitLabelWrap relative inline-block" style={{ ["--trait-c"]: color }}>
      <span
        className="traitLabelTrigger text-[11px] cursor-help"
        style={{ color, letterSpacing: ".08em", fontFamily: "'Saira Condensed', sans-serif", fontWeight: 700 }}
        tabIndex={0}
      >
        {def.label}
      </span>
      <span className="traitLabelTip" role="tooltip">
        <span className="traitLabelTipKind" style={{ color }}>{def.pos ? "BOOST" : "RISK"}</span>
        <span className="traitLabelTipDesc">{def.desc}</span>
      </span>
    </span>
  );
};

const fieldChrome = {
  background: "#0e1219", border: "1px solid #2f3d5c", color: "#EAF0F7",
  outline: "none", borderRadius: 0,
};

const CountryCombobox = ({ value, onChange }) => {
  const selected = countryByCode(value) || COUNTRIES[0];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(
    () => COUNTRIES.filter((c) => countryMatchesQuery(c, query)),
    [query],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlight];
    el?.scrollIntoView?.({ block: "nearest" });
  }, [highlight, open, filtered]);

  const pick = (code) => {
    onChange(code);
    setOpen(false);
    setQuery("");
  };

  const display = open ? query : `${selected.flag} ${selected.name}`;

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="country-listbox"
        aria-autocomplete="list"
        autoComplete="off"
        value={display}
        placeholder="Type a country…"
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && filtered[highlight]) pick(filtered[highlight].code);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setQuery("");
            inputRef.current?.blur();
          }
        }}
        className="w-full px-3 py-2.5 text-sm"
        style={fieldChrome}
      />
      {open && (
        <ul
          id="country-listbox"
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto"
          style={{
            background: "#0e1219",
            border: "1px solid #2f3d5c",
            boxShadow: "0 12px 28px rgba(0,0,0,.45)",
          }}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm" style={{ color: "#7d8ba0" }}>No matches</li>
          ) : (
            filtered.map((c, i) => (
              <li
                key={c.code}
                role="option"
                aria-selected={c.code === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c.code)}
                onMouseEnter={() => setHighlight(i)}
                className="px-3 py-2 text-sm cursor-pointer"
                style={{
                  background: i === highlight ? "#1a2438" : "transparent",
                  color: c.code === value ? "#7ee2a8" : "#EAF0F7",
                }}
              >
                {c.flag} {c.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default function PerfectSweep() {
  const shareInit = useMemo(() => readShareFromUrl(), []);
  const shortInit = useMemo(() => (shareInit ? null : readShortIdFromUrl()), [shareInit]);
  const dailyInit = useMemo(() => (shareInit || shortInit ? null : readDailyFromUrl()), [shareInit, shortInit]);
  const browseInit = useMemo(
    () => (shareInit || shortInit || dailyInit ? null : readBrowseFromUrl()),
    [shareInit, shortInit, dailyInit],
  );
  const [mode, setMode] = useState(dailyInit ? "daily" : "free");
  const [dailyDay, setDailyDay] = useState(dailyInit?.day ?? utcDayKey());
  const [dailyStatus, setDailyStatus] = useState(null); // null | in_progress | done | expired
  const [dailyCountdown, setDailyCountdown] = useState(() => formatCountdown(msUntilUtcMidnight()));
  const [dailyBoardTab, setDailyBoardTab] = useState(!!browseInit?.dailyBoard);
  const [dailyLbEntries, setDailyLbEntries] = useState([]);
  const [dailyLbCount, setDailyLbCount] = useState(0);
  const [dailyLbLoading, setDailyLbLoading] = useState(false);
  const [dailyLbError, setDailyLbError] = useState(null);
  const [dailyCpuEnabled, setDailyCpuEnabled] = useState(true);
  const [dailyCpuTargetN, setDailyCpuTargetN] = useState(CPU_TARGET_N_DEFAULT);
  const [dailyBoardNow, setDailyBoardNow] = useState(() => Date.now());
  const [boardInspect, setBoardInspect] = useState(null);
  const [boardInspectLoading, setBoardInspectLoading] = useState(false);
  const boardInspectGen = useRef(0);
  const [dailySubmitted, setDailySubmitted] = useState(false);
  const [showDailySubmit, setShowDailySubmit] = useState(false);
  const [dailyToast, setDailyToast] = useState(null);
  const [dailyStreak, setDailyStreak] = useState(() => loadDailyStreak());
  const dailyBooted = useRef(false);

  // Cup Final (local pass-and-play + online room)
  const roomUrlInit = useMemo(() => (shareInit || shortInit || dailyInit ? null : readRoomFromUrl()), []); // eslint-disable-line
  const [cupSeed, setCupSeed] = useState(null);
  const [cupCode, setCupCode] = useState(null);
  const [cupDrafting, setCupDrafting] = useState(0);
  const [cupPlayers, setCupPlayers] = useState([null, null]);
  const [cupResult, setCupResult] = useState(null);
  const [cupRoom, setCupRoom] = useState(null);
  const [cupSlot, setCupSlot] = useState(null);
  const [cupBusy, setCupBusy] = useState(false);
  const [cupError, setCupError] = useState(null);
  const [cupJoinCode, setCupJoinCode] = useState(roomUrlInit?.roomId || "");
  const [cupP0Nick, setCupP0Nick] = useState("");
  const [cupP0Country, setCupP0Country] = useState("US");
  const [cupP1Nick, setCupP1Nick] = useState("");
  const [cupP1Country, setCupP1Country] = useState("CZ");
  const cupSimmedRef = useRef(null);

  const isCupMode = mode === "cup" || mode === "cupOnline";

  const [screen, setScreen] = useState(
    shareInit ? "card" : shortInit ? "shareload" : dailyInit ? "dailyboot" : roomUrlInit ? "cupjoin" : browseInit?.screen ?? "home",
  );
  const [shortId, setShortId] = useState(shortInit);
  const shortRunRef = useRef(null); // { id, payload } — which encoded run the short id belongs to
  const [browseNation, setBrowseNation] = useState(browseInit?.browseNation ?? null);
  const [deck, setDeck] = useState([]);
  const [rolls, setRolls] = useState(shareInit?.rolls ?? 0);
  const [lineup, setLineup] = useState(shareInit?.lineup ?? {});
  const [style, setStyle] = useState(STYLES[1]);
  const [games, setGames] = useState(shareInit?.games ?? []);
  const [gauntlet, setGauntlet] = useState([]);
  const [gi, setGi] = useState(shareInit?.gi ?? 0);
  const [rivalGames, setRivalGames] = useState([]);
  const [groupOut, setGroupOut] = useState(shareInit?.groupOut ?? false);
  const [r2, setR2] = useState(null); // second round: carried result + rival fixtures
  const [r2Out, setR2Out] = useState(shareInit?.r2Out ?? false);
  const [swapsLeft, setSwapsLeft] = useState(2); // shared pool — spend on nation or year
  const [speed, setSpeed] = useState("medium"); // fast | medium | slow
  const [live, setLive] = useState(null);
  const [pickedThisRoll, setPickedThisRoll] = useState(false);
  const [seenNations, setSeenNations] = useState([]);
  const [seenYears, setSeenYears] = useState([]);
  const [openFlow, setOpenFlow] = useState({});
  const [linkCopied, setLinkCopied] = useState(false);
  const [storyBusy, setStoryBusy] = useState(false);
  const [dreamTeamMode, setDreamTeamMode] = useState(false);
  const [dreamGamePlayed, setDreamGamePlayed] = useState(
    () => !!(shareInit?.games?.some(isDreamGame)),
  );
  const [leaderboardSubmitted, setLeaderboardSubmitted] = useState(false);
  const [hallSkipped, setHallSkipped] = useState(false);
  const [hallNick, setHallNick] = useState("");
  const [hallCountry, setHallCountry] = useState("US");
  const [hallSubmitting, setHallSubmitting] = useState(false);
  const [hallError, setHallError] = useState(null);
  const [hallToast, setHallToast] = useState(null);
  const [lbEntries, setLbEntries] = useState([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbError, setLbError] = useState(null);
  const runId = useRef(0);
  const ctaAnchorRef = useRef(null);
  const runCompletedTrackedRef = useRef(false);
  const shareArrivalTrackedRef = useRef(false);

  const openTeams = () => {
    setBrowseNation(null);
    setScreen("teams");
  };

  const openAbout = () => {
    setBrowseNation(null);
    setScreen("about");
  };

  const openHowTo = () => {
    setBrowseNation(null);
    setScreen("howto");
  };

  const openLeaderboard = () => {
    setBrowseNation(null);
    setDailyBoardTab(false);
    setScreen("leaderboard");
  };

  const openNation = (name) => {
    setBrowseNation(name);
    setScreen("team");
  };

  const browseNationData = useMemo(
    () => (browseNation ? NATIONS_ARCHIVE.find((n) => n.name === browseNation) : null),
    [browseNation],
  );

  const cur = deck[0];
  // strictly orthogonal, and never returns a nation/year already shown on this roll
  const nationPool = cur ? TEAMS.filter((t) => t.season === cur.season && !seenNations.includes(t.name)) : [];
  const yearPool = cur ? TEAMS.filter((t) => t.name === cur.name && !seenYears.includes(t.season)) : [];

  const switchNation = () => {
    if (!cur || swapsLeft <= 0 || !nationPool.length || pickedThisRoll || fiveSet) return;
    if (mode === "daily" && dailyStatus === "done") return;
    const rand = mode === "daily"
      ? rng(dailyDay, "swapNation", seenNations.length)
      : isCupMode && cupSeed
        ? roomRng(cupSeed, "swapNation", seenNations.length)
        : Math.random;
    const t = shuffle(nationPool, rand)[0];
    setDeck([t]); setSwapsLeft((n) => n - 1); setPickedThisRoll(false);
    setSeenNations((s) => [...s, t.name]);
  };

  const switchYear = () => {
    if (!cur || swapsLeft <= 0 || !yearPool.length || pickedThisRoll || fiveSet) return;
    if (mode === "daily" && dailyStatus === "done") return;
    const rand = mode === "daily"
      ? rng(dailyDay, "swapYear", seenYears.length)
      : isCupMode && cupSeed
        ? roomRng(cupSeed, "swapYear", seenYears.length)
        : Math.random;
    const t = shuffle(yearPool, rand)[0];
    setDeck([t]); setSwapsLeft((n) => n - 1); setPickedThisRoll(false);
    setSeenYears((s) => [...s, t.season]);
  };

  const filled = SLOTS.filter((s) => lineup[s]).length;
  const myRt = useMemo(() => filled ? SLOTS.reduce((s, k) => s + (lineup[k]?.rt || 0), 0) / Math.max(filled, 1) : 0, [lineup, filled]);

  const alreadySigned = (p) => SLOTS.some((s) => lineup[s]?.name === p.name);

  // anyone on the rolled squad we could still legally sign?
  const hasEligible = cur ? cur.players.some((p) => !lineup[p.pos] && !alreadySigned(p)) : false;
  // ROLL AGAIN locked until you sign from the current squad (unless nobody signable).
  // Once the starting five is full, rolling is disabled — tip off instead.
  const fiveSet = filled === 5;
  const canRoll = !fiveSet && (!deck.length || pickedThisRoll || !hasEligible);

  const roll = () => {
    if (!canRoll) return;
    if (mode === "daily" && dailyStatus === "done") return;
    const nextRoll = rolls + 1;
    const rand = mode === "daily"
      ? rng(dailyDay, "roll", nextRoll)
      : isCupMode && cupSeed
        ? roomRng(cupSeed, "roll", nextRoll)
        : Math.random;
    const t = shuffle(TEAMS, rand)[0];
    setDeck([t]); setRolls(nextRoll); setPickedThisRoll(false);
    setSeenNations([t.name]); setSeenYears([t.season]);
  };

  const pick = (team, p) => {
    if (lineup[p.pos] || pickedThisRoll || alreadySigned(p)) return; // one per roll, no duplicates
    setLineup({ ...lineup, [p.pos]: { ...p, team: team.name, season: team.season, tc: team.c } });
    setPickedThisRoll(true);
  };

  const neutralGame = (ta, tb, rand = Math.random) => {
    const d = (teamRating(ta) - teamRating(tb)) * 1.15;
    const noise = () => (rand() - 0.5) * 22;
    let sa = Math.round(86 + d / 2 + noise()), sb = Math.round(86 - d / 2 + noise());
    if (sa === sb) sa += 2;
    return { sa: Math.max(58, sa), sb: Math.max(58, sb) };
  };

  const startTournament = () => {
    if (isCupMode) return;
    if (mode === "daily" && dailyStatus === "done") return;
    // real FIBA system: group of 4 → 2nd round group (carry-over + 2 new games) → QF, SF, Final = 8 games
    let g8;
    let pairs;
    if (mode === "daily") {
      const bracket = buildDailyBracket(dailyDay);
      g8 = bracket.gauntlet;
      pairs = bracket.rivalGames;
    } else {
      g8 = buildGauntlet(Math.random);
      const rivals = g8.slice(0, 3);
      pairs = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => {
        const r = neutralGame(rivals[a], rivals[b], Math.random);
        return { a, b, sa: r.sa, sb: r.sb };
      });
    }
    setGauntlet(g8);
    setRivalGames(pairs);
    setGroupOut(false); setR2(null); setR2Out(false);
    setGames([]); setGi(0); setScreen("sim");
    if (mode === "daily") {
      setDailyStatus("in_progress");
      saveDailyState(dailyDay, {
        status: "in_progress",
        screen: "sim",
        rolls, lineup: serializeLineup(lineup), styleId: style.id,
        swapsLeft, seenNations, seenYears,
        gauntlet: g8.map((t) => ({ name: t.name, season: t.season })),
        rivalGames: pairs,
        games: [], gi: 0, groupOut: false, r2Out: false, r2: null,
        dreamTeamMode: false, dreamGamePlayed: false,
      });
    }
  };

  const computeTable = (played) => {
    if (played.length < 3 || !gauntlet.length) return null;
    const rows = [
      { id: "me", name: "YOUR FIVE", c: "#E8465A", w: 0, l: 0, pf: 0, pa: 0 },
      ...gauntlet.slice(0, 3).map((t, i) => ({ id: i, name: `${t.name} '${t.season.slice(2)}`, c: oppColor(t), w: 0, l: 0, pf: 0, pa: 0 })),
    ];
    const get = (id) => rows.find((r) => r.id === id);
    const add = (idA, idB, sa, sb) => {
      const A = get(idA), B = get(idB);
      A.pf += sa; A.pa += sb; B.pf += sb; B.pa += sa;
      if (sa > sb) { A.w++; B.l++; } else { B.w++; A.l++; }
    };
    played.slice(0, 3).forEach((g, i) => add("me", i, g.my, g.op));
    rivalGames.forEach((rg) => add(rg.a, rg.b, rg.sa, rg.sb));
    rows.forEach((r) => { r.pts = r.w * 2 + r.l; r.diff = r.pf - r.pa; });
    rows.sort((x, y) => y.pts - x.pts || y.diff - x.diff || y.pf - x.pf);
    return rows;
  };
  const groupTable = useMemo(() => computeTable(games), [games, rivalGames, gauntlet]); // eslint-disable-line

  /* 2nd-round group: me + the rival who advanced with me + gauntlet[3] & [4].
     Result vs the co-advancing rival carries over; so does the new pair's own group game. */
  const setupSecondRound = (played, table) => {
    const coIdx = table.slice(0, 2).find((r) => r.id !== "me").id; // rival advancing with me
    const rival = gauntlet[coIdx];
    const carried = { my: played[coIdx].my, op: played[coIdx].op }; // my group game vs that rival
    const A = gauntlet[3], B = gauntlet[4];
    const n = (lane) => (mode === "daily" ? rng(dailyDay, "neutral", lane) : Math.random);
    setR2({
      rival, coIdx, carried,
      abCarry: neutralGame(A, B, n("ab")),
      rivalVsA: neutralGame(rival, A, n("rA")),
      rivalVsB: neutralGame(rival, B, n("rB")),
    });
  };

  const computeR2Table = (played) => {
    if (!r2 || played.length < 5) return null;
    const A = gauntlet[3], B = gauntlet[4];
    const rows = [
      { id: "me", name: "YOUR FIVE", c: "#E8465A", w: 0, l: 0, pf: 0, pa: 0 },
      { id: "riv", name: `${r2.rival.name} '${r2.rival.season.slice(2)}`, c: oppColor(r2.rival), w: 0, l: 0, pf: 0, pa: 0 },
      { id: "A", name: `${A.name} '${A.season.slice(2)}`, c: oppColor(A), w: 0, l: 0, pf: 0, pa: 0 },
      { id: "B", name: `${B.name} '${B.season.slice(2)}`, c: oppColor(B), w: 0, l: 0, pf: 0, pa: 0 },
    ];
    const get = (id) => rows.find((r) => r.id === id);
    const add = (idA, idB, sa, sb) => {
      const X = get(idA), Y = get(idB);
      X.pf += sa; X.pa += sb; Y.pf += sb; Y.pa += sa;
      if (sa > sb) { X.w++; Y.l++; } else { Y.w++; X.l++; }
    };
    add("me", "riv", r2.carried.my, r2.carried.op); // carried over
    add("A", "B", r2.abCarry.sa, r2.abCarry.sb);    // carried over
    add("me", "A", played[3].my, played[3].op);
    add("me", "B", played[4].my, played[4].op);
    add("riv", "A", r2.rivalVsA.sa, r2.rivalVsA.sb);
    add("riv", "B", r2.rivalVsB.sa, r2.rivalVsB.sb);
    rows.forEach((r) => { r.pts = r.w * 2 + r.l; r.diff = r.pf - r.pa; });
    rows.sort((x, y) => y.pts - x.pts || y.diff - x.diff || y.pf - x.pf);
    return rows;
  };
  const r2Table = useMemo(() => computeR2Table(games), [games, r2, gauntlet]); // eslint-disable-line

  const commitGame = (g, box) => {
    const flow = buildFlow(buildEvents(g, box, g.opp));
    const next = [...games, { ...g, box, round: ROUNDS[gi], story: buildStory(g, box, style), flow }];
    setGames(next);
    if (gi < 2) { setGi(gi + 1); return; }
    if (gi === 2) { // group stage done — table decides
      const table = computeTable(next);
      const myRank = table.findIndex((r) => r.id === "me") + 1;
      if (myRank > 2) { setGroupOut(true); setScreen("done"); }
      else { setupSecondRound(next, table); setGi(3); }
      return;
    }
    if (gi === 3) { setGi(4); return; } // 2nd-round losses don't eliminate either
    if (gi === 4) { // 2nd round done — table decides QF spots
      const table = computeR2Table(next);
      const myRank = table.findIndex((r) => r.id === "me") + 1;
      if (myRank > 2) { setR2Out(true); setScreen("done"); } else setGi(5);
      return;
    }
    if (g.my < g.op || gi === 7) setScreen("done"); // knockouts: lose and you're out
    else setGi(gi + 1);
  };

  const playNext = () => {
    if (live) return;
    const lu = SLOTS.map((s) => lineup[s]);
    const g = simGameWithTraits(lu, myRt, style, gauntlet[gi], gi, games.length);
    const box = boxScore(lu, g.my);
    runLiveGame(g, box, ROUNDS[gi], (result, resultBox) => commitGame(result, resultBox));
  };

  const runLiveGame = (g, box, roundLabel, onCommit) => {
    if (speed === "fast") { onCommit(g, box); return; }

    const evs = buildEvents(g, box, g.opp);
    const steps = chunkEvents(evs, speed === "medium" ? 40 : 28);
    const delay = speed === "medium" ? 65 : 700;
    const id = ++runId.current;
    setLive({ opp: g.opp, round: roundLabel, my: 0, op: 0, clock: "Q1 10:00", feed: [] });
    let k = 0;
    const step = () => {
      if (id !== runId.current) return;
      if (k >= steps.length) {
        setTimeout(() => { if (id !== runId.current) return; setLive(null); onCommit(g, box); }, speed === "medium" ? 300 : 800);
        return;
      }
      const st = steps[k++];
      setLive((l) => l && ({
        ...l, my: l.my + st.dMy, op: l.op + st.dOp, clock: st.clock,
        feed: speed === "slow"
          ? [...l.feed, { clock: st.clock, text: st.text, team: st.team, my: l.my + st.dMy, op: l.op + st.dOp }].slice(-8)
          : l.feed,
      }));
      setTimeout(step, delay);
    };
    setTimeout(step, delay);
  };

  const faceDreamTeam = () => {
    setDreamTeamMode(true);
    setScreen("sim");
  };

  const commitDreamGame = (g, box) => {
    const flow = buildFlow(buildEvents(g, box, g.opp));
    const next = [...games, { ...g, box, round: DREAM_TEAM_ROUND, story: buildStory(g, box, style), flow }];
    setGames(next);
    setDreamTeamMode(false);
    setDreamGamePlayed(true);
    setScreen("done");
  };

  const playDreamTeam = () => {
    if (live) return;
    const lu = SLOTS.map((s) => lineup[s]);
    const tCount = games.filter((x) => !isDreamGame(x)).length;
    const g = simGameWithTraits(lu, myRt, style, DREAM_TEAM, 8, tCount);
    const box = boxScore(lu, g.my);
    runLiveGame(g, box, DREAM_TEAM_ROUND, commitDreamGame);
  };

  // Boot from a short share link: /r/<id> redirects here as /?r=<id>.
  useEffect(() => {
    if (!shortInit) return;
    let cancelled = false;
    const fail = () => {
      if (cancelled) return;
      setShortId(null);
      setScreen("home");
      window.history.replaceState(null, "", window.location.pathname);
    };
    fetch(`/api/runs?id=${encodeURIComponent(shortInit)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const decoded = d?.payload ? decodeRunShare(`?card=${d.payload}`) : null;
        if (!decoded) return fail();
        shortRunRef.current = { id: shortInit, payload: d.payload };
        setRolls(decoded.rolls); setLineup(decoded.lineup); setGames(decoded.games);
        setGi(decoded.gi); setGroupOut(decoded.groupOut); setR2Out(decoded.r2Out);
        setDreamGamePlayed(decoded.games.some(isDreamGame));
        setScreen("card");
        if (!shareArrivalTrackedRef.current) {
          shareArrivalTrackedRef.current = true;
          trackEvent("shared_result_opened", { runId: shortInit });
          trackEvent("came_from_share", { runId: shortInit });
        }
      })
      .catch(fail);
    return () => { cancelled = true; };
  }, [shortInit]); // eslint-disable-line

  const hydrateDailyState = (day, saved) => {
    setMode("daily");
    setDailyDay(day);
    setDailySubmitted(!!saved.submitted);
    if (saved.styleId) {
      const st = STYLES.find((s) => s.id === saved.styleId);
      if (st) setStyle(st);
    }
    setRolls(saved.rolls ?? 0);
    setLineup(saved.lineup || {});
    setSwapsLeft(saved.swapsLeft ?? 2);
    setSeenNations(saved.seenNations || []);
    setSeenYears(saved.seenYears || []);
    setGroupOut(!!saved.groupOut);
    setR2Out(!!saved.r2Out);
    setGi(saved.gi ?? 0);
    setDreamTeamMode(!!saved.dreamTeamMode);
    setDreamGamePlayed(!!saved.dreamGamePlayed);
    if (Array.isArray(saved.gauntlet)) {
      setGauntlet(saved.gauntlet.map(resolveTeamRef).filter(Boolean));
    }
    if (Array.isArray(saved.rivalGames)) setRivalGames(saved.rivalGames);
    if (saved.r2?.rival) {
      const rival = resolveTeamRef(saved.r2.rival);
      setR2(rival ? { ...saved.r2, rival } : null);
    } else setR2(null);
    if (Array.isArray(saved.games)) {
      setGames(saved.games.map((g) => ({
        ...g,
        opp: resolveTeamRef(g.opp) || g.opp,
      })).filter((g) => g.opp));
    }
    if (saved.shortId) {
      setShortId(saved.shortId);
      shortRunRef.current = saved.shortPayload
        ? { id: saved.shortId, payload: saved.shortPayload }
        : shortRunRef.current;
    }
    setDailyStatus(saved.status);
    setDailyStreak(loadDailyStreak());
    if (saved.status === "done") setScreen(saved.screen === "card" ? "card" : "done");
    else if (saved.status === "in_progress") setScreen(saved.screen || "sim");
    else setScreen("draft");
  };

  // Boot Daily Challenge from ?daily
  useEffect(() => {
    if (!dailyInit || dailyBooted.current) return;
    dailyBooted.current = true;
    const day = dailyInit.day;
    const today = utcDayKey();
    setMode("daily");
    setDailyDay(day);
    window.history.replaceState(null, "", `${window.location.pathname}?daily=${day}`);

    if (day !== today) {
      const saved = loadDailyState(day);
      if (saved?.status === "done") {
        hydrateDailyState(day, saved);
      } else {
        setDailyStatus("expired");
        setScreen("home");
        setDailyToast("That challenge has ended.");
        setTimeout(() => setDailyToast(null), 2800);
      }
      return;
    }

    const saved = loadDailyState(day);
    if (saved?.status === "done" || saved?.status === "in_progress") {
      hydrateDailyState(day, saved);
      return;
    }
    setDailyStatus(null);
    setScreen("draft");
    // Auto first roll with seeded RNG
    const rand = rng(day, "roll", 1);
    const t = shuffle(TEAMS, rand)[0];
    setDeck([t]); setRolls(1); setPickedThisRoll(false);
    setSeenNations([t.name]); setSeenYears([t.season]);
  }, [dailyInit]); // eslint-disable-line

  // UTC midnight countdown + expire mid-run
  useEffect(() => {
    if (mode !== "daily") return undefined;
    const tick = () => {
      const today = utcDayKey();
      setDailyCountdown(formatCountdown(msUntilUtcMidnight()));
      if (dailyDay !== today && dailyStatus !== "done") {
        clearDailyState(dailyDay);
        setDailyStatus("expired");
        setDailyToast("Daily Challenge expired at midnight UTC.");
        setTimeout(() => setDailyToast(null), 3200);
        runId.current++;
        setLive(null);
        setScreen("home");
        setMode("free");
        setDeck([]); setLineup({}); setGames([]); setGi(0); setRolls(0);
        setGauntlet([]); setRivalGames([]); setR2(null);
        setGroupOut(false); setR2Out(false);
        window.history.replaceState(null, "", window.location.pathname);
      }
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [mode, dailyDay, dailyStatus]);

  // Persist in-progress / done daily state
  useEffect(() => {
    if (mode !== "daily" || !dailyDay) return;
    if (dailyStatus !== "in_progress" && dailyStatus !== "done") return;
    if (dailyStatus === "in_progress" && screen !== "sim" && screen !== "done" && screen !== "card") return;

    const tg = games.filter((g) => !isDreamGame(g));
    const dg = games.find(isDreamGame);
    const w = tg.filter((g) => g.my > g.op).length;
    const l = tg.length - w;
    const isPerfect = tg.length === 8 && tg.every((g) => g.my > g.op);
    const margins = tg.map((g) => g.my - g.op);
    const dreamMargin = dg ? dg.my - dg.op : null;
    const ovr = Math.round(myRt);
    const eff = efficiencyFrom(margins, ovr, isPerfect && dreamMargin != null && dreamMargin > 0 ? dreamMargin : null);

    const payload = {
      status: dailyStatus === "done" || screen === "done" || screen === "card" ? (dailyStatus === "in_progress" && screen === "sim" ? "in_progress" : dailyStatus) : dailyStatus,
      screen,
      rolls, lineup: serializeLineup(lineup), styleId: style.id,
      swapsLeft, seenNations, seenYears,
      gauntlet: gauntlet.map((t) => ({ name: t.name, season: t.season })),
      rivalGames,
      r2: r2 ? { ...r2, rival: r2.rival ? { name: r2.rival.name, season: r2.rival.season } : null } : null,
      games: serializeGames(games),
      gi, groupOut, r2Out, dreamTeamMode, dreamGamePlayed,
      shortId: shortId || null,
      shortPayload: shortRunRef.current?.payload || null,
      submitted: dailySubmitted,
      result: {
        w, l, perfect: isPerfect, ovr, margins, efficiency: eff,
        dreamMargin,
      },
    };

    // Promote to done when the run ends
    if ((screen === "done" || screen === "card") && games.length) {
      const eliminatedNow = groupOut || r2Out || (tg.length > 5 && tg[tg.length - 1] && tg[tg.length - 1].my < tg[tg.length - 1].op);
      const finished = eliminatedNow || (tg.length === 8 && (!isPerfect || dreamGamePlayed));
      // Keep in_progress while waiting for optional Dream Team after a sweep
      if (finished || (eliminatedNow) || (tg.length === 8 && !isPerfect) || (isPerfect && dreamGamePlayed)) {
        payload.status = "done";
        if (dailyStatus !== "done") setDailyStatus("done");
      }
      // Streak: today's UTC challenge only (incl. pre–Dream Team), once per day
      if ((eliminatedNow || tg.length === 8) && dailyDay === utcDayKey()) {
        const resultKey = isPerfect ? "sweep"
          : (!eliminatedNow && tg.length === 8) ? "champs"
          : groupOut ? "group"
          : r2Out ? "r2"
          : eliminatedNow ? "elim"
          : "run";
        const streak = recordDailyStreak(dailyDay, resultKey);
        if (streak.updated) setDailyStreak(streak);
      }
    }
    saveDailyState(dailyDay, payload);
  }, [mode, dailyDay, dailyStatus, screen, rolls, lineup, style, swapsLeft, seenNations, seenYears, gauntlet, rivalGames, r2, games, gi, groupOut, r2Out, dreamTeamMode, dreamGamePlayed, shortId, dailySubmitted, myRt]);

  /* Display-only summary sent alongside the payload — powers the /r/:id OG preview. */
  const buildShareMeta = () => {
    const margins = tournamentGames.map((g) => g.my - g.op);
    const ovr = runStats?.ovr ?? Math.round(myRt);
    const dreamMargin = dreamGame ? dreamGame.my - dreamGame.op : null;
    const base = {
      v: 1,
      result: perfect ? "sweep" : worldChampions ? "champs" : groupOut ? "group" : r2Out ? "r2" : eliminated ? "elim" : "run",
      w: wins,
      l: losses,
      margins,
      games: tournamentGames.map((g, i) => ({
        stage: ogStageLabel(i, g.round),
        my: g.my,
        op: g.op,
        m: g.my - g.op,
      })),
      dream: dreamMargin,
      dreamGame: dreamGame ? {
        stage: "DREAM TEAM",
        my: dreamGame.my,
        op: dreamGame.op,
        m: dreamMargin,
      } : null,
      score: runStats?.marginScore ?? null,
      ovr,
      players: SLOTS.map((s) => lineup[s]).filter(Boolean).map((p) => ({
        pos: p.pos, name: p.name, rt: p.rt, t: `${p.team} '${String(p.season).slice(2)}`,
      })),
    };
    if (mode === "daily") {
      const streakN = dailyStreak?.currentStreak || 0;
      return {
        ...base,
        mode: "daily",
        day: dailyDay,
        n: dailyNumber(dailyDay),
        efficiency: efficiencyFrom(margins, ovr, perfect && dreamMargin != null && dreamMargin > 0 ? dreamMargin : null),
        ...(streakN > 1 ? { streak: streakN } : {}),
      };
    }
    return { ...base, mode: "free" };
  };

  const buildShareText = (url) => {
    const grid = tournamentGames.map((g) => (g.my > g.op ? "🟩" : "🟥")).join("");
    const star = dreamGame ? (dreamGame.my > dreamGame.op ? "⭐" : "⬛") : "";
    const meta = buildShareMeta();
    const seed = shortId || `${meta.result}|${meta.w}|${meta.l}|${meta.ovr}`;
    const copy = shareCopy(meta, seed);
    if (mode === "daily") {
      const ovr = runStats?.ovr ?? Math.round(myRt);
      const eff = efficiencyFrom(
        tournamentGames.map((g) => g.my - g.op),
        ovr,
        perfect && dreamGame && dreamGame.my > dreamGame.op ? dreamGame.my - dreamGame.op : null,
      );
      const challengeUrl = `${window.location.origin}/?daily`;
      const streakBit = formatStreakShare(dailyStreak);
      const stats = streakBit
        ? `${meta.w}–${meta.l} · OVR ${ovr} · EFF ${eff} · ${streakBit}`
        : `${meta.w}–${meta.l} · OVR ${ovr} · EFF ${eff}`;
      return `${copy.shareLead}\n${grid}${star}\n${stats}\n${challengeUrl}`;
    }
    return `${copy.shareLead}\n${grid}${star}\n${url}`;
  };

  // POST the run once and reuse the content-hash id for link + story image.
  const ensureShortRun = async () => {
    const payload = encodeRunShare({ rolls, groupOut, r2Out, lineup, games }).split("card=")[1];
    if (shortRunRef.current?.payload === payload) return shortRunRef.current.id;
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, meta: buildShareMeta() }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.id) throw new Error(data?.error || "share failed");
    shortRunRef.current = { id: data.id, payload };
    setShortId(data.id);
    return data.id;
  };

  const shareLink = async () => {
    const done = () => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); };
    let url;
    let id = shortId || null;
    try {
      id = await ensureShortRun();
      url = `${window.location.origin}/r/${id}`;
      window.history.replaceState(null, "", `${window.location.pathname}?r=${id}`);
    } catch (e) {
      // API down → fall back to the legacy long ?card= link (no OG preview, but still works).
      const path = encodeRunShare({ rolls, groupOut, r2Out, lineup, games });
      url = `${window.location.origin}${path}`;
      window.history.replaceState(null, "", path);
    }
    const text = buildShareText(url);
    const tryWebShare = !!(navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
    trackEvent("share_clicked", {
      runId: id || undefined,
      channel: tryWebShare ? "web_share" : "clipboard",
    });
    if (tryWebShare) {
      try { await navigator.share({ text }); done(); return; }
      catch (e) { if (e?.name === "AbortError") return; }
    }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(done);
    else {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta); done();
    }
  };

  const shareStoryImage = async () => {
    if (storyBusy) return;
    setStoryBusy(true);
    try {
      const id = await ensureShortRun();
      trackEvent("share_clicked", { runId: id, channel: "story" });
      window.history.replaceState(null, "", `${window.location.pathname}?r=${id}`);
      const res = await fetch(`/api/og?id=${id}&format=story`);
      if (!res.ok) throw new Error("image failed");
      const blob = await res.blob();
      const file = new File([blob], "perfect-sweep-story.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); setStoryBusy(false); return; }
        catch (e) { if (e?.name === "AbortError") { setStoryBusy(false); return; } }
      }
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href; a.download = "perfect-sweep-story.png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
    } catch (e) {}
    setStoryBusy(false);
  };

  useEffect(() => {
    if (screen === "shareload" || screen === "dailyboot") return;
    if (mode === "daily" && dailyDay && (screen === "draft" || screen === "sim" || screen === "done")) {
      window.history.replaceState(null, "", `${window.location.pathname}?daily=${dailyDay}`);
      return;
    }
    if (screen === "card" && games.length && SLOTS.every((s) => lineup[s])) {
      const path = encodeRunShare({ rolls, groupOut, r2Out, lineup, games });
      const short = shortRunRef.current;
      window.history.replaceState(null, "", short && path.endsWith(short.payload)
        ? `${window.location.pathname}?r=${short.id}`
        : path);
      return;
    }
    if (screen === "teams") {
      window.history.replaceState(null, "", `${window.location.pathname}?teams`);
      return;
    }
    if (screen === "about") {
      window.history.replaceState(null, "", `${window.location.pathname}?about`);
      return;
    }
    if (screen === "howto") {
      window.history.replaceState(null, "", `${window.location.pathname}?howto`);
      return;
    }
    if (screen === "leaderboard") {
      window.history.replaceState(null, "", dailyBoardTab
        ? `${window.location.pathname}?daily-board`
        : `${window.location.pathname}?leaderboard`);
      return;
    }
    if (screen === "team" && browseNation) {
      window.history.replaceState(null, "", `${window.location.pathname}?team=${nationSlug(browseNation)}`);
      return;
    }
    if (mode === "cupOnline" && cupCode && (screen === "cuplobby" || screen === "draft" || screen === "cupresult")) {
      window.history.replaceState(null, "", `${window.location.pathname}?room=${cupCode}`);
      return;
    }
    const q = window.location.search;
    if (q.includes("card=") || /[?&]r=/.test(q) || q.includes("daily") || q.includes("room") || q.includes("teams") || q.includes("team=") || q.includes("about") || q.includes("howto") || q.includes("leaderboard") || q.includes("daily-board")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [screen, rolls, groupOut, r2Out, lineup, games, browseNation, shortId, mode, dailyDay, dailyBoardTab, cupCode]);

  // After a match ends, bring the continue CTA into view (esp. mobile + standings).
  useEffect(() => {
    if (live) return;
    if (screen !== "sim" && screen !== "done") return;
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      setTimeout(() => {
        if (cancelled) return;
        ctaAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [live, screen, games.length, dreamTeamMode, gi]);

  // Cup Final online — poll room ~1.8s
  useEffect(() => {
    if (mode !== "cupOnline" || !cupCode) return undefined;
    if (screen !== "cuplobby" && screen !== "draft") return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const room = await fetchRoom(cupCode);
        if (cancelled) return;
        setCupRoom(room);
        setCupSeed(room.seed);
        if (room.phase === "draft" && screen === "cuplobby") {
          const me = cupSlot != null ? room.players[cupSlot] : null;
          if (me?.draftDone) {
            // Waiting for opponent — stay in lobby.
          } else {
            beginCupDraftBoard(room.seed);
            setScreen("draft");
          }
        } else if (room.phase === "sim" || room.phase === "done") {
          maybeSimOnlineRoom(room);
        }
      } catch (err) {
        if (!cancelled) setCupError(err.message || "Room expired.");
      }
    };
    tick();
    const id = setInterval(tick, ROOM_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [mode, cupCode, screen]); // eslint-disable-line

  const reset = () => {
    runId.current++; setLive(null); setLinkCopied(false); setShortId(null); setStoryBusy(false); shortRunRef.current = null; setScreen("home"); setDeck([]); setLineup({}); setGames([]); setGi(0); setRolls(0);
    setSwapsLeft(2); setRivalGames([]); setGroupOut(false); setR2(null); setR2Out(false); setGauntlet([]);
    setPickedThisRoll(false); setSeenNations([]); setSeenYears([]); setOpenFlow({});
    setDreamTeamMode(false); setDreamGamePlayed(false);
    setLeaderboardSubmitted(false); setHallSkipped(false); setHallNick(""); setHallCountry("US");
    setHallSubmitting(false); setHallError(null); setHallToast(null);
    setBrowseNation(null);
    setMode("free"); setDailyStatus(null); setShowDailySubmit(false); setDailySubmitted(false);
    setDailyDay(utcDayKey());
    setCupSeed(null); setCupCode(null); setCupDrafting(0); setCupPlayers([null, null]);
    setCupResult(null); setCupRoom(null); setCupSlot(null); setCupBusy(false); setCupError(null);
    cupSimmedRef.current = null;
    runCompletedTrackedRef.current = false;
    clearRoomSession();
    window.history.replaceState(null, "", window.location.pathname);
  };

  const startFreePlay = () => {
    setMode("free");
    setDailyStatus(null);
    setDailySubmitted(false);
    setShowDailySubmit(false);
    runId.current++; setLive(null); setShortId(null); shortRunRef.current = null;
    setLineup({}); setGames([]); setGi(0); setGauntlet([]); setRivalGames([]);
    setGroupOut(false); setR2(null); setR2Out(false); setSwapsLeft(2);
    setDreamTeamMode(false); setDreamGamePlayed(false);
    setPickedThisRoll(false); setOpenFlow({});
    const t = shuffle(TEAMS)[0];
    setDeck([t]); setRolls(1);
    setSeenNations([t.name]); setSeenYears([t.season]);
    setScreen("draft");
    window.history.replaceState(null, "", window.location.pathname);
  };

  const startDailyChallenge = () => {
    const day = utcDayKey();
    const saved = loadDailyState(day);
    setMode("daily");
    setDailyDay(day);
    window.history.replaceState(null, "", `${window.location.pathname}?daily=${day}`);
    if (saved?.status === "done" || saved?.status === "in_progress") {
      hydrateDailyState(day, saved);
      return;
    }
    runId.current++; setLive(null); setShortId(null); shortRunRef.current = null;
    setLineup({}); setGames([]); setGi(0); setGauntlet([]); setRivalGames([]);
    setGroupOut(false); setR2(null); setR2Out(false); setSwapsLeft(2);
    setDreamTeamMode(false); setDreamGamePlayed(false);
    setDailyStatus(null); setDailySubmitted(false); setShowDailySubmit(false);
    const rand = rng(day, "roll", 1);
    const t = shuffle(TEAMS, rand)[0];
    setDeck([t]); setRolls(1); setPickedThisRoll(false);
    setSeenNations([t.name]); setSeenYears([t.season]);
    setScreen("draft");
  };

  const beginCupDraftBoard = (seed) => {
    runId.current++;
    setLive(null);
    setLineup({});
    setSwapsLeft(2);
    setPickedThisRoll(false);
    setOpenFlow({});
    const rand = roomRng(seed, "roll", 1);
    const t = shuffle(TEAMS, rand)[0];
    setDeck([t]);
    setRolls(1);
    setSeenNations([t.name]);
    setSeenYears([t.season]);
  };

  const runCupSim = (p0, p1, seed) => {
    const styleA = STYLES.find((s) => s.id === (p0.styleId || "bal")) || STYLES[1];
    const styleB = STYLES.find((s) => s.id === (p1.styleId || "bal")) || STYLES[1];
    const rand = roomRng(seed, "sim");
    const result = simCupFinal(p0.lineup, styleA, p1.lineup, styleB, rand);
    setCupResult({
      ...result,
      p0: { nick: p0.nick, country: p0.country, styleId: styleA.id, lineup: p0.lineup },
      p1: { nick: p1.nick, country: p1.country, styleId: styleB.id, lineup: p1.lineup },
      seed,
    });
    setScreen("cupresult");
  };

  const startLocalCup = () => {
    const n0 = validateNick(cupP0Nick);
    const n1 = validateNick(cupP1Nick);
    if (!n0.ok) { setCupError(n0.error); return; }
    if (!n1.ok) { setCupError(n1.error); return; }
    if (n0.nick === n1.nick) { setCupError("Players need different nicknames."); return; }
    const code = generateRoomCode();
    const seed = roomSeed(`L${code}`, 1);
    setCupError(null);
    setMode("cup");
    setCupCode(code);
    setCupSeed(seed);
    setCupDrafting(0);
    setCupResult(null);
    cupSimmedRef.current = null;
    setCupPlayers([
      { nick: n0.nick, country: cupP0Country, styleId: style.id, lineup: null },
      { nick: n1.nick, country: cupP1Country, styleId: style.id, lineup: null },
    ]);
    beginCupDraftBoard(seed);
    setScreen("draft");
    window.history.replaceState(null, "", window.location.pathname);
  };

  const continueLocalCupPass = () => {
    beginCupDraftBoard(cupSeed);
    setScreen("draft");
  };

  const maybeSimOnlineRoom = (room) => {
    if (!room || (room.phase !== "sim" && room.phase !== "done")) return;
    const a = room.players[0];
    const b = room.players[1];
    if (!a?.lineup || !b?.lineup) return;
    const key = `${room.id}:${room.seed}`;
    if (cupSimmedRef.current === key) return;
    cupSimmedRef.current = key;
    setCupSeed(room.seed);
    runCupSim(
      { nick: a.nick, country: a.country, styleId: a.styleId, lineup: a.lineup },
      { nick: b.nick, country: b.country, styleId: b.styleId, lineup: b.lineup },
      room.seed,
    );
  };

  const lockCupLineup = async () => {
    if (!fiveSet || cupBusy) return;
    if (mode === "cup") {
      const next = [...cupPlayers];
      next[cupDrafting] = {
        ...next[cupDrafting],
        lineup: serializeLineup(lineup),
        styleId: style.id,
      };
      setCupPlayers(next);
      if (cupDrafting === 0) {
        setCupDrafting(1);
        setScreen("cuppass");
        return;
      }
      runCupSim(next[0], next[1], cupSeed);
      return;
    }
    if (mode === "cupOnline" && cupRoom && cupSlot != null) {
      setCupBusy(true);
      setCupError(null);
      try {
        const me = cupRoom.players[cupSlot];
        const data = await roomActionWithRetry(cupRoom.id, (fresh) => ({
          action: "submitDraft",
          expectedVersion: (fresh || cupRoom).version,
          nick: me.nick,
          country: me.country,
          lineup: serializeLineup(lineup),
          styleId: style.id,
        }));
        setCupRoom(data.room);
        if (data.room.phase === "sim" || data.room.phase === "done") {
          maybeSimOnlineRoom(data.room);
        } else {
          setScreen("cuplobby");
        }
      } catch (err) {
        setCupError(err.message || "Submit failed.");
      } finally {
        setCupBusy(false);
      }
    }
  };

  const createOnlineRoom = async () => {
    const n0 = validateNick(cupP0Nick);
    if (!n0.ok) { setCupError(n0.error); return; }
    setCupBusy(true);
    setCupError(null);
    try {
      const data = await createRoom(n0.nick, cupP0Country);
      setMode("cupOnline");
      setCupRoom(data.room);
      setCupSlot(data.slot);
      setCupSeed(data.room.seed);
      setCupCode(data.room.id);
      setCupResult(null);
      cupSimmedRef.current = null;
      saveRoomSession({ roomId: data.room.id, slot: data.slot, nick: n0.nick, country: cupP0Country });
      setScreen("cuplobby");
      window.history.replaceState(null, "", `${window.location.pathname}?room=${data.room.id}`);
    } catch (err) {
      setCupError(err.message || "Could not create room.");
    } finally {
      setCupBusy(false);
    }
  };

  const joinOnlineRoom = async () => {
    const code = String(cupJoinCode || "").toUpperCase().trim();
    if (!isValidRoomId(code)) { setCupError("Enter a valid 6-character room code."); return; }
    const n0 = validateNick(cupP0Nick);
    if (!n0.ok) { setCupError(n0.error); return; }
    setCupBusy(true);
    setCupError(null);
    try {
      const data = await roomAction(code, {
        action: "join",
        nick: n0.nick,
        country: cupP0Country,
      });
      setMode("cupOnline");
      setCupRoom(data.room);
      setCupSlot(data.slot);
      setCupSeed(data.room.seed);
      setCupCode(data.room.id);
      setCupResult(null);
      cupSimmedRef.current = null;
      saveRoomSession({ roomId: data.room.id, slot: data.slot, nick: n0.nick, country: cupP0Country });
      setScreen("cuplobby");
      window.history.replaceState(null, "", `${window.location.pathname}?room=${data.room.id}`);
    } catch (err) {
      setCupError(err.message || "Could not join room.");
    } finally {
      setCupBusy(false);
    }
  };

  const readyOnline = async () => {
    if (!cupRoom || cupSlot == null) return;
    setCupBusy(true);
    setCupError(null);
    try {
      const me = cupRoom.players[cupSlot];
      const data = await roomActionWithRetry(cupRoom.id, (fresh) => ({
        action: "ready",
        expectedVersion: (fresh || cupRoom).version,
        nick: me.nick,
        country: me.country,
      }));
      setCupRoom(data.room);
      if (data.room.phase === "draft") {
        setCupSeed(data.room.seed);
        beginCupDraftBoard(data.room.seed);
        setScreen("draft");
      }
    } catch (err) {
      setCupError(err.message || "Ready failed.");
    } finally {
      setCupBusy(false);
    }
  };

  const setOnlineStyle = async (st) => {
    setStyle(st);
    if (mode !== "cupOnline" || !cupRoom || cupSlot == null) return;
    try {
      const me = cupRoom.players[cupSlot];
      const data = await roomActionWithRetry(cupRoom.id, (fresh) => ({
        action: "setStyle",
        expectedVersion: (fresh || cupRoom).version,
        nick: me.nick,
        country: me.country,
        styleId: st.id,
      }));
      setCupRoom(data.room);
    } catch { /* best-effort */ }
  };

  const leaveOnlineRoom = async () => {
    if (cupRoom && cupSlot != null) {
      try {
        const me = cupRoom.players[cupSlot];
        await roomAction(cupRoom.id, {
          action: "leave",
          expectedVersion: cupRoom.version,
          nick: me.nick,
          country: me.country,
        });
      } catch { /* ignore */ }
    }
    clearRoomSession();
    setCupRoom(null);
    setCupSlot(null);
    setMode("free");
    setScreen("home");
    window.history.replaceState(null, "", window.location.pathname);
  };

  const tournamentGames = games.filter((g) => !isDreamGame(g));
  const dreamGame = games.find(isDreamGame);
  const wins = tournamentGames.filter((g) => g.my > g.op).length;
  const losses = tournamentGames.length - wins;
  // Perfect Sweep = undefeated through all 8. World Champions = win the Final (any record).
  const perfect = tournamentGames.length === 8 && tournamentGames.every((g) => g.my > g.op);
  const lastG = tournamentGames[tournamentGames.length - 1];
  const eliminated = groupOut || r2Out || (tournamentGames.length > 5 && lastG && lastG.my < lastG.op);
  const worldChampions = !eliminated && tournamentGames.length === 8 && lastG && lastG.my > lastG.op;

  // Once per tournament / cup finish (not again after Dream Team return-to-done).
  useEffect(() => {
    if (runCompletedTrackedRef.current) return;
    if (screen === "done" && tournamentGames.length) {
      runCompletedTrackedRef.current = true;
      trackEvent("run_completed", {
        mode: trackMode(mode),
        result: trackResult({ perfect, worldChampions, eliminated }),
      });
      return;
    }
    if (screen === "cupresult" && cupResult) {
      runCompletedTrackedRef.current = true;
      trackEvent("run_completed", { mode: "multiplayer", result: "champion" });
    }
  }, [screen, tournamentGames.length, cupResult, mode, perfect, worldChampions, eliminated]);

  /* ---- end-of-run stats ---- */
  const runStats = useMemo(() => {
    if ((screen !== "done" && screen !== "card") || !tournamentGames.length) return null;
    const tg = tournamentGames;
    const players = SLOTS.map((s) => lineup[s]).filter(Boolean).map((p) => {
      const per = tg.map((g) => g.box.find((b) => b.name === p.name && b.n === p.n)?.pts || 0);
      const tot = per.reduce((a, b) => a + b, 0);
      return { ...p, tot, ppg: tot / tg.length, best: Math.max(...per) };
    }).sort((a, b) => b.ppg - a.ppg);
    const pf = tg.reduce((s, g) => s + g.my, 0), pa = tg.reduce((s, g) => s + g.op, 0);
    const margins = tg.map((g) => g.my - g.op);
    const dreamBeaten = !!(dreamGame && dreamGame.my > dreamGame.op);
    const dreamMargin = dreamBeaten ? dreamGame.my - dreamGame.op : null;
    const marginScore = (perfect && dreamBeaten)
      ? margins.reduce((a, b) => a + b, 0) + dreamMargin
      : null;
    const record = `${wins}–${losses}`;
    const resultLabel = perfect ? `THE PERFECT SWEEP — ${record}`
      : eliminated ? (groupOut ? "OUT IN THE GROUP STAGE" : r2Out ? "OUT IN THE 2ND ROUND" : `ELIMINATED — ${tournamentGames[tournamentGames.length - 1].round}`)
      : worldChampions ? `WORLD CHAMPIONS — ${record}`
      : record;
    return {
      players, resultLabel,
      w: wins, l: losses,
      totalPF: pf, totalPA: pa,
      ppgF: pf / tg.length, ppgA: pa / tg.length,
      avgMargin: margins.reduce((a, b) => a + b, 0) / tg.length,
      bigWin: Math.max(...margins),
      margins,
      dreamMargin,
      marginScore,
      ovr: Math.round(myRt),
    };
  }, [screen, games, tournamentGames, dreamGame, lineup, wins, losses, perfect, eliminated, worldChampions, groupOut, r2Out, myRt]);

  const showHallModal = screen === "done"
    && mode !== "daily"
    && perfect
    && dreamGamePlayed
    && dreamGame
    && dreamGame.my > dreamGame.op
    && runStats?.marginScore != null
    && !leaderboardSubmitted
    && !hallSkipped;

  // Offer daily standings submit once the run is locked done
  useEffect(() => {
    if (mode !== "daily" || dailyStatus !== "done" || dailySubmitted) return;
    if (screen !== "done" && screen !== "card") return;
    setShowDailySubmit(true);
  }, [mode, dailyStatus, dailySubmitted, screen]);

  const submitDailyEntry = async () => {
    if (!runStats || mode !== "daily") return;
    const nickCheck = validateNick(hallNick);
    if (!nickCheck.ok) {
      setHallError(nickCheck.error);
      return;
    }
    setHallSubmitting(true);
    setHallError(null);
    try {
      let runIdShare = shortId;
      try { runIdShare = await ensureShortRun(); } catch { /* optional */ }
      const margins = tournamentGames.map((g) => g.my - g.op);
      const dreamMargin = dreamGame && dreamGame.my > dreamGame.op ? dreamGame.my - dreamGame.op : null;
      const eff = efficiencyFrom(margins, runStats.ovr, perfect ? dreamMargin : null);
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: dailyDay,
          nick: nickCheck.nick,
          country: hallCountry,
          w: wins, l: losses, perfect,
          ovr: runStats.ovr,
          efficiency: eff,
          margins,
          runId: runIdShare || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit.");
      setDailySubmitted(true);
      setShowDailySubmit(false);
      setDailyToast("Posted to today's standings.");
      setTimeout(() => setDailyToast(null), 2800);
      const saved = loadDailyState(dailyDay) || {};
      saveDailyState(dailyDay, { ...saved, submitted: true, status: "done" });
    } catch (err) {
      setHallError(err.message || "Could not submit.");
    } finally {
      setHallSubmitting(false);
    }
  };

  const submitHallEntry = async () => {
    if (!runStats || runStats.marginScore == null || runStats.dreamMargin == null) return;
    const nickCheck = validateNick(hallNick);
    if (!nickCheck.ok) {
      setHallError(nickCheck.error);
      return;
    }
    const nick = nickCheck.nick;
    setHallSubmitting(true);
    setHallError(null);
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nick,
          country: hallCountry,
          score: runStats.marginScore,
          ovr: runStats.ovr,
          tournamentMargins: runStats.margins,
          dreamMargin: runStats.dreamMargin,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit.");
      setLeaderboardSubmitted(true);
      setHallToast("Spot claimed.");
      setTimeout(() => setHallToast(null), 2800);
    } catch (err) {
      setHallError(err.message || "Could not submit.");
    } finally {
      setHallSubmitting(false);
    }
  };

  useEffect(() => {
    if (screen !== "leaderboard") return;
    let cancelled = false;
    if (dailyBoardTab) {
      setDailyLbLoading(true);
      setDailyLbError(null);
      fetch(`/api/daily?day=${encodeURIComponent(utcDayKey())}`)
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Standings unavailable.");
          return data;
        })
        .then((data) => {
          if (cancelled) return;
          setDailyLbEntries(Array.isArray(data.entries) ? data.entries : []);
          setDailyLbCount(Number(data.count) || 0);
          setDailyCpuEnabled(data.cpuDrafters !== false);
          const n = Math.round(Number(data.cpuTargetN));
          setDailyCpuTargetN(Number.isFinite(n) && n >= 1 ? n : CPU_TARGET_N_DEFAULT);
        })
        .catch((err) => {
          if (!cancelled) setDailyLbError(err.message || "Standings unavailable.");
        })
        .finally(() => {
          if (!cancelled) setDailyLbLoading(false);
        });
    } else {
      setLbLoading(true);
      setLbError(null);
      fetch("/api/leaderboard")
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Could not load Hall of Fame.");
          return data;
        })
        .then((data) => {
          if (cancelled) return;
          setLbEntries(Array.isArray(data.entries) ? data.entries : []);
        })
        .catch((err) => {
          if (!cancelled) setLbError(err.message || "Could not load Hall of Fame.");
        })
        .finally(() => {
          if (!cancelled) setLbLoading(false);
        });
    }
    return () => { cancelled = true; };
  }, [screen, dailyBoardTab]);

  useEffect(() => {
    if (!boardInspect) return undefined;
    const onKey = (ev) => {
      if (ev.key !== "Escape") return;
      boardInspectGen.current += 1;
      setBoardInspect(null);
      setBoardInspectLoading(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boardInspect]);

  useEffect(() => {
    if (screen !== "leaderboard" || !dailyBoardTab) return undefined;
    setDailyBoardNow(Date.now());
    const id = setInterval(() => setDailyBoardNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, [screen, dailyBoardTab]);

  const mixedDailyBoard = useMemo(() => {
    if (!dailyBoardTab) return [];
    const day = utcDayKey();
    const runs = dailyCpuEnabled ? cpuRunsForDay(day) : [];
    return mixDailyBoard(dailyLbEntries, runs, {
      now: dailyBoardNow,
      targetN: dailyCpuTargetN,
      enabled: dailyCpuEnabled,
    });
  }, [dailyBoardTab, dailyLbEntries, dailyCpuEnabled, dailyCpuTargetN, dailyBoardNow]);

  const closeBoardInspect = () => {
    boardInspectGen.current += 1;
    setBoardInspect(null);
    setBoardInspectLoading(false);
  };

  const openBoardInspect = (e) => {
    if (!e) return;
    boardInspectGen.current += 1;
    const gen = boardInspectGen.current;
    setBoardInspect(e);
    const needsFetch = !e.cpu && e.runId && !e.lineup;
    if (!needsFetch) {
      setBoardInspectLoading(false);
      return;
    }
    setBoardInspectLoading(true);
    fetch(`/api/runs?id=${encodeURIComponent(e.runId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (gen !== boardInspectGen.current) return;
        const decoded = d?.payload ? decodeRunShare(`?card=${d.payload}`) : null;
        if (decoded) {
          setBoardInspect((prev) => (prev && prev.id === e.id ? { ...prev, ...decoded } : prev));
        }
        setBoardInspectLoading(false);
      })
      .catch(() => {
        if (gen !== boardInspectGen.current) return;
        setBoardInspectLoading(false);
      });
  };

  const boardInspectStyle = boardInspect?.styleId
    ? (STYLES.find((s) => s.id === boardInspect.styleId) || null)
    : null;
  const boardInspectCountry = boardInspect && !boardInspect.cpu
    ? countryByCode(boardInspect.country)
    : null;
  const boardInspectHasLineup = boardInspect && SLOTS.every((s) => boardInspect.lineup?.[s]);



  return (
    <div className="ps-root pb-10">
      <style>{css}</style>

      {(hallToast || dailyToast) && (
        <div
          className="fixed left-1/2 z-50 pop px-4 py-2 dsp text-sm"
          style={{
            top: 72, transform: "translateX(-50%)",
            background: "#1a2336", border: "1px solid #2f3d5c", color: "#7ee2a8",
            boxShadow: "0 8px 28px rgba(0,0,0,.45)",
          }}
        >
          {dailyToast || hallToast}
        </div>
      )}

      {mode === "daily" && (screen === "draft" || screen === "sim" || screen === "done") && (
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <div className="panel px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="eyebrow" style={{ color: "#E8465A" }}>DAILY CHALLENGE #{dailyNumber(dailyDay)}</div>
              <div className="dsp text-sm" style={{ color: "#EAF0F7" }}>{formatDayLabel(dailyDay)} · UTC</div>
            </div>
            <div className="text-right">
              <div className="eyebrow" style={{ color: "#7d8ba0" }}>
                {dailyStatus === "done" ? "PLAYED" : "ENDS IN"}
              </div>
              <div className="dsp9 text-lg" style={{ color: dailyStatus === "done" ? "#7ee2a8" : "#f2d27c", fontVariantNumeric: "tabular-nums" }}>
                {dailyStatus === "done" ? "DONE" : dailyCountdown}
              </div>
            </div>
          </div>
        </div>
      )}

      {boardInspect && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-4 py-8"
          style={{ background: "rgba(6,8,14,.72)", backdropFilter: "blur(4px)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="board-inspect-title"
          onClick={closeBoardInspect}
        >
          <div
            className="panel p-5 w-full max-w-lg pop max-h-[90vh] overflow-auto"
            style={{ background: "#121826" }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="eyebrow mb-1" style={{ color: "#8b9bb3" }}>
                  {boardInspect.cpu ? (
                    <><span className="cpuBadge">CPU</span> COACH</>
                  ) : (
                    "DAILY ENTRY"
                  )}
                </div>
                <h2 id="board-inspect-title" className="dsp text-2xl" style={{ color: "#EAF0F7" }}>
                  {boardInspect.cpu
                    ? String(boardInspect.nick || "").replace(/^CPU · /, "")
                    : boardInspect.nick}
                </h2>
                <div className="text-sm mt-1" style={{ color: "#93a1b5" }}>
                  {boardInspect.cpu ? (
                    <>
                      {boardInspect.wc ? `${boardInspect.wc} · ` : ""}
                      {boardInspectStyle?.label || "BALANCED"} · {boardInspect.rolls} rolls
                      {boardInspect.homeNation ? ` · home ${boardInspect.homeNation}` : ""}
                    </>
                  ) : (
                    <>
                      {boardInspectCountry?.flag ? `${boardInspectCountry.flag} ` : ""}
                      {boardInspectCountry?.name || boardInspect.country || "Player"}
                      {boardInspect.rolls != null ? ` · ${boardInspect.rolls} rolls` : ""}
                    </>
                  )}
                </div>
              </div>
              <button type="button" onClick={closeBoardInspect} className="skew chip dsp px-3 py-1.5 text-sm btnG shrink-0">
                <span className="unskew">CLOSE</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div>
                <div className="dsp9 text-2xl" style={{ color: "#EAF0F7" }}>{boardInspect.w}–{boardInspect.l}</div>
                <div className="eyebrow" style={{ fontSize: 9 }}>RECORD</div>
              </div>
              <div>
                <div className="dsp9 text-2xl" style={{ color: "#E8465A" }}>{boardInspect.ovr}</div>
                <div className="eyebrow" style={{ fontSize: 9 }}>OVR</div>
              </div>
              <div>
                <div className="dsp9 text-2xl" style={{ color: "#f2d27c" }}>{boardInspect.efficiency}</div>
                <div className="eyebrow" style={{ fontSize: 9 }}>EFF</div>
              </div>
            </div>
            {boardInspectHasLineup ? (
              <div className="grid grid-cols-5 gap-2 mb-4">
                {SLOTS.map((s) => {
                  const p = boardInspect.lineup?.[s];
                  return (
                    <div key={s} className="p-2 text-center chip"
                      style={p
                        ? { background: `linear-gradient(180deg, ${p.tc || "#33405c"}33, #10141f 70%)`, border: `1px solid ${p.tc || "#33405c"}` }
                        : { border: "1px dashed #33405c", color: "#5f6b7d" }}>
                      <div className="eyebrow">{s}</div>
                      {p ? (
                        <>
                          <div className="flex justify-center my-1"><Gem rt={p.rt} size={28} /></div>
                          <div className="dsp leading-tight text-xs" style={{ color: "#fff" }}>{p.name}</div>
                          <div className="text-[10px]" style={{ color: "#93a1b5" }}>{p.team} '{String(p.season).slice(2)}</div>
                        </>
                      ) : <div className="py-4 dsp text-xs">EMPTY</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="panel px-3 py-3 mb-4 text-sm" style={{ color: "#93a1b5" }}>
                {boardInspectLoading
                  ? "Loading lineup…"
                  : boardInspect.runId
                    ? "Couldn't load this lineup."
                    : "Lineup wasn't saved with this post."}
              </div>
            )}
            {(boardInspect.margins || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {(boardInspect.margins || []).map((m, i) => (
                  <span key={i} className="dsp text-sm" style={{ color: m > 0 ? "#7ee2a8" : "#f08a8a" }}>
                    {m > 0 ? `+${m}` : m}
                  </span>
                ))}
              </div>
            )}
            <div className="text-xs" style={{ color: "#5f6b7d" }}>
              {(boardInspect.games || []).map((g, i) => (
                <div key={i} className="flex justify-between gap-2 py-1" style={{ borderTop: "1px solid #1c2333" }}>
                  <span>{g.round || `GAME ${i + 1}`}</span>
                  <span style={{ color: g.my > g.op ? "#7ee2a8" : "#f08a8a" }}>
                    {g.my}–{g.op} vs {g.opp?.name} '{String(g.opp?.season || "").slice(2)}
                  </span>
                </div>
              ))}
              {boardInspect.groupOut && <div className="mt-2">Out in the group stage.</div>}
              {boardInspect.r2Out && <div className="mt-2">Out in the 2nd round.</div>}
              {boardInspect.perfect && boardInspect.cpu && (
                <div className="mt-2" style={{ color: "#7ee2a8" }}>Perfect sweep — CPU runs never enter the Hall of Fame.</div>
              )}
              {boardInspect.perfect && !boardInspect.cpu && (
                <div className="mt-2" style={{ color: "#7ee2a8" }}>Perfect sweep.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDailySubmit && mode === "daily" && runStats && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: "rgba(6,8,14,.72)", backdropFilter: "blur(4px)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-title"
        >
          <div className="panel p-5 w-full max-w-md pop" style={{ background: "#121826" }}>
            <div className="eyebrow mb-1" style={{ color: "#E8465A" }}>DAILY #{dailyNumber(dailyDay)}</div>
            <h2 id="daily-title" className="dsp text-2xl mb-1.5" style={{ color: "#EAF0F7" }}>
              Post your result
            </h2>
            <p className="text-sm mb-4" style={{ color: "#93a1b5" }}>
              One entry per day. Compare with everyone on today&apos;s board.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div>
                <div className="dsp9 text-2xl" style={{ color: "#EAF0F7" }}>{wins}–{losses}</div>
                <div className="eyebrow" style={{ fontSize: 9 }}>RECORD</div>
              </div>
              <div>
                <div className="dsp9 text-2xl" style={{ color: "#E8465A" }}>{runStats.ovr}</div>
                <div className="eyebrow" style={{ fontSize: 9 }}>OVR</div>
              </div>
              <div>
                <div className="dsp9 text-2xl" style={{ color: "#f2d27c" }}>
                  {efficiencyFrom(runStats.margins, runStats.ovr, perfect && runStats.dreamMargin > 0 ? runStats.dreamMargin : null)}
                </div>
                <div className="eyebrow" style={{ fontSize: 9 }}>EFF</div>
              </div>
            </div>
            <label className="block mb-3">
              <span className="eyebrow block mb-1.5" style={{ color: "#7d8ba0" }}>NICKNAME</span>
              <input
                type="text" value={hallNick} maxLength={16} autoComplete="off"
                onChange={(e) => {
                  const v = e.target.value;
                  setHallNick(v);
                  if (!v.trim()) { setHallError(null); return; }
                  const check = validateNick(v);
                  setHallError(check.ok ? null : check.error);
                }}
                className="w-full px-3 py-2.5 text-sm" style={fieldChrome} placeholder="2–16 characters"
              />
            </label>
            <label className="block mb-4">
              <span className="eyebrow block mb-1.5" style={{ color: "#7d8ba0" }}>COUNTRY</span>
              <CountryCombobox value={hallCountry} onChange={setHallCountry} />
            </label>
            {hallError && <p className="text-sm mb-3" style={{ color: "#ff8b98" }}>{hallError}</p>}
            <div className="flex flex-col gap-2">
              <button onClick={submitDailyEntry} disabled={hallSubmitting} className="btnP skew dsp9 text-base px-6 py-3 w-full">
                <span className="unskew">{hallSubmitting ? "POSTING…" : "POST TO STANDINGS"}</span>
              </button>
              <button onClick={() => setShowDailySubmit(false)} className="skew chip dsp text-sm px-4 py-2 btnG w-full">
                <span className="unskew">SKIP</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showHallModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: "rgba(6,8,14,.72)", backdropFilter: "blur(4px)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="hall-title"
        >
          <div className="panel p-5 w-full max-w-md pop" style={{ background: "#121826" }}>
            <div className="eyebrow mb-1" style={{ color: "#E8465A" }}>HALL OF FAME</div>
            <h2
              id="hall-title"
              className="dsp text-2xl mb-1.5"
              style={{ color: "#EAF0F7", textWrap: "balance" }}
            >
              Claim your spot
            </h2>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: "#93a1b5", textWrap: "pretty" }}>
              8–0 and you beat the Dream Team. Sign in with your margin score.
            </p>
            <div className="mb-4 text-center py-1">
              <div className="eyebrow mb-1" style={{ color: "#7d8ba0" }}>MARGIN SCORE</div>
              <div
                className="dsp9 text-5xl"
                style={{ color: "#7ee2a8", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
              >
                {runStats.marginScore}
              </div>
            </div>
            <label className="block mb-3">
              <span className="eyebrow block mb-1.5" style={{ color: "#7d8ba0" }}>NICKNAME</span>
              <input
                type="text"
                value={hallNick}
                maxLength={16}
                autoComplete="off"
                onChange={(e) => {
                  const v = e.target.value;
                  setHallNick(v);
                  if (!v.trim()) {
                    setHallError(null);
                    return;
                  }
                  const check = validateNick(v);
                  setHallError(check.ok ? null : check.error);
                }}
                className="w-full px-3 py-2.5 text-sm"
                style={fieldChrome}
                placeholder="2–16 characters"
              />
            </label>
            <label className="block mb-4">
              <span className="eyebrow block mb-1.5" style={{ color: "#7d8ba0" }}>COUNTRY</span>
              <CountryCombobox value={hallCountry} onChange={setHallCountry} />
            </label>
            {hallError && (
              <p className="text-sm mb-3" style={{ color: "#ff8b98" }}>{hallError}</p>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={hallSubmitting || !!hallError || !hallNick.trim()}
                onClick={submitHallEntry}
                className={`skew dsp9 text-lg px-6 py-3 w-full ${
                  hallSubmitting || hallError || !hallNick.trim() ? "chip btnDead" : "btnP"
                }`}
              >
                <span className="unskew">{hallSubmitting ? "CLAIMING…" : "CLAIM SPOT"}</span>
              </button>
              <button
                type="button"
                disabled={hallSubmitting}
                onClick={() => setHallSkipped(true)}
                className="skew chip dsp px-6 py-2.5 btnG w-full"
              >
                <span className="unskew">NOT NOW</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== top bar ===== */}
      <div className="flex items-center justify-center px-5 py-3 relative"
        style={{ background: "linear-gradient(180deg,#131826,#0e1219)", borderBottom: "1px solid #232b3d" }}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={reset}>
          <div className="skew chip px-3 py-1 dsp9 text-lg" style={{ background: "#E8465A", color: "#fff" }}>
            <span className="unskew">8–0</span>
          </div>
          <div className="dsp text-lg" style={{ color: "#EAF0F7" }}>PERFECT SWEEP</div>
        </div>
        <div className="eyebrow hidden sm:block absolute right-5 top-1/2 -translate-y-1/2">
          FIBA WORLD CUP · {ARCHIVE_STATS.years.first}—{ARCHIVE_STATS.years.last}
        </div>
      </div>
      {/* accent strips */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#E8465A 0%,#E8465A 30%,#23b4e2 30%,#23b4e2 33%,transparent 33%)" }} />

      {/* ============ HOME ============ */}
      {screen === "home" && (
        <div className="max-w-3xl mx-auto px-6 py-12 text-center pop relative">
          <div className="eyebrow mb-2">MYTEAM · WORLD CUP GAUNTLET</div>
          <div className="dsp9" style={{
            fontSize: "min(20vw,150px)", lineHeight: 0.9,
            background: "linear-gradient(180deg,#fff 30%,#ff8b98 60%,#E8465A)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 6px 30px rgba(232,70,90,.35))",
          }}>8–0</div>
          <h1 className="dsp text-3xl mt-3" style={{ color: "#EAF0F7" }}>
            ROLL THE BALL. DRAFT YOUR DREAM NATIONAL FIVE.
          </h1>
          <p className="mt-4 text-base max-w-xl mx-auto" style={{ color: "#93a1b5" }}>
            Roll legendary World Cup squads, draft your five, and chase the perfect mark: <b style={{ color: "#ff8b98" }}>win the Cup without losing a single game.</b>
          </p>
          <div className="flex justify-center gap-3 mt-8 flex-wrap">
            {[["01", "ROLL", "draw nations & years"], ["02", "DRAFT", "one star per position"], ["03", "SWEEP", "win the Cup undefeated"]].map(([n, t, d]) => (
              <div key={n} className="panel px-5 py-3 text-left" style={{ minWidth: 170 }}>
                <div className="dsp9 text-2xl" style={{ color: "#E8465A" }}>{n} <span style={{ color: "#EAF0F7" }}>{t}</span></div>
                <div className="text-xs" style={{ color: "#7d8ba0" }}>{d}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 mt-10">
            <button className="btnP skew dsp9 text-xl sm:text-2xl px-10 py-4" onClick={startFreePlay}>
              <span className="unskew">TIP OFF<BtnArrow /></span>
            </button>
            <button className="skew chip dsp9 text-xl sm:text-2xl px-10 py-4 btnG"
              onClick={startDailyChallenge}>
              <span className="unskew">DAILY #{dailyNumber(utcDayKey())}<BtnArrow /></span>
            </button>
          </div>
          <div className="mt-3 text-sm" style={{ color: "#7d8ba0" }}>
            Same rolls for everyone · one attempt · ends in {formatCountdown(msUntilUtcMidnight())} UTC
          </div>
          {streakIsLive(dailyStreak) && (
            <div className="mt-2 dsp9 text-sm" style={{ color: "#f2d27c", letterSpacing: ".06em" }}>
              {dailyStreak.currentStreak} DAY STREAK
              {dailyStreak.lastPlayedDate === utcDayKey() ? " · PLAYED TODAY" : ""}
            </div>
          )}
          <div className="mt-12 eyebrow">
            {new Set(TEAMS.map(t => t.name)).size} NATIONS · {TEAMS.length} SQUADS · {TEAMS.length * 6} PLAYERS
          </div>
        </div>
      )}

      {screen === "dailyboot" && (
        <div className="max-w-3xl mx-auto px-4 py-24 text-center pop">
          <div className="eyebrow" style={{ fontSize: 12 }}>LOADING DAILY CHALLENGE…</div>
        </div>
      )}

      {/* ============ CUP FINAL MENUS ============ */}
      {screen === "cupmenu" && (
        <div className="max-w-lg mx-auto px-6 py-12 text-center pop">
          <div className="eyebrow mb-2" style={{ color: "#E8465A" }}>HEAD-TO-HEAD</div>
          <h1 className="dsp text-4xl mb-2" style={{ color: "#EAF0F7" }}>CUP FINAL</h1>
          <p className="text-sm mb-8" style={{ color: "#93a1b5" }}>
            Both draft from the same seeded pool. One game decides the champ.
          </p>
          <div className="flex flex-col gap-3">
            <button className="btnP skew dsp9 text-xl px-8 py-3.5" onClick={() => { setCupError(null); setScreen("cuplocal"); }}>
              <span className="unskew">PASS & PLAY (ONE DEVICE)</span>
            </button>
            <button className="skew chip dsp9 text-xl px-8 py-3.5 btnG" onClick={() => { setCupError(null); setScreen("cupcreate"); }}>
              <span className="unskew">CREATE ONLINE ROOM</span>
            </button>
            <button className="skew chip dsp9 text-xl px-8 py-3.5 btnG" onClick={() => { setCupError(null); setScreen("cupjoin"); }}>
              <span className="unskew">JOIN WITH CODE</span>
            </button>
            <button className="skew chip dsp text-sm px-6 py-2.5 btnG mt-2" onClick={() => setScreen("home")}>
              <span className="unskew">BACK</span>
            </button>
          </div>
        </div>
      )}

      {screen === "cuplocal" && (
        <div className="max-w-md mx-auto px-6 py-10 pop">
          <div className="eyebrow mb-1" style={{ color: "#E8465A" }}>PASS & PLAY</div>
          <h2 className="dsp text-3xl mb-6" style={{ color: "#EAF0F7" }}>Two players</h2>
          {[
            { label: "PLAYER 1", nick: cupP0Nick, setNick: setCupP0Nick, country: cupP0Country, setCountry: setCupP0Country },
            { label: "PLAYER 2", nick: cupP1Nick, setNick: setCupP1Nick, country: cupP1Country, setCountry: setCupP1Country },
          ].map((p) => (
            <div key={p.label} className="panel p-4 mb-3 text-left">
              <div className="eyebrow mb-2">{p.label}</div>
              <label className="block mb-2">
                <span className="eyebrow block mb-1" style={{ color: "#7d8ba0" }}>NICK</span>
                <input type="text" value={p.nick} maxLength={16} autoComplete="off"
                  onChange={(e) => p.setNick(e.target.value)}
                  className="w-full px-3 py-2 text-sm" style={fieldChrome} placeholder="2–16 characters" />
              </label>
              <label className="block">
                <span className="eyebrow block mb-1" style={{ color: "#7d8ba0" }}>COUNTRY</span>
                <CountryCombobox value={p.country} onChange={p.setCountry} />
              </label>
            </div>
          ))}
          {cupError && <p className="text-sm mb-3" style={{ color: "#ff8b98" }}>{cupError}</p>}
          <button className="btnP skew dsp9 text-lg px-8 py-3 w-full mb-2" onClick={startLocalCup}>
            <span className="unskew">START DRAFT</span>
          </button>
          <button className="skew chip dsp text-sm px-6 py-2 btnG w-full" onClick={() => setScreen("cupmenu")}>
            <span className="unskew">BACK</span>
          </button>
        </div>
      )}

      {screen === "cupcreate" && (
        <div className="max-w-md mx-auto px-6 py-10 pop">
          <div className="eyebrow mb-1" style={{ color: "#E8465A" }}>ONLINE ROOM</div>
          <h2 className="dsp text-3xl mb-6" style={{ color: "#EAF0F7" }}>Host a Cup Final</h2>
          <label className="block mb-3 text-left">
            <span className="eyebrow block mb-1" style={{ color: "#7d8ba0" }}>YOUR NICK</span>
            <input type="text" value={cupP0Nick} maxLength={16} autoComplete="off"
              onChange={(e) => setCupP0Nick(e.target.value)}
              className="w-full px-3 py-2 text-sm" style={fieldChrome} placeholder="2–16 characters" />
          </label>
          <label className="block mb-4 text-left">
            <span className="eyebrow block mb-1" style={{ color: "#7d8ba0" }}>COUNTRY</span>
            <CountryCombobox value={cupP0Country} onChange={setCupP0Country} />
          </label>
          {cupError && <p className="text-sm mb-3" style={{ color: "#ff8b98" }}>{cupError}</p>}
          <button className="btnP skew dsp9 text-lg px-8 py-3 w-full mb-2" disabled={cupBusy} onClick={createOnlineRoom}>
            <span className="unskew">{cupBusy ? "CREATING…" : "CREATE ROOM"}</span>
          </button>
          <button className="skew chip dsp text-sm px-6 py-2 btnG w-full" onClick={() => setScreen("cupmenu")}>
            <span className="unskew">BACK</span>
          </button>
        </div>
      )}

      {(screen === "cupjoin") && (
        <div className="max-w-md mx-auto px-6 py-10 pop">
          <div className="eyebrow mb-1" style={{ color: "#E8465A" }}>ONLINE ROOM</div>
          <h2 className="dsp text-3xl mb-6" style={{ color: "#EAF0F7" }}>Join a Cup Final</h2>
          <label className="block mb-3 text-left">
            <span className="eyebrow block mb-1" style={{ color: "#7d8ba0" }}>ROOM CODE</span>
            <input type="text" value={cupJoinCode} maxLength={6} autoComplete="off"
              onChange={(e) => setCupJoinCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 text-sm dsp9 tracking-widest" style={fieldChrome} placeholder="AB3K7Q" />
          </label>
          <label className="block mb-3 text-left">
            <span className="eyebrow block mb-1" style={{ color: "#7d8ba0" }}>YOUR NICK</span>
            <input type="text" value={cupP0Nick} maxLength={16} autoComplete="off"
              onChange={(e) => setCupP0Nick(e.target.value)}
              className="w-full px-3 py-2 text-sm" style={fieldChrome} placeholder="2–16 characters" />
          </label>
          <label className="block mb-4 text-left">
            <span className="eyebrow block mb-1" style={{ color: "#7d8ba0" }}>COUNTRY</span>
            <CountryCombobox value={cupP0Country} onChange={setCupP0Country} />
          </label>
          {cupError && <p className="text-sm mb-3" style={{ color: "#ff8b98" }}>{cupError}</p>}
          <button className="btnP skew dsp9 text-lg px-8 py-3 w-full mb-2" disabled={cupBusy} onClick={joinOnlineRoom}>
            <span className="unskew">{cupBusy ? "JOINING…" : "JOIN ROOM"}</span>
          </button>
          <button className="skew chip dsp text-sm px-6 py-2 btnG w-full" onClick={() => setScreen("cupmenu")}>
            <span className="unskew">BACK</span>
          </button>
        </div>
      )}

      {screen === "cuplobby" && cupRoom && (
        <div className="max-w-md mx-auto px-6 py-10 pop text-center">
          <div className="eyebrow mb-1" style={{ color: "#E8465A" }}>ROOM {cupRoom.id}</div>
          <h2 className="dsp text-3xl mb-2" style={{ color: "#EAF0F7" }}>
            {cupRoom.phase === "lobby" ? "Lobby" : cupRoom.phase === "draft" ? "Drafting…" : "Waiting…"}
          </h2>
          <p className="text-sm mb-6" style={{ color: "#93a1b5" }}>
            Share code <b style={{ color: "#EAF0F7" }}>{cupRoom.id}</b> · polls every few seconds
          </p>
          <div className="panel p-4 mb-4 text-left">
            {[0, 1].map((i) => {
              const p = cupRoom.players[i];
              return (
                <div key={i} className="flex items-center justify-between py-2"
                  style={{ borderBottom: i === 0 ? "1px solid #1c2333" : "none" }}>
                  <div>
                    <div className="dsp text-lg" style={{ color: p ? "#EAF0F7" : "#5f6b7d" }}>
                      {p ? p.nick : "Waiting for player…"}
                    </div>
                    <div className="eyebrow" style={{ fontSize: 9 }}>
                      {p ? `${countryByCode(p.country)?.name || p.country} · ${p.ready ? "READY" : "NOT READY"}${p.draftDone ? " · DRAFT LOCKED" : ""}` : "SLOT OPEN"}
                    </div>
                  </div>
                  {p && cupSlot === i && <span className="eyebrow" style={{ color: "#E8465A" }}>YOU</span>}
                </div>
              );
            })}
          </div>
          {cupError && <p className="text-sm mb-3" style={{ color: "#ff8b98" }}>{cupError}</p>}
          {cupRoom.phase === "lobby" && cupSlot != null && !cupRoom.players[cupSlot]?.ready && (
            <button className="btnP skew dsp9 text-lg px-8 py-3 w-full mb-2" disabled={cupBusy || !cupRoom.players[1]} onClick={readyOnline}>
              <span className="unskew">{!cupRoom.players[1] ? "WAITING FOR OPPONENT" : cupBusy ? "…" : "I'M READY"}</span>
            </button>
          )}
          {cupRoom.phase === "lobby" && cupRoom.players[cupSlot]?.ready && (
            <p className="text-sm mb-3" style={{ color: "#7ee2a8" }}>Ready — waiting for opponent…</p>
          )}
          {cupRoom.phase === "draft" && cupRoom.players[cupSlot]?.draftDone && (
            <p className="text-sm mb-3" style={{ color: "#7ee2a8" }}>Lineup locked — waiting for opponent to finish draft…</p>
          )}
          <button className="skew chip dsp text-sm px-6 py-2 btnG w-full" onClick={leaveOnlineRoom}>
            <span className="unskew">LEAVE ROOM</span>
          </button>
        </div>
      )}

      {screen === "cuppass" && (
        <div className="max-w-md mx-auto px-6 py-16 text-center pop">
          <div className="eyebrow mb-2" style={{ color: "#E8465A" }}>PASS THE DEVICE</div>
          <h2 className="dsp text-4xl mb-3" style={{ color: "#EAF0F7" }}>
            {cupPlayers[1]?.nick}&apos;s turn
          </h2>
          <p className="text-sm mb-8" style={{ color: "#93a1b5" }}>
            {cupPlayers[0]?.nick} locked their five. Same draft pool — build yours.
          </p>
          <button className="btnP skew dsp9 text-xl px-10 py-4" onClick={continueLocalCupPass}>
            <span className="unskew">START {cupPlayers[1]?.nick?.toUpperCase() || "P2"} DRAFT</span>
          </button>
        </div>
      )}

      {screen === "cupresult" && cupResult && (
        <div className="max-w-2xl mx-auto px-4 py-8 pop text-center">
          <div className="eyebrow mb-2" style={{ color: "#E8465A" }}>CUP FINAL</div>
          <div className="dsp9 text-6xl sm:text-7xl mb-2" style={{ color: "#EAF0F7", fontVariantNumeric: "tabular-nums" }}>
            {cupResult.my}–{cupResult.op}
          </div>
          <h2 className="dsp text-2xl mb-1" style={{ color: cupResult.my > cupResult.op ? "#7ee2a8" : "#ff8b98" }}>
            {cupResult.my > cupResult.op
              ? `${cupResult.p0.nick} WINS`
              : cupResult.my < cupResult.op
                ? `${cupResult.p1.nick} WINS`
                : "TIE"}
          </h2>
          {cupResult.otPeriods > 0 && (
            <div className="eyebrow mb-4">{cupResult.otPeriods} OT</div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-6 text-left">
            {[
              { side: cupResult.p0, score: cupResult.my, box: cupResult.boxA, c: "#E8465A" },
              { side: cupResult.p1, score: cupResult.op, box: cupResult.boxB, c: "#23b4e2" },
            ].map(({ side, score, box, c }) => (
              <div key={side.nick} className="panel p-3">
                <div className="dsp text-lg" style={{ color: c }}>{side.nick} · {score}</div>
                <div className="eyebrow mb-2" style={{ fontSize: 9 }}>OVR {side === cupResult.p0 ? cupResult.rtA : cupResult.rtB}</div>
                {(box || []).slice(0, 5).map((b) => (
                  <div key={b.name} className="flex justify-between text-xs py-0.5" style={{ color: "#93a1b5" }}>
                    <span>{b.name}</span>
                    <span className="dsp9" style={{ color: "#EAF0F7" }}>{b.pts}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <button className="btnP skew dsp9 text-lg px-8 py-3 mb-2" onClick={reset}>
            <span className="unskew">HOME</span>
          </button>
          <button className="skew chip dsp text-sm px-6 py-2 btnG" onClick={() => { setCupError(null); setCupResult(null); setScreen("cupmenu"); }}>
            <span className="unskew">PLAY AGAIN</span>
          </button>
        </div>
      )}

      {/* ============ DRAFT ============ */}
      {screen === "draft" && (
        <div className="max-w-5xl mx-auto px-4 py-6 pop">
          {/* lineup rack */}
          <div className="panel p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="dsp text-xl">
                {isCupMode
                  ? `${(mode === "cup" ? cupPlayers[cupDrafting]?.nick : cupRoom?.players?.[cupSlot]?.nick) || "YOU"}'S FIVE`
                  : "YOUR FIVE"}{" "}
                <span className="eyebrow ml-2">{filled}/5 SIGNED</span>
              </div>
              {filled > 0 && <div className="flex items-center gap-2"><span className="eyebrow">TEAM OVR</span><Gem rt={Math.round(myRt)} size={40} /></div>}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {SLOTS.map((s) => {
                const p = lineup[s];
                return (
                  <div key={s}
                    className="relative p-2 text-center chip"
                    style={p
                      ? { background: `linear-gradient(180deg, ${p.tc}33, #10141f 70%)`, border: `1px solid ${p.tc}`, borderTop: `3px solid ${p.tc}` }
                      : { border: "1px dashed #33405c", color: "#5f6b7d", background: "rgba(255,255,255,.015)" }}>
                    <div className="eyebrow">{s}</div>
                    {p ? (<>
                      <div className="flex justify-center my-1"><Gem rt={p.rt} /></div>
                      <div className="dsp leading-tight text-sm" style={{ color: "#fff" }}>#{p.n} {p.name}</div>
                      <div className="text-[11px]" style={{ color: "#93a1b5" }}>{p.team} '{p.season.slice(2)}</div>
                    </>) : <div className="py-5 dsp text-sm">EMPTY</div>}
                  </div>
                );
              })}
            </div>
            {/* tactic */}
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow mr-1">TACTIC</span>
                <div className="skew segCtrl flex-1 min-w-[260px] max-w-md">
                  {STYLES.map((st) => (
                    <button key={st.id} onClick={() => (mode === "cupOnline" ? setOnlineStyle(st) : setStyle(st))} title={st.tip}
                      className={`dsp text-xs sm:text-sm ${style.id === st.id ? "active" : ""}`}>
                      <span className="unskew whitespace-nowrap">{st.label}</span>
                      <span className="segTip" aria-hidden="true">{st.tip}</span>
                    </button>
                  ))}
                </div>
              </div>
              {(() => {
                const fit = styleFitHint(style, lineup);
                if (!fit) return null;
                return (
                  <div key={`${style.id}-${fit.detail}`}
                    className={`skew chip fitChip ${fit.tone}`}
                    role="status">
                    <span className="unskew inline-flex items-center">
                      <span className="fitChipLabel">{fit.label}</span>
                      <span className="fitChipSep" aria-hidden="true">·</span>
                      <span className="fitChipDetail">{fit.detail}</span>
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* roll controls */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="eyebrow inline-flex items-center gap-1.5" title="Spend on nation or year, in any combination">
                  Not feeling it?{" "}
                  <span className="text-lg leading-none" aria-hidden="true" style={{ letterSpacing: 0 }}>⟳</span>
                  {" "}Swap{" "}
                  <b style={{ color: swapsLeft ? "#E8465A" : "#5f6b7d" }}>{swapsLeft}×</b>
                </span>
                {/* NATION + YEAR stay on one row — never wrap apart */}
                <div className="flex flex-nowrap items-center gap-2 shrink-0">
                  <button onClick={switchNation} disabled={!swapsLeft || !nationPool.length || fiveSet || pickedThisRoll}
                    title={fiveSet ? "Starting five is set"
                      : pickedThisRoll ? "Already signed this roll — roll for the next squad"
                      : !swapsLeft ? "No swaps left this run"
                      : !nationPool.length ? `No other nation at World Cup ${cur?.season}`
                      : `Different nation, same year (${cur?.season}) — uses one swap`}
                    className={`skew chip dsp px-4 py-2.5 text-sm tracking-wide min-w-[6.75rem] ${(!swapsLeft || !nationPool.length || fiveSet || pickedThisRoll) ? "btnDead" : "btnG"}`}>
                    <span className="unskew inline-flex items-center justify-center gap-1 w-full">
                      <span className="text-lg leading-none" aria-hidden="true">⟳</span>
                      <span>NATION</span>
                    </span>
                  </button>
                  <button onClick={switchYear} disabled={!swapsLeft || !yearPool.length || fiveSet || pickedThisRoll}
                    title={fiveSet ? "Starting five is set"
                      : pickedThisRoll ? "Already signed this roll — roll for the next squad"
                      : !swapsLeft ? "No swaps left this run"
                      : !yearPool.length ? `${cur?.name} has only one squad in the deck`
                      : `Same nation (${cur?.name}), different World Cup — uses one swap`}
                    className={`skew chip dsp px-4 py-2.5 text-sm tracking-wide min-w-[6.75rem] ${(!swapsLeft || !yearPool.length || fiveSet || pickedThisRoll) ? "btnDead" : "btnG"}`}>
                    <span className="unskew inline-flex items-center justify-center gap-3.5 w-full">
                      <span className="text-lg leading-none" aria-hidden="true">⟳</span>
                      <span>YEAR</span>
                    </span>
                  </button>
                </div>
              </div>
              <button
                onClick={fiveSet ? (isCupMode ? lockCupLineup : startTournament) : roll}
                disabled={(!fiveSet && !canRoll) || (fiveSet && isCupMode && cupBusy)}
                title={fiveSet
                  ? (isCupMode ? "Lock in your five" : "Starting five is set — tip off")
                  : canRoll ? "Roll a new squad"
                  : "Sign a player from this squad first — or spend a swap"}
                className={`skew chip dsp9 px-6 py-2.5 tracking-wide w-full sm:w-auto ${fiveSet || canRoll ? "btnP" : "btnDead"}`}>
                <span className="unskew inline-flex items-center justify-center w-full">
                  {fiveSet
                    ? (isCupMode
                      ? <>{cupBusy ? "LOCKING…" : mode === "cup" && cupDrafting === 0 ? "LOCK IN — PASS DEVICE" : "LOCK IN FIVE"}<BtnArrow /></>
                      : <>PLAY THE WORLD CUP<BtnArrow /></>)
                    : <><BallIcon />ROLL AGAIN</>}
                </span>
              </button>
            </div>
            <div className="eyebrow">
              {fiveSet
                ? (isCupMode ? "STARTING FIVE SET — LOCK IN WHEN READY" : "STARTING FIVE SET — TIP OFF WHEN READY")
                : pickedThisRoll
                  ? "PLAYER SIGNED — ROLL AGAIN FOR THE NEXT SQUAD"
                  : canRoll
                    ? "NOBODY LEFT TO SIGN HERE — ROLL FOR THE NEXT SQUAD"
                    : "SIGN ONE PLAYER TO UNLOCK THE NEXT ROLL"}
            </div>
          </div>

          {/* squad card */}
          <div className="max-w-md mx-auto">
            {deck.map((t, i) => (
              <div key={`${t.name}-${t.season}-${rolls}`} className="panel overflow-hidden slideL">
                <div className="relative px-4 py-3"
                  style={{ background: `linear-gradient(100deg, ${t.c} 0%, ${t.c}cc 55%, #10141f 100%)` }}>
                  <div className="dsp9 text-2xl" style={{ color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,.5)" }}>
                    {t.name.toUpperCase()}
                  </div>
                  <div className="dsp text-sm" style={{ color: "rgba(255,255,255,.85)" }}>WORLD CUP {t.season} · OVR {teamRating(t).toFixed(0)}</div>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 dsp9"
                    style={{ fontSize: 64, color: "rgba(255,255,255,.12)", lineHeight: 1 }}>{t.season.slice(2)}</div>
                </div>
                <div className="p-2 relative">
                  {pickedThisRoll && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center"
                      style={{ background: "rgba(10,12,18,.72)", backdropFilter: "blur(1px)" }}>
                      <div className="skew chip dsp9 px-5 py-2 text-sm" style={{ background: "linear-gradient(160deg,#c7ddff,#60a5fa 55%,#2563eb)", color: "#0a1e45" }}>
                        <span className="unskew">
                          {fiveSet
                            ? (isCupMode ? "STARTING FIVE SET — LOCK IN YOUR CUP FINAL FIVE" : "STARTING FIVE SET — PLAY THE WORLD CUP")
                            : "PLAYER SIGNED — ROLL AGAIN FOR THE NEXT SQUAD"}
                        </span>
                      </div>
                    </div>
                  )}
                  {t.players.map((p, j) => {
                    const taken = !!lineup[p.pos];
                    const dupe = alreadySigned(p);
                    const locked = taken || pickedThisRoll || dupe;
                    return (
                      <div key={j} onClick={() => pick(t, p)}
                        className={`rowHover flex items-center justify-between px-2 py-1.5 ${locked ? "opacity-30" : "cursor-pointer"}`}
                        style={{ borderBottom: j < t.players.length - 1 ? "1px solid #1c2333" : "none" }}>
                        <div className="flex items-center gap-2">
                          <span className="chip dsp text-xs px-2 py-0.5"
                            style={{ background: "#1a2132", color: "#8fa0b8", minWidth: 34, textAlign: "center" }}>{p.pos}</span>
                          <span className="dsp text-base" style={{ color: "#EAF0F7" }}>#{p.n} {p.name}</span>
                          {dupe
                            ? <span className="eyebrow" style={{ letterSpacing: ".1em", color: "#E8465A" }}>ALREADY SIGNED</span>
                            : taken && <span className="eyebrow" style={{ letterSpacing: ".1em" }}>SLOT FILLED</span>}
                        </div>
                        <Gem rt={p.rt} size={30} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ SIM ============ */}
      {(screen === "sim" || screen === "done") && (
        <div className="max-w-3xl mx-auto px-4 py-6 pop">
          {/* sim speed */}
          {screen === "sim" && (
          <div className="flex justify-end items-center gap-2 mb-3">
            <span className="eyebrow">SIM SPEED</span>
            <select value={speed} onChange={(e) => setSpeed(e.target.value)} disabled={!!live}
              className="dsp text-sm px-3 py-1.5"
              style={{ background: "#1a2132", color: "#c6d2e3", border: "1px solid #303c56", outline: "none", fontStyle: "italic", cursor: live ? "not-allowed" : "pointer" }}>
              <option value="fast">FAST — RESULT ONLY</option>
              <option value="medium">MEDIUM — LIVE SCORE TICKER</option>
              <option value="slow">SLOW — PLAY-BY-PLAY</option>
            </select>
          </div>
          )}
          {/* round tracker */}
          <div className="flex gap-1 mb-6 justify-center flex-wrap">
            {ROUNDS.map((r, i) => {
              const g = games[i];
              const state = !g ? "up" : gameResultState(g);
              const sty = {
                up: { background: "#151b29", color: "#5f6b7d", border: "1px solid #232b3d" },
                ...GAME_RESULT_STYLES,
              }[state];
              return (
                <div key={i} className="chip dsp text-[10px] px-2.5 py-1 text-center" style={{ ...sty, minWidth: 72 }}>
                  {r}{g && <div className="dsp9 text-sm" style={{ fontStyle: "italic" }}>{g.my}–{g.op}</div>}
                </div>
              );
            })}
            {(perfect || dreamTeamMode || dreamGamePlayed) && (() => {
              const g = dreamGame;
              const state = !g ? "up" : gameResultState(g);
              const sty = {
                up: { background: "#151b29", color: "#FFD700", border: "1px solid #5c4f28" },
                ...GAME_RESULT_STYLES,
              }[state];
              return (
                <div className="chip dsp text-[10px] px-2.5 py-1 text-center" style={{ ...sty, minWidth: 72 }}>
                  DREAM TEAM{g && <div className="dsp9 text-sm" style={{ fontStyle: "italic" }}>{g.my}–{g.op}</div>}
                </div>
              );
            })()}
          </div>

          {/* played games — broadcast scoreboards */}
          {screen === "sim" && games.map((g, i) => (
            <React.Fragment key={i}>
              <div className="panel mb-3 slideL overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-2">
                  <span className="eyebrow">{g.round}</span>
                  <span className="dsp text-xs" style={{ color: marginColor(g.my - g.op) }}>
                    {gameMarginLabel(g, i)}
                  </span>
                </div>
                {/* scoreboard bar */}
                <div className="grid items-stretch mt-1" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                  <div className="flex items-center px-4 py-2"
                    style={{ background: "linear-gradient(90deg,#E8465A22,transparent)" , borderLeft: "4px solid #E8465A" }}>
                    <span className="dsp9 text-lg" style={{ color: "#fff" }}>YOUR FIVE</span>
                  </div>
                  <div className="scoreNum text-4xl px-4 flex items-center"
                    style={{ background: "#0b0e15", borderTop: "1px solid #232b3d", borderBottom: "1px solid #232b3d" }}>
                    {g.my}<span style={{ color: "#3d486c", padding: "0 6px", fontSize: 22 }}>—</span>{g.op}
                  </div>
                  <div className="flex items-center justify-end px-4 py-2"
                    style={{ background: `linear-gradient(270deg, ${oppColor(g.opp)}33, transparent)`, borderRight: `4px solid ${oppColor(g.opp)}` }}>
                    <span className="dsp9 text-lg" style={{ color: "#fff" }}>{g.opp.name.toUpperCase()} '{g.opp.season.slice(2)}</span>
                  </div>
                </div>
                <div className="px-4 py-2.5" style={{ borderTop: "1px solid #1c2333" }}>
                  <QuarterByQ
                    myQ={g.myQ}
                    opQ={g.opQ}
                    otMy={g.otMy}
                    otOp={g.otOp}
                    opColor={oppColor(g.opp)}
                  />
                  <div className="dsp mt-2 text-[11px] truncate" style={{ color: "#93a1b5" }}>
                    {g.box.slice(0, 3).map((p) => `${p.name} ${p.pts}`).join("  ·  ")}
                  </div>
                </div>
                {g.story && (
                  <div className="px-4 py-2.5 text-sm" style={{
                    borderTop: "1px solid #1c2333",
                    background: "linear-gradient(90deg, rgba(232,70,90,.07), transparent)",
                    color: "#c6d2e3",
                  }}>
                    <span className="eyebrow mr-2" style={{ color: "#E8465A" }}>RECAP</span>
                    {g.story}
                  </div>
                )}
                {g.flow && (
                  <>
                    <div onClick={() => setOpenFlow((o) => ({ ...o, [i]: !o[i] }))}
                      className="rowHover flex items-center justify-between px-4 py-2 cursor-pointer"
                      style={{ borderTop: "1px solid #1c2333" }}>
                      <span className="eyebrow">SCORING DEVELOPMENT</span>
                      <span className="dsp text-sm whitespace-nowrap shrink-0" style={{ color: "#5f6b7d" }}>{openFlow[i] ? "▲\u00A0HIDE" : "▼\u00A0SHOW"}</span>
                    </div>
                    {openFlow[i] && (
                      <div className="px-3 pb-3 pop">
                        <div className="flex gap-4 px-1 mb-1 text-[11px] flex-wrap justify-end">
                          <span className="flex items-center gap-1.5" style={{ color: "#E8465A" }}>
                            <span style={{ width: 10, height: 10, background: "#E8465A", display: "inline-block" }} />
                            YOUR FIVE
                          </span>
                          <span className="flex items-center gap-1.5" style={{ color: oppColor(g.opp) }}>
                            <span style={{ width: 10, height: 10, background: oppColor(g.opp), display: "inline-block" }} />
                            {g.opp.name.toUpperCase()} '{g.opp.season.slice(2)}
                          </span>
                        </div>
                        <GameFlow flow={g.flow} opp={g.opp} traits={g.traitFired} />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* group standings */}
              {i === 2 && groupTable && (
                <div className="panel p-4 mb-3 pop">
                  <div className="flex items-baseline gap-3 mb-2">
                    <div className="dsp9 text-xl" style={{ color: "#fff" }}>GROUP STANDINGS</div>
                    <div className="eyebrow">TOP 2 ADVANCE TO THE 2ND ROUND · WIN 2 PTS / LOSS 1 PT</div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="eyebrow text-left" style={{ fontSize: 10 }}>
                        <th className="py-1 pr-2">#</th><th>TEAM</th>
                        <th className="text-center">W</th><th className="text-center">L</th>
                        <th className="text-center">PF</th><th className="text-center">PA</th>
                        <th className="text-center">+/−</th><th className="text-center">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupTable.map((r, ri) => (
                        <tr key={r.id} className="dsp" style={{
                          background: ri < 2 ? "linear-gradient(90deg, rgba(232,70,90,.12), transparent)" : "transparent",
                          color: r.id === "me" ? "#ff8b98" : "#dbe4f0",
                          borderTop: "1px solid #1c2333",
                          opacity: ri < 2 ? 1 : 0.45,
                        }}>
                          <td className="py-1.5 pr-2">{ri + 1}{ri < 2 && <span style={{ color: "#7ee2a8" }}> ▲</span>}</td>
                          <td style={{ color: r.id === "me" ? "#ff8b98" : r.c }}>
                            {r.name.toUpperCase()}</td>
                          <td className="text-center">{r.w}</td><td className="text-center">{r.l}</td>
                          <td className="text-center">{r.pf}</td><td className="text-center">{r.pa}</td>
                          <td className="text-center">{r.diff > 0 ? "+" : ""}{r.diff}</td>
                          <td className="text-center dsp9">{r.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-[11px] mt-2" style={{ color: "#5f6b7d" }}>
                    OTHER RESULTS — {rivalGames.map((rg) => {
                      const A = gauntlet[rg.a], B = gauntlet[rg.b];
                      return `${A.name} '${A.season.slice(2)} ${rg.sa}–${rg.sb} ${B.name} '${B.season.slice(2)}`;
                    }).join("   ·   ")}
                  </div>
                </div>
              )}

              {/* 2nd-round standings */}
              {i === 4 && r2Table && (
                <div className="panel p-4 mb-3 pop">
                  <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                    <div className="dsp9 text-xl" style={{ color: "#fff" }}>2ND ROUND STANDINGS</div>
                    <div className="eyebrow">TOP 2 REACH THE QUARTERFINALS · RESULTS CARRY OVER</div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="eyebrow text-left" style={{ fontSize: 10 }}>
                        <th className="py-1 pr-2">#</th><th>TEAM</th>
                        <th className="text-center">W</th><th className="text-center">L</th>
                        <th className="text-center">PF</th><th className="text-center">PA</th>
                        <th className="text-center">+/−</th><th className="text-center">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r2Table.map((r, ri) => (
                        <tr key={r.id} className="dsp" style={{
                          background: ri < 2 ? "linear-gradient(90deg, rgba(232,70,90,.12), transparent)" : "transparent",
                          color: r.id === "me" ? "#ff8b98" : "#dbe4f0",
                          borderTop: "1px solid #1c2333",
                          opacity: ri < 2 ? 1 : 0.45,
                        }}>
                          <td className="py-1.5 pr-2">{ri + 1}{ri < 2 && <span style={{ color: "#7ee2a8" }}> ▲</span>}</td>
                          <td style={{ color: r.id === "me" ? "#ff8b98" : r.c }}>{r.name.toUpperCase()}</td>
                          <td className="text-center">{r.w}</td><td className="text-center">{r.l}</td>
                          <td className="text-center">{r.pf}</td><td className="text-center">{r.pa}</td>
                          <td className="text-center">{r.diff > 0 ? "+" : ""}{r.diff}</td>
                          <td className="text-center dsp9">{r.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-[11px] mt-2" style={{ color: "#5f6b7d" }}>
                    CARRIED OVER — YOUR FIVE {r2.carried.my}–{r2.carried.op} {r2.rival.name.toUpperCase()} '{r2.rival.season.slice(2)}
                    {"   ·   "}{gauntlet[3].name} '{gauntlet[3].season.slice(2)} {r2.abCarry.sa}–{r2.abCarry.sb} {gauntlet[4].name} '{gauntlet[4].season.slice(2)}
                    <br />
                    OTHER RESULTS — {r2.rival.name} '{r2.rival.season.slice(2)} {r2.rivalVsA.sa}–{r2.rivalVsA.sb} {gauntlet[3].name} '{gauntlet[3].season.slice(2)}
                    {"   ·   "}{r2.rival.name} '{r2.rival.season.slice(2)} {r2.rivalVsB.sa}–{r2.rivalVsB.sb} {gauntlet[4].name} '{gauntlet[4].season.slice(2)}
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}

          {/* live game */}
          {live && (
            <div className="panel mt-5 overflow-hidden pop">
              <div className="flex items-center justify-between px-4 pt-2">
                <span className="eyebrow">
                  <span style={{ color: "#E8465A" }}>● LIVE</span> — {live.round}
                </span>
                <span className="dsp text-sm" style={{ color: "#93a1b5" }}>{live.clock}</span>
              </div>
              <div className="grid items-stretch mt-1" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                <div className="flex items-center px-4 py-3"
                  style={{ background: "linear-gradient(90deg,#E8465A22,transparent)", borderLeft: "4px solid #E8465A" }}>
                  <span className="dsp9 text-lg" style={{ color: "#fff" }}>YOUR FIVE</span>
                </div>
                <div className="scoreNum text-5xl px-5 flex items-center"
                  style={{ background: "#0b0e15", borderTop: "1px solid #232b3d", borderBottom: "1px solid #232b3d" }}>
                  {live.my}<span style={{ color: "#3d486c", padding: "0 8px", fontSize: 26 }}>—</span>{live.op}
                </div>
                <div className="flex items-center justify-end px-4 py-3"
                  style={{ background: `linear-gradient(270deg, ${oppColor(live.opp)}33, transparent)`, borderRight: `4px solid ${oppColor(live.opp)}` }}>
                  <span className="dsp9 text-lg" style={{ color: "#fff" }}>{live.opp.name.toUpperCase()} '{live.opp.season.slice(2)}</span>
                </div>
              </div>
              {speed === "slow" && (
                <div className="px-4 py-3" style={{ borderTop: "1px solid #1c2333" }}>
                  {live.feed.length === 0 && <div className="eyebrow">TIP-OFF…</div>}
                  {live.feed.map((f, fi) => (
                    <div key={fi} className="flex gap-3 py-0.5 text-sm slideL"
                      style={{ opacity: 0.45 + (fi / Math.max(live.feed.length - 1, 1)) * 0.55 }}>
                      <span className="dsp" style={{ color: "#5f6b7d", minWidth: 62 }}>{f.clock}</span>
                      <span style={{ color: f.team === "me" ? "#ff8b98" : "#93a1b5" }}>{f.text}</span>
                      <span className="dsp ml-auto" style={{ color: "#5f6b7d" }}>{f.my}–{f.op}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* next game */}
          {screen === "sim" && !live && dreamTeamMode && (
            <div ref={ctaAnchorRef} className="panel text-center mt-5 p-5">
              <div className="eyebrow mb-1">BONUS GAME — FACE THE DREAM TEAM</div>
              <div className="dsp9 text-2xl mb-3" style={{ color: "#fff" }}>
                YOUR FIVE <span style={{ color: "#E8465A" }}>VS</span>{" "}
                <span style={{ color: oppColor(DREAM_TEAM) }}>
                  {DREAM_TEAM.name} '{DREAM_TEAM.season.slice(2)}
                </span>
                <span className="eyebrow ml-2">OVR {teamRating(DREAM_TEAM).toFixed(0)}</span>
              </div>
              <button onClick={playDreamTeam} className="btnP skew dsp9 text-base sm:text-xl px-6 sm:px-10 py-3 w-full max-w-sm mx-auto sm:w-auto">
                <span className="unskew">🏀 PLAY THE DREAM TEAM<BtnArrow /></span>
              </button>
            </div>
          )}
          {screen === "sim" && !live && !dreamTeamMode && tournamentGames.length < 8 && (
            <div ref={ctaAnchorRef} className="panel text-center mt-5 p-5">
              <div className="eyebrow mb-1">NEXT UP — {ROUNDS[gi]}</div>
              <div className="dsp9 text-2xl mb-3" style={{ color: "#fff" }}>
                YOUR FIVE <span style={{ color: "#E8465A" }}>VS</span>{" "}
                <span style={{ color: oppColor(gauntlet[gi]) }}>
                  {gauntlet[gi].name.toUpperCase()} '{gauntlet[gi].season.slice(2)}
                </span>
                <span className="eyebrow ml-2">OVR {teamRating(gauntlet[gi]).toFixed(0)}</span>
              </div>
              <button onClick={playNext} className="btnP skew dsp9 text-base sm:text-xl px-6 sm:px-10 py-3 w-full max-w-sm mx-auto sm:w-auto">
                <span className="unskew">🏀 PLAY {ROUNDS[gi]}<BtnArrow /></span>
              </button>
            </div>
          )}

          {/* endings — compact recap */}
          {screen === "done" && runStats && (
            <div className="mt-4 pop">
              <div className="flex flex-col gap-2 mb-4">
                {games.map((g, i) => <MatchSummaryCard key={i} g={g} i={i} />)}
              </div>

              <RunSummaryHero
                perfect={perfect}
                eliminated={eliminated}
                groupOut={groupOut}
                r2Out={r2Out}
                runStats={runStats}
              />

              {mode === "daily" && (
                <div className="panel mt-4 p-4 text-center">
                  <div className="eyebrow mb-2" style={{ color: "#E8465A" }}>YOUR RESULT TODAY</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="dsp9 text-2xl" style={{ color: perfect ? "#6fe3a1" : "#EAF0F7" }}>
                        {perfect ? "SWEEP" : eliminated ? "OUT" : "CUP"}
                      </div>
                      <div className="eyebrow" style={{ fontSize: 9 }}>RESULT</div>
                    </div>
                    <div>
                      <div className="dsp9 text-2xl" style={{ color: "#E8465A" }}>{runStats.ovr}</div>
                      <div className="eyebrow" style={{ fontSize: 9 }}>TEAM OVR</div>
                    </div>
                    <div>
                      <div className="dsp9 text-2xl" style={{ color: "#f2d27c" }}>
                        {efficiencyFrom(runStats.margins, runStats.ovr, perfect && runStats.dreamMargin > 0 ? runStats.dreamMargin : null)}
                      </div>
                      <div className="eyebrow" style={{ fontSize: 9 }}>EFFICIENCY</div>
                    </div>
                  </div>
                  {dailyStreak?.currentStreak > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid #1c2333" }}>
                      <div className="dsp9 text-2xl" style={{ color: "#f2d27c" }}>
                        {dailyStreak.currentStreak} DAY STREAK
                      </div>
                      <div className="eyebrow" style={{ fontSize: 9, color: "#7d8ba0" }}>
                        {streakMilestone(dailyStreak.currentStreak)
                          ? `${streakMilestone(dailyStreak.currentStreak)}-DAY MILESTONE`
                          : dailyStreak.longestStreak > dailyStreak.currentStreak
                            ? `BEST ${dailyStreak.longestStreak}`
                            : "PARTICIPATION"}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <p className="text-center mt-4 text-sm px-2" style={{ color: "#93a1b5" }}>
                {perfect
                  ? dreamGamePlayed && dreamGame
                    ? dreamGame.my > dreamGame.op
                      ? "You beat the Dream Team. There is nothing left to prove."
                      : "The Dream Team wins again. Some legends are untouchable."
                    : "World champions — and undefeated. Eight wins, zero losses. So the remaining question is. Are you better than the legendary Dream Team?"
                  : eliminated
                    ? (groupOut
                      ? "Finished outside the top 2 of your group — the tournament goes on without you."
                      : r2Out
                        ? "Outside the top 2 of the 2nd-round group — the quarterfinals go on without you."
                        : `${wins} win${wins !== 1 ? "s" : ""} — the World Cup claims another five.`)
                    : `World champions at ${wins}–${losses}. You lifted the Cup — but a Perfect Sweep demands zero losses.`}
              </p>

              <div ref={ctaAnchorRef} className="mt-6 flex flex-col gap-3">
                {perfect && !dreamGamePlayed && (
                  <button onClick={faceDreamTeam} className="btnP skew dsp9 text-lg px-8 py-3.5 w-full">
                    <span className="unskew whitespace-nowrap">🏀{"\u00A0"}FACE THE DREAM TEAM<BtnArrow /></span>
                  </button>
                )}
                <button onClick={() => setScreen("card")} className={`skew dsp9 text-lg px-8 py-3.5 w-full ${perfect && !dreamGamePlayed ? "chip btnG" : "btnP"}`}>
                  <span className="unskew whitespace-nowrap">
                    {mode === "daily" ? "🔗 SHARE RESULT" : "🏆 TOURNAMENT CARD"}
                    {perfect && !dreamGamePlayed ? "" : <BtnArrow />}
                  </span>
                </button>
                {mode === "daily" && (
                  <button
                    onClick={() => { setDailyBoardTab(true); setScreen("leaderboard"); }}
                    className="skew chip dsp9 text-base px-6 py-2.5 btnG w-full"
                  >
                    <span className="unskew">TODAY&apos;S STANDINGS</span>
                  </button>
                )}
                {!dailySubmitted && mode === "daily" && dailyStatus === "done" && (
                  <button onClick={() => setShowDailySubmit(true)} className="skew chip dsp9 text-base px-6 py-2.5 btnG w-full">
                    <span className="unskew">POST TO STANDINGS</span>
                  </button>
                )}
                <button onClick={reset} className="skew chip dsp9 text-base px-6 py-2.5 btnG w-full sm:w-auto sm:self-start">
                  <span className="unskew whitespace-nowrap">
                    {mode === "daily" ? "↩ FREE PLAY" : "⟳ RUN IT BACK"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ SHARED RUN LOADING ============ */}
      {screen === "shareload" && (
        <div className="max-w-3xl mx-auto px-4 py-24 text-center pop">
          <div className="eyebrow" style={{ fontSize: 12 }}>LOADING SHARED RUN…</div>
        </div>
      )}

      {/* ============ TOURNAMENT CARD ============ */}
      {screen === "card" && runStats && (
        <div className="max-w-3xl mx-auto px-4 py-6 pop">
          <div className="panel text-left p-5">
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setScreen("done")} className="skew chip dsp px-3 py-1.5 text-sm btnG shrink-0">
                  <span className="unskew">← BACK</span>
                </button>
                <div className="flex-1 flex justify-center min-w-0 px-1">
                  <span className="cardRunMeta truncate" style={{ fontSize: 11, letterSpacing: ".05em" }}>
                    {runStats.resultLabel}
                  </span>
                </div>
                <button onClick={shareLink} className="skew chip dsp px-4 py-1.5 text-sm btnP shrink-0" style={{ textAlign: "center" }}>
                  <span className="unskew">{linkCopied ? "✓ LINK COPIED" : "🔗 SHARE"}</span>
                </button>
              </div>
              <div className="cardRunMeta mt-3 sm:mt-2">
                <span className="flex gap-2">
                  {runStats.margins.map((m, i) => (
                    <span key={i} style={{ color: marginColor(m) }}>
                      {m > 0 ? `+${m}` : m}
                    </span>
                  ))}
                </span>
              </div>
            </div>

            {runStats.players.map((p) => (
              <div key={p.pos + p.name} className="flex items-center gap-3 px-2 py-2"
                style={{ borderTop: "1px solid #1c2333" }}>
                <Gem rt={p.rt} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="dsp text-base truncate" style={{ color: "#fff" }}>
                    {p.pos} · #{p.n} {p.name}
                  </div>
                  <div className="text-[11px]" style={{ color: "#5f6b7d" }}>{p.team} '{p.season.slice(2)}</div>
                </div>
                <div className="text-right">
                  <div className="dsp9 text-lg" style={{ color: "#ff8b98" }}>{p.ppg.toFixed(1)} <span className="text-xs" style={{ color: "#5f6b7d" }}>PPG</span></div>
                  <div className="text-[11px]" style={{ color: "#5f6b7d" }}>BEST {p.best} · TOTAL {p.tot}</div>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-5 gap-2 mt-3 pt-3" style={{ borderTop: "1px solid #232b3d" }}>
              {[
                [`OVR ${runStats.ovr}`, "TEAM RATING"],
                [runStats.ppgF.toFixed(1), "PTS FOR / G"],
                [runStats.ppgA.toFixed(1), "PTS AGAINST / G"],
                [`${runStats.avgMargin > 0 ? "+" : ""}${runStats.avgMargin.toFixed(1)}`, "AVG MARGIN"],
                [`+${runStats.bigWin}`, "BIGGEST WIN"],
              ].map(([v, l]) => (
                <div key={l} className="text-center">
                  <div className="dsp9 text-xl" style={{ color: "#EAF0F7" }}>{v}</div>
                  <div className="eyebrow" style={{ fontSize: 9 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 mt-6 px-4 max-w-md sm:max-w-none mx-auto">
            <button onClick={() => setScreen("done")} className="skew chip dsp9 text-base sm:text-lg px-6 sm:px-8 py-3 btnG">
              <span className="unskew whitespace-nowrap">← BACK TO RESULTS</span>
            </button>
            <button onClick={shareStoryImage} disabled={storyBusy} className="skew chip dsp9 text-base sm:text-lg px-6 sm:px-8 py-3 btnG" style={storyBusy ? { opacity: 0.6 } : undefined}>
              <span className="unskew whitespace-nowrap">{storyBusy ? "RENDERING…" : "📸 STORY IMAGE"}</span>
            </button>
            <button onClick={reset} className="skew chip dsp9 text-base sm:text-lg px-6 sm:px-8 py-3 btnP">
              <span className="unskew whitespace-nowrap">RUN IT BACK<BtnArrow /></span>
            </button>
          </div>
        </div>
      )}

      {/* ============ TEAMS INDEX ============ */}
      {screen === "teams" && (
        <div className="max-w-3xl mx-auto px-4 py-6 pop">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={reset} className="skew chip dsp px-3 py-1.5 text-sm btnG shrink-0">
              <span className="unskew">← HOME</span>
            </button>
            <div className="eyebrow flex-1 text-center" style={{ color: "#E8465A" }}>PERFECT SWEEP · ARCHIVE</div>
          </div>
          <div className="panel p-5 mb-4">
            <div className="flex items-end justify-between gap-3 flex-wrap border-b pb-3" style={{ borderColor: "#232b3d" }}>
              <h1 className="dsp9 text-4xl sm:text-5xl" style={{ color: "#EAF0F7", lineHeight: 0.95 }}>THE TEAMS</h1>
              <div className="eyebrow" style={{ color: "#93a1b5" }}>
                {NATIONS_ARCHIVE.length} NATIONS · {TEAMS.length} SQUADS
              </div>
            </div>
            <p className="mt-4 text-sm" style={{ color: "#93a1b5" }}>
              Every nation in the draft pool — powerhouses, dark horses, and defunct federations.
              Pick a country to see its World Cup squads year by year.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {NATIONS_ARCHIVE.map((n) => (
              <button
                key={n.name}
                type="button"
                onClick={() => openNation(n.name)}
                className="panel px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors"
                style={{ borderLeft: `3px solid ${n.c}` }}
              >
                <span className="dsp text-base" style={{ color: "#EAF0F7" }}>{n.name}</span>
                <span className="eyebrow shrink-0" style={{ color: "#7d8ba0" }}>
                  {n.squads.length} SQUAD{n.squads.length !== 1 ? "S" : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============ NATION DETAIL ============ */}
      {screen === "team" && !browseNationData && (
        <div className="max-w-3xl mx-auto px-4 py-12 text-center pop">
          <div className="eyebrow mb-3" style={{ color: "#f08a8a" }}>NATION NOT FOUND</div>
          <button onClick={openTeams} className="btnP skew dsp9 text-lg px-8 py-3">
            <span className="unskew">← BACK TO TEAMS</span>
          </button>
        </div>
      )}

      {screen === "team" && browseNationData && (
        <div className="max-w-3xl mx-auto px-4 py-6 pop">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={openTeams} className="skew chip dsp px-3 py-1.5 text-sm btnG shrink-0">
              <span className="unskew">← TEAMS</span>
            </button>
            <div className="eyebrow flex-1 text-center" style={{ color: "#E8465A" }}>PERFECT SWEEP · TEAM</div>
          </div>
          <div className="panel p-5 mb-4" style={{ borderTop: `3px solid ${browseNationData.c}` }}>
            <div className="flex items-end justify-between gap-3 flex-wrap border-b pb-3" style={{ borderColor: "#232b3d" }}>
              <h1 className="dsp9 text-3xl sm:text-4xl" style={{ color: "#EAF0F7", lineHeight: 0.95 }}>
                {browseNationData.name.toUpperCase()}
              </h1>
              <div className="eyebrow" style={{ color: "#93a1b5" }}>
                {browseNationData.squads.length} SQUAD{browseNationData.squads.length !== 1 ? "S" : ""} ·{" "}
                {browseNationData.squads.length === 1
                  ? browseNationData.squads[0].season
                  : `${browseNationData.squads[browseNationData.squads.length - 1].season}–${browseNationData.squads[0].season}`}
              </div>
            </div>
            <p className="mt-4 text-sm" style={{ color: "#93a1b5" }}>
              Draftable World Cup squads for {browseNationData.name} in the Perfect Sweep pool.
              Ratings and traits match what you can roll in-game.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {browseNationData.squads.map((squad) => (
              <div key={squad.season} className="panel">
                <div className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{
                    background: `linear-gradient(90deg, ${squad.c}22, transparent)`,
                    borderBottom: "1px solid #1c2333",
                    borderRadius: "inherit",
                  }}>
                  <div>
                    <div className="eyebrow" style={{ color: "#93a1b5" }}>WORLD CUP</div>
                    <div className="dsp9 text-2xl" style={{ color: "#fff" }}>{squad.season}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="eyebrow">OVR</span>
                    <Gem rt={Math.round(teamRating(squad))} size={40} />
                  </div>
                </div>
                <div>
                  {squad.players.map((p) => (
                    <div key={`${p.n}-${p.name}`} className="flex items-center gap-3 px-4 py-2 relative"
                      style={{ borderTop: "1px solid #1c2333", overflow: "visible" }}>
                      <Gem rt={p.rt} size={32} />
                      <div className="flex-1 min-w-0 relative" style={{ overflow: "visible" }}>
                        <div className="dsp text-sm truncate" style={{ color: "#fff" }}>
                          {p.pos} · #{p.n} {p.name}
                        </div>
                        {playerTraits(p).map((id) => (
                          <TraitLabel key={id} traitId={id} />
                        ))}
                      </div>
                      <div className="eyebrow" style={{ color: "#5f6b7d" }}>{p.rt}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ HOW TO PLAY ============ */}
      {screen === "howto" && (
        <div className="max-w-3xl mx-auto px-4 py-6 pop">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={reset} className="skew chip dsp px-3 py-1.5 text-sm btnG shrink-0">
              <span className="unskew">← HOME</span>
            </button>
            <div className="eyebrow flex-1 text-center" style={{ color: "#E8465A" }}>PERFECT SWEEP · GUIDE</div>
          </div>

          <div className="panel p-5 mb-4">
            <div className="flex items-end justify-between gap-3 flex-wrap border-b pb-3" style={{ borderColor: "#232b3d" }}>
              <h1 className="dsp9 text-4xl sm:text-5xl" style={{ color: "#EAF0F7", lineHeight: 0.95 }}>HOW TO PLAY</h1>
              <div className="eyebrow" style={{ color: "#93a1b5" }}>ROLL · DRAFT · SWEEP</div>
            </div>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "#93a1b5" }}>
              Perfect Sweep is a basketball drafting game: build a dream national five from legendary
              World Cup squads, then simulate a full tournament. The ultimate mark is the{" "}
              <b style={{ color: "#ff8b98" }}>Perfect Sweep — 8–0</b>: win the Cup without losing a single game.
            </p>
          </div>

          <div className="panel p-5 mb-3">
            <h2 className="dsp text-xl mb-2" style={{ color: "#EAF0F7" }}>1 · THE DRAFT</h2>
            <p className="text-sm leading-relaxed mb-3" style={{ color: "#93a1b5" }}>
              Tip off and roll. Each roll draws a historic national squad — USA &apos;94, Spain &apos;06, Slovenia &apos;23.
              From that squad you sign <b style={{ color: "#c6d2e3" }}>one player</b> into an empty slot
              (PG / SG / SF / PF / C). Then roll again until your five is set.
            </p>
            <ul className="text-sm leading-relaxed space-y-2" style={{ color: "#c6d2e3" }}>
              <li><b style={{ color: "#ff8b98" }}>Roll</b> — draw a new nation and year to pick from.</li>
              <li><b style={{ color: "#ff8b98" }}>Swaps</b> — twice per run you can switch nation (same year) or year (same nation).</li>
              <li><b style={{ color: "#ff8b98" }}>Tactic</b> — Run &amp; Gun, Balanced, or Lockdown, trading pace, offense, and defense.</li>
            </ul>
          </div>

          <div className="panel p-5 mb-3">
            <h2 className="dsp text-xl mb-2" style={{ color: "#EAF0F7" }}>2 · THE WORLD CUP</h2>
            <p className="text-sm leading-relaxed" style={{ color: "#93a1b5" }}>
              With your five locked, you play eight games: three group games, two second-round games,
              then quarterfinal, semifinal, and the Final. Group stages use a real table — finish outside
              the top two and you&apos;re out even with a win left on the board. Knockouts are win or go home.
              Every game is simulated live with quarters, box scores, and optional play-by-play.
            </p>
          </div>

          <div className="panel p-5 mb-3">
            <h2 className="dsp text-xl mb-2" style={{ color: "#EAF0F7" }}>3 · THE PERFECT SWEEP</h2>
            <p className="text-sm leading-relaxed" style={{ color: "#93a1b5" }}>
              Win the Final and you&apos;re <b style={{ color: "#c6d2e3" }}>World Champions</b> — even if you dropped
              a group game or two along the way. Go through all eight without a single loss and you&apos;ve
              earned the <b style={{ color: "#7ee2a8" }}>Perfect Sweep</b>. That unlocks a bonus game against
              the 1992 Dream Team. A loss anywhere before the Final kills the sweep, but not necessarily the Cup.
            </p>
          </div>

          <div className="panel p-5 mb-3">
            <h2 className="dsp text-xl mb-2" style={{ color: "#EAF0F7" }}>4 · TRAITS</h2>
            <p className="text-sm leading-relaxed" style={{ color: "#93a1b5" }}>
              Some legends carry traits — green boosts or red risks — that can fire mid-game and swing a quarter.
              Hover a trait in the{" "}
              <button type="button" onClick={openTeams} className="underline" style={{ color: "#ff8b98" }}>
                TEAMS
              </button>
              {" "}archive to see what it does before you draft.
            </p>
          </div>

          <div className="panel p-5 mb-5">
            <h2 className="dsp text-xl mb-2" style={{ color: "#EAF0F7" }}>5 · SHARE YOUR RUN</h2>
            <p className="text-sm leading-relaxed" style={{ color: "#93a1b5" }}>
              When the tournament ends, open your Tournament Card and copy the link. Anyone with the URL
              can see your five, the path you took, and whether the Perfect Sweep held.
            </p>
          </div>

          <button
            className="btnP skew dsp9 text-xl px-10 py-3.5 w-full sm:w-auto"
            onClick={() => { reset(); roll(); setScreen("draft"); }}
          >
            <span className="unskew">TIP OFF<BtnArrow /></span>
          </button>
        </div>
      )}

      {/* ============ ABOUT ============ */}
      {screen === "about" && (
        <div className="max-w-3xl mx-auto px-4 py-6 pop">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={reset} className="skew chip dsp px-3 py-1.5 text-sm btnG shrink-0">
              <span className="unskew">← HOME</span>
            </button>
            <div className="eyebrow flex-1 text-center" style={{ color: "#E8465A" }}>PERFECT SWEEP · ABOUT</div>
          </div>

          <div className="panel p-5 mb-4">
            <div className="flex items-end justify-between gap-3 flex-wrap border-b pb-3" style={{ borderColor: "#232b3d" }}>
              <h1 className="dsp9 text-4xl sm:text-5xl" style={{ color: "#EAF0F7", lineHeight: 0.95 }}>ABOUT</h1>
              <div className="eyebrow" style={{ color: "#93a1b5" }}>8–0 · THE MARK</div>
            </div>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "#93a1b5" }}>
              Perfect Sweep brings legendary FIBA World Cup national squads into one drafting gauntlet.
              You roll nations across eras, build a dream five that never shared a locker room, and chase
              the rarest finish in the tournament: win the Cup without losing a single game.
            </p>
          </div>

          <div className="panel p-5 mb-3">
            <h2 className="dsp text-xl mb-2" style={{ color: "#EAF0F7" }}>THE IDEA</h2>
            <p className="text-sm leading-relaxed" style={{ color: "#93a1b5" }}>
              It started from a simple thought: what if Sabonis of &apos;86 could share the floor with Luka of &apos;23?
              Perfect Sweep turns that into a run — roll a squad, sign one star per position, pick a tactic,
              and simulate an eight-game World Cup path. Lift the trophy with losses along the way and you&apos;re
              still World Champions. Go undefeated — 8–0 — and you&apos;ve earned the Perfect Sweep, plus a bonus
              tip-off against the 1992 Dream Team.
            </p>
          </div>

          <div className="panel p-5 mb-3">
            <h2 className="dsp text-xl mb-2" style={{ color: "#EAF0F7" }}>THE ARCHIVE</h2>
            <p className="text-sm mb-3" style={{ color: "#93a1b5" }}>
              Behind every roll is a curated pool of World Cup basketball:
            </p>
            <ul className="text-sm leading-relaxed space-y-2" style={{ color: "#c6d2e3" }}>
              <li>
                <b style={{ color: "#ff8b98" }}>{ARCHIVE_STATS.nations} nations</b>
                {" "}in the draft pool — from powerhouses to dark horses, including defunct sides like
                the Soviet Union and Yugoslavia.
              </li>
              <li>
                <b style={{ color: "#ff8b98" }}>{ARCHIVE_STATS.years.count} World Cups</b>
                {" "}represented, from {ARCHIVE_STATS.years.first} to {ARCHIVE_STATS.years.last},
                with every podium squad from that modern era playable.
              </li>
              <li>
                <b style={{ color: "#ff8b98" }}>{ARCHIVE_STATS.squads} squads</b>
                {" "}and{" "}
                <b style={{ color: "#ff8b98" }}>{ARCHIVE_STATS.players} players</b>
                , each with a position, number, and 2K-style rating
                {ARCHIVE_STATS.traits > 0 ? (
                  <> — plus {ARCHIVE_STATS.traits} with gameplay traits that can swing a quarter</>
                ) : null}.
              </li>
            </ul>
            <p className="text-sm mt-3 leading-relaxed" style={{ color: "#93a1b5" }}>
              Browse the full list anytime from{" "}
              <button type="button" onClick={openTeams} className="underline" style={{ color: "#ff8b98" }}>
                TEAMS
              </button>
              .
            </p>
          </div>

          <div className="panel p-5 mb-3">
            <h2 className="dsp text-xl mb-2" style={{ color: "#EAF0F7" }}>HOW PLAYERS ARE RATED</h2>
            <p className="text-sm leading-relaxed" style={{ color: "#93a1b5" }}>
              Each player carries a rating that feeds the sim, shown as a gem on the draft board.
              Ratings are subjective by nature — they aim to capture a player&apos;s level in that specific
              World Cup, not their full career peak. Some stars also carry traits (boosts or risks) that
              can fire mid-game and rewrite a quarter.
            </p>
          </div>

          <div className="panel p-5 mb-5">
            <h2 className="dsp text-xl mb-2" style={{ color: "#EAF0F7" }}>FREE AND NO CATCH</h2>
            <p className="text-sm leading-relaxed" style={{ color: "#93a1b5" }}>
              Perfect Sweep is free to play. No account, no paywall — tip off, draft, and share a finished
              run with a link. The Perfect Sweep is rare on purpose. That&apos;s the point.
            </p>
          </div>

          <button
            className="btnP skew dsp9 text-xl px-10 py-3.5 w-full sm:w-auto"
            onClick={() => { reset(); roll(); setScreen("draft"); }}
          >
            <span className="unskew">TIP OFF<BtnArrow /></span>
          </button>
        </div>
      )}

      {/* ============ HALL OF FAME ============ */}
      {screen === "leaderboard" && (
        <div className="max-w-3xl mx-auto px-4 py-6 pop">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={reset} className="skew chip dsp px-3 py-1.5 text-sm btnG shrink-0">
              <span className="unskew">← HOME</span>
            </button>
            <div className="eyebrow flex-1 text-center" style={{ color: "#E8465A" }}>
              {dailyBoardTab ? `DAILY #${dailyNumber(utcDayKey())}` : "HALL OF FAME"}
            </div>
          </div>

          <div className="flex justify-center gap-2 mb-5">
            <button
              onClick={() => setDailyBoardTab(false)}
              className={`skew chip dsp px-4 py-2 text-sm ${!dailyBoardTab ? "btnP" : "btnG"}`}
            >
              <span className="unskew">HALL OF FAME</span>
            </button>
            <button
              onClick={() => setDailyBoardTab(true)}
              className={`skew chip dsp px-4 py-2 text-sm ${dailyBoardTab ? "btnP" : "btnG"}`}
            >
              <span className="unskew">DAILY</span>
            </button>
          </div>

          {!dailyBoardTab && (
            <>
              <div className="mb-5 text-center">
                <h1 className="dsp9 text-4xl sm:text-5xl" style={{ color: "#EAF0F7", lineHeight: 0.95 }}>HALL OF FAME</h1>
                <p className="mt-3 text-sm max-w-lg mx-auto" style={{ color: "#93a1b5" }}>
                  Reserved for Perfect Sweep + Dream Team conquerors. Score = sum of margins.
                </p>
              </div>
              {lbLoading && <div className="panel p-6 text-center text-sm" style={{ color: "#93a1b5" }}>Loading…</div>}
              {!lbLoading && lbError && <div className="panel p-6 text-center text-sm" style={{ color: "#ff8b98" }}>{lbError}</div>}
              {!lbLoading && !lbError && lbEntries.length === 0 && (
                <div className="panel p-8 text-center">
                  <div className="dsp9 text-2xl" style={{ color: "#EAF0F7" }}>THE THRONE IS EMPTY</div>
                  <p className="mt-2 text-sm max-w-sm mx-auto" style={{ color: "#93a1b5" }}>
                    Nobody&apos;s gone 8–0 and taken down the Dream Team yet. Be the first name on the board.
                  </p>
                </div>
              )}
              {!lbLoading && !lbError && lbEntries.length > 0 && (
                <div className="panel overflow-hidden">
                  <div className="grid gap-2 px-4 py-2 eyebrow" style={{ gridTemplateColumns: "2.5rem 1fr 1fr 3rem 4rem", color: "#7d8ba0", borderBottom: "1px solid #232b3d" }}>
                    <span>#</span><span>NICK</span><span>COUNTRY</span>
                    <span className="text-right">OVR</span><span className="text-right">SCORE</span>
                  </div>
                  {lbEntries.map((e) => {
                    const c = countryByCode(e.country);
                    return (
                      <div key={`${e.rank}-${e.nick}-${e.score}`} className="grid gap-2 px-4 py-3 items-center text-sm" style={{ gridTemplateColumns: "2.5rem 1fr 1fr 3rem 4rem", borderBottom: "1px solid #1a2233" }}>
                        <span className="dsp9" style={{ color: e.rank <= 3 ? "#E8465A" : "#7d8ba0" }}>{e.rank}</span>
                        <span className="dsp truncate" style={{ color: "#EAF0F7" }}>{e.nick}</span>
                        <span style={{ color: "#c6d2e3" }}><span className="mr-1.5" aria-hidden>{c?.flag || "🌍"}</span>{c?.name || e.country}</span>
                        <span className="dsp9 text-right" style={{ color: e.ovr != null ? "#c6d2e3" : "#5f6b7d" }}>{e.ovr != null ? e.ovr : "—"}</span>
                        <span className="dsp9 text-right" style={{ color: "#7ee2a8" }}>{e.score}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <button className="btnP skew dsp9 text-xl px-10 py-3.5 mt-6 w-full sm:w-auto" onClick={() => { reset(); roll(); setScreen("draft"); }}>
                <span className="unskew">TIP OFF — TRY TO JOIN THE HALL OF FAME<BtnArrow /></span>
              </button>
            </>
          )}

          {dailyBoardTab && (
            <>
              <div className="mb-5 text-center">
                <h1 className="dsp9 text-4xl sm:text-5xl" style={{ color: "#EAF0F7", lineHeight: 0.95 }}>DAILY #{dailyNumber(utcDayKey())}</h1>
                <p className="mt-3 text-sm max-w-lg mx-auto" style={{ color: "#93a1b5" }}>
                  {formatDayLabel(utcDayKey())} UTC · Ranked by perfect sweep, efficiency, wins, then OVR.
                  {dailyLbCount ? ` · ${dailyLbCount} played` : ""}
                </p>
                {dailyCpuEnabled && (
                  <p className="mt-3 text-sm max-w-md mx-auto" style={{ color: "#7d8ba0" }}>
                    World Cup coaches play the same draw with their usual benches. Beat them, then beat the Dream Team.
                  </p>
                )}
              </div>
              {dailyLbLoading && mixedDailyBoard.length === 0 && (
                <div className="panel p-6 text-center text-sm" style={{ color: "#93a1b5" }}>Loading…</div>
              )}
              {!dailyLbLoading && dailyLbError && (
                <div className="panel p-6 text-center text-sm mb-3" style={{ color: "#ff8b98" }}>
                  {dailyLbError}
                  <div className="mt-2" style={{ color: "#93a1b5" }}>Your local result still counts — standings are optional.</div>
                </div>
              )}
              {!dailyLbLoading && !dailyLbError && mixedDailyBoard.length === 0 && (
                <div className="panel p-8 text-center">
                  <div className="dsp9 text-2xl" style={{ color: "#EAF0F7" }}>NO ENTRIES YET</div>
                  <p className="mt-2 text-sm max-w-sm mx-auto" style={{ color: "#93a1b5" }}>
                    Be the first to post today&apos;s challenge.
                  </p>
                </div>
              )}
              {mixedDailyBoard.length > 0 && (
                <div className="panel overflow-hidden">
                  <div className="grid gap-2 px-4 py-2 eyebrow" style={{ gridTemplateColumns: "2.5rem 1fr 3.5rem 3rem 3.5rem", color: "#7d8ba0", borderBottom: "1px solid #232b3d" }}>
                    <span>#</span><span>NICK</span>
                    <span className="text-right">REC</span>
                    <span className="text-right">OVR</span>
                    <span className="text-right">EFF</span>
                  </div>
                  {mixedDailyBoard.map((e) => {
                    const c = e.cpu ? null : countryByCode(e.country);
                    const nick = e.cpu ? String(e.nick || "").replace(/^CPU · /, "") : e.nick;
                    const when = e.at ? formatRelativeTime(e.at, dailyBoardNow) : "";
                    const sub = e.cpu
                      ? `${when} · tap to inspect`
                      : `${c?.flag || ""} ${c?.name || e.country || ""}${when ? ` · ${when}` : ""} · tap to inspect`;
                    return (
                      <button
                        key={e.id || `${e.rank}-${e.nick}`}
                        type="button"
                        onClick={() => openBoardInspect(e)}
                        aria-label={`Inspect ${nick}`}
                        className={`grid gap-2 px-4 py-3 items-center text-sm w-full text-left ${e.cpu ? "cpuRow" : "boardRow"}`}
                        style={{
                          gridTemplateColumns: "2.5rem 1fr 3.5rem 3rem 3.5rem",
                          borderBottom: "1px solid #1a2233",
                          color: "inherit",
                        }}
                      >
                        <span className="dsp9" style={{ color: e.rank <= 3 ? "#E8465A" : "#7d8ba0" }}>{e.rank}</span>
                        <span className="min-w-0">
                          <span className="dsp block leading-tight" style={{ color: e.cpu ? "#b7c4d6" : "#EAF0F7" }}>
                            {e.cpu && <span className="cpuBadge">CPU</span>}
                            {e.perfect ? "⭐ " : ""}{nick}
                          </span>
                          <span className="text-[11px]" style={{ color: "#5f6b7d" }}>
                            {sub}
                          </span>
                        </span>
                        <span className="dsp9 text-right" style={{ color: "#c6d2e3" }}>{e.w}–{e.l}</span>
                        <span className="dsp9 text-right" style={{ color: "#c6d2e3" }}>{e.ovr}</span>
                        <span className="dsp9 text-right" style={{ color: "#f2d27c" }}>{e.efficiency}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <button className="btnP skew dsp9 text-xl px-10 py-3.5 mt-6 w-full sm:w-auto" onClick={startDailyChallenge}>
                <span className="unskew">PLAY TODAY&apos;S DAILY<BtnArrow /></span>
              </button>
            </>
          )}
        </div>
      )}

      <div className="text-center eyebrow py-6 flex items-center justify-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={openTeams}
          className="eyebrow cursor-pointer"
          style={{ color: screen === "teams" || screen === "team" ? "#ff8b98" : "#93a1b5", letterSpacing: "inherit" }}
        >
          TEAMS
        </button>
        <span style={{ color: "#3d486c" }}>·</span>
        <button
          type="button"
          onClick={openHowTo}
          className="eyebrow cursor-pointer"
          style={{ color: screen === "howto" ? "#ff8b98" : "#93a1b5", letterSpacing: "inherit" }}
        >
          HOW TO PLAY
        </button>
        <span style={{ color: "#3d486c" }}>·</span>
        <button
          type="button"
          onClick={openLeaderboard}
          className="eyebrow cursor-pointer"
          style={{ color: screen === "leaderboard" ? "#ff8b98" : "#93a1b5", letterSpacing: "inherit" }}
        >
          HALL OF FAME
        </button>
        <span style={{ color: "#3d486c" }}>·</span>
        <button
          type="button"
          onClick={openAbout}
          className="eyebrow cursor-pointer"
          style={{ color: screen === "about" ? "#ff8b98" : "#93a1b5", letterSpacing: "inherit" }}
        >
          ABOUT
        </button>
      </div>
    </div>
  );
}
