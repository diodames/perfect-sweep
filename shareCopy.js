/**
 * Shared result share copy — used by /api/share (OG meta), /api/og (image headline),
 * and the client clipboard / Web Share text. Keep tones challenge-first for early exits.
 */

const COLORS = {
  sweep: "#6fe3a1",
  champs: "#f2d27c",
  challenge: "#23b4e2",
};

/** Short OG-image label (record shown separately via chip / appended in landscape). */
const IMAGE = {
  sweep: ["PERFECT SWEEP", "UNDEFEATED CHAMPION", "THE PERFECT SWEEP"],
  champs: ["CHAMPION", "CUP WINNERS", "WORLD CHAMPIONS"],
  challenge: ["MY FIVE WENT", "WORLD CUP RUN", "YOUR TURN"],
};

/** OG title / share lead templates — `{rec}` = wins–losses. */
const TITLE = {
  sweep: [
    "PERFECT SWEEP 🏆 {rec}",
    "UNDEFEATED CHAMPION 🏆 {rec}",
    "{rec}. THE PERFECT SWEEP 🏆",
  ],
  champs: [
    "CHAMPION 🏆 {rec} — can you go undefeated?",
    "CUP WINNERS · {rec}. Perfect Sweep still open.",
    "WORLD CHAMPIONS · {rec} — beat the losses?",
  ],
  challenge: [
    "MY FIVE WENT {rec}. Beat it?",
    "Can you top {rec}?",
    "Drafted. Ran it. {rec} — your turn.",
  ],
};

const DESC = {
  sweep: [
    "Undefeated World Cup run. Draft your five and chase 8–0 at perfectsweep.app",
    "Perfect Sweep secured. Same archive — can you match an undefeated run?",
    "8–0 World Cup gauntlet. Build your national five and go for the Sweep.",
  ],
  champs: [
    "Lifted the Cup at {rec}. Can you take it undefeated? Draft at perfectsweep.app",
    "World Champions · {rec}. The Perfect Sweep (zero losses) is still open.",
    "Cup winners at {rec}. Same pool — can you go 8–0?",
  ],
  challenge: [
    "{rec} on the board. Same archive — draft your five and try to top it.",
    "A {rec} World Cup run. Think you can beat it? Tip off at perfectsweep.app",
    "{rec} — your move. Draft a national five and chase the Perfect Sweep.",
  ],
};

function hashPick(seed, n) {
  const s = String(seed ?? "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return n <= 0 ? 0 : (h >>> 0) % n;
}

function fill(template, rec) {
  return String(template).replace(/\{rec\}/g, rec);
}

function clip(str, max) {
  const t = String(str || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function squadLine(meta) {
  const five = (meta.players || [])
    .map((p) => `${p.pos} ${p.name}${p.t ? ` (${p.t})` : ""}`)
    .join(" · ");
  const ovr = meta.ovr ? ` — OVR ${meta.ovr}` : "";
  return five ? `${five}${ovr}` : (meta.ovr ? `OVR ${meta.ovr}` : "");
}

/** Map stored meta.result → copy category. */
export function shareCategory(result) {
  if (result === "sweep") return "sweep";
  if (result === "champs") return "champs";
  return "challenge"; // group | r2 | elim | run
}

/**
 * @param {object} meta - run meta from /api/runs
 * @param {string} [seed] - stable id (short run id) for variant rotation
 */
export function shareCopy(meta, seed = "") {
  const w = Number(meta?.w) || 0;
  const l = Number(meta?.l) || 0;
  const rec = `${w}–${l}`;
  const category = shareCategory(meta?.result);
  const idx = hashPick(seed || `${meta?.result}|${rec}|${meta?.ovr || 0}`, TITLE[category].length);

  const daily = meta?.mode === "daily" && meta?.n
    ? `DAILY #${meta.n} · `
    : "";

  const baseTitle = daily + fill(TITLE[category][idx], rec);
  let title = baseTitle;
  let shareLead = baseTitle;

  if (category === "sweep" && meta?.score != null) {
    shareLead = `${baseTitle} (+${meta.score})`;
    if (meta?.dream != null && meta.dream > 0) {
      title = clip(`${baseTitle} — DREAM TEAM BEATEN (+${meta.score})`, 70);
    } else {
      title = clip(`${baseTitle} (+${meta.score})`, 70);
    }
  } else if (category === "sweep" && meta?.dream != null && meta.dream > 0) {
    title = clip(`${baseTitle} — DREAM TEAM BEATEN`, 70);
    shareLead = `${baseTitle} — DREAM TEAM BEATEN`;
  }

  let description;
  if (meta?.mode === "daily") {
    const eff = meta.efficiency != null ? ` · EFF ${meta.efficiency}` : "";
    const ovr = meta.ovr ? ` · OVR ${meta.ovr}` : "";
    const streakN = Math.floor(Number(meta.streak) || 0);
    const streakBit = streakN > 1 ? ` · 🔥 ${streakN}-day streak` : "";
    description = clip(
      `Daily Challenge #${meta.n || "?"} · ${rec}${ovr}${eff}${streakBit}. Same day for everyone — can you top it? perfectsweep.app/?daily`,
      160,
    );
  } else {
    const squad = squadLine(meta);
    const base = fill(DESC[category][idx], rec);
    description = clip(squad ? `${squad}. ${base}` : base, 160);
  }

  return {
    category,
    color: COLORS[category],
    imageHeadline: IMAGE[category][idx],
    title: clip(title, 70),
    description,
    shareLead: clip(shareLead, 90),
  };
}
