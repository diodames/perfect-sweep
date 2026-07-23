import leoProfanity from "leo-profanity";

export const NICK_RE = /^[a-zA-Z0-9 _-]{2,16}$/;
export const NICK_ERROR = "Choose a different nickname.";
const FORMAT_ERROR = "Nickname must be 2–16 characters (letters, numbers, space, _ or -).";

/** Reserved / impersonation — matched as whole nick or token only. */
const RESERVED = ["admin", "moderator", "mod", "official", "support", "staff"];

/** High-severity / harassment stems — substring match on normalized nick. */
const BLOCK_STEMS = [
  "nazi",
  "hitler",
  "kkk",
  "rape",
  "rapist",
  "pedophile",
  "pedo",
  "molest",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "tranny",
  "suck",
  "idiot",
  "stupid",
  "loser",
  "moron",
  "dumbass",
  "asshole",
  "jackass",
];

/** Known safe words that contain blocked substrings (Scunthorpe problem). */
const STEM_EXCEPTIONS = new Set(["scunthorpe", "mishit", "assassin", "classify", "bass"]);

const LEET = {
  "0": "o",
  "1": "i",
  "2": "z",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  "$": "s",
};

let ready = false;
let dictStems = [];
function ensureFilter() {
  if (ready) return;
  leoProfanity.loadDictionary("en");
  for (const w of [...RESERVED, ...BLOCK_STEMS]) {
    if (!leoProfanity.check(w)) leoProfanity.add(w);
  }
  // Substring stems from the dictionary (len >= 4) catch glued insults like "yousuck".
  dictStems = leoProfanity.list().filter((w) => typeof w === "string" && w.length >= 4);
  ready = true;
}

/** Lowercase, strip separators, fold common leet digits for content checks. */
export function normalizeNickForCheck(nick) {
  let s = String(nick || "").toLowerCase().replace(/[\s_-]+/g, "");
  s = s.replace(/[012345789@$]/g, (ch) => LEET[ch] || ch);
  return s;
}

function containsBlockedStem(normalized) {
  if (STEM_EXCEPTIONS.has(normalized)) return false;
  if (BLOCK_STEMS.some((w) => normalized.includes(w))) return true;
  return dictStems.some((w) => normalized.includes(w));
}

function hitsCustomBlock(trimmed, normalized, tokens) {
  const foldedTokens = tokens.map((t) => normalizeNickForCheck(t));
  if (RESERVED.includes(normalized) || foldedTokens.some((t) => RESERVED.includes(t))) {
    return true;
  }
  return containsBlockedStem(normalized);
}

/**
 * @param {string} nick
 * @returns {{ ok: true, nick: string } | { ok: false, error: string }}
 */
export function validateNick(nick) {
  ensureFilter();
  const trimmed = String(nick || "").trim();
  if (!NICK_RE.test(trimmed)) {
    return { ok: false, error: FORMAT_ERROR };
  }
  const normalized = normalizeNickForCheck(trimmed);
  const tokens = trimmed.toLowerCase().split(/[\s_-]+/).filter(Boolean);
  if (!normalized || leoProfanity.check(normalized) || hitsCustomBlock(trimmed, normalized, tokens)) {
    return { ok: false, error: NICK_ERROR };
  }
  // Also check space-separated tokens against the dictionary (e.g. "bad word").
  for (const t of tokens) {
    const folded = normalizeNickForCheck(t);
    if (leoProfanity.check(t) || leoProfanity.check(folded)) {
      return { ok: false, error: NICK_ERROR };
    }
  }
  return { ok: true, nick: trimmed };
}
