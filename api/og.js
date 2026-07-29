import { ImageResponse } from "@vercel/og";
import { kv } from "@vercel/kv";
import { shareCopy } from "../shareCopy.js";

export const config = { runtime: "edge" };

const ID_RE = /^[A-Za-z0-9_-]{4,16}$/;

const boldFont = fetch(new URL("./_fonts/SairaCondensed-Bold.ttf", import.meta.url)).then((r) => r.arrayBuffer());
const blackFont = fetch(new URL("./_fonts/SairaCondensed-Black.ttf", import.meta.url)).then((r) => r.arrayBuffer());

/* Satori element helpers — plain object trees instead of JSX so no build step is needed. */
const el = (style = {}, children = []) => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});

/* Mirrors tier() in perfect-sweep.jsx */
const tier = (rt) =>
  rt >= 95 ? { bg: "linear-gradient(160deg,#ffd1f4,#f368e0 60%,#c93bbf)", fg: "#3c0836" } :
  rt >= 90 ? { bg: "linear-gradient(160deg,#d9fbff,#67e8f9 55%,#22b8d4)", fg: "#083a44" } :
  rt >= 87 ? { bg: "linear-gradient(160deg,#e5d4ff,#a78bfa 55%,#7c3aed)", fg: "#2a0a54" } :
  rt >= 84 ? { bg: "linear-gradient(160deg,#ffc9c9,#f87171 55%,#dc2626)", fg: "#450a0a" } :
  rt >= 81 ? { bg: "linear-gradient(160deg,#c7ddff,#60a5fa 55%,#2563eb)", fg: "#0a1e45" } :
  rt >= 78 ? { bg: "linear-gradient(160deg,#c9f7d4,#4ade80 55%,#16a34a)", fg: "#052e13" } :
             { bg: "linear-gradient(160deg,#fbe8b3,#facc15 55%,#ca8a04)", fg: "#3b2a03" };

const WIN_TILE  = { background: "#12301f", border: "2px solid #2c5c40", color: "#6fe3a1" };
const LOSS_TILE = { background: "#331519", border: "2px solid #5c2c34", color: "#ff8b98" };
const STAR_TILE = { background: "#332a0f", border: "2px solid #5c4d1d", color: "#f2d27c" };

function compactStage(stage) {
  if (!stage) return "";
  if (stage.startsWith("GROUP · G")) return stage.slice(9);
  if (stage.startsWith("2ND RD · G")) return `2R${stage.slice(10)}`;
  if (stage === "QUARTERFINAL") return "QF";
  if (stage === "SEMIFINAL") return "SF";
  if (stage === "THE FINAL") return "FINAL";
  if (stage === "DREAM TEAM") return "DREAM";
  return stage;
}

function tileWrap(child, w, h, gapX, gapY) {
  return el(
    {
      width: w + gapX, height: h + gapY,
      alignItems: "flex-start", justifyContent: "flex-start",
      paddingRight: gapX, paddingBottom: gapY,
    },
    [child]
  );
}

function simpleMarginTile(m, size, fontSize, dream = false) {
  const win = m > 0;
  const theme = dream ? (win ? STAR_TILE : LOSS_TILE) : (win ? WIN_TILE : LOSS_TILE);
  return el(
    {
      width: size, height: size, borderRadius: Math.round(size * 0.16),
      alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 900, flexDirection: "column",
      ...theme,
    },
    dream
      ? [
          starSvg(fontSize * 0.7, win ? "#f2d27c" : "#ff8b98"),
          el({ fontSize: fontSize * 0.62, lineHeight: 1.1 }, `${win ? "+" : ""}${m}`),
        ]
      : `${win ? "+" : ""}${m}`
  );
}

function gameTile(g, { width, height, compact, stageFont, scoreFont, marginFont, isDream = false }) {
  const m = g.m ?? 0;
  const win = m > 0;
  const theme = isDream ? (win ? STAR_TILE : LOSS_TILE) : (win ? WIN_TILE : LOSS_TILE);
  const stage = compact ? compactStage(g.stage) : (g.stage || "");
  const score = g.my != null && g.op != null ? `${g.my} – ${g.op}` : null;
  return el(
    {
      width, height, borderRadius: Math.round(width * 0.12),
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: Math.round(height * 0.06), padding: `${Math.round(height * 0.08)}px 4px`,
      ...theme,
    },
    [
      ...(isDream ? [starSvg(stageFont * 0.85, win ? "#f2d27c" : "#ff8b98")] : []),
      el({
        fontSize: stageFont, fontWeight: 700, letterSpacing: compact ? 0.5 : 1,
        color: "#7e8aa0", textAlign: "center", lineHeight: 1.1,
        maxWidth: width - 8, whiteSpace: "nowrap", overflow: "hidden",
      }, stage),
      ...(score
        ? [el({ fontSize: scoreFont, fontWeight: 700, color: "#EAF0F7", lineHeight: 1 }, score)]
        : []),
      el({ fontSize: marginFont, fontWeight: 900, color: theme.color, lineHeight: 1 },
        `${win ? "+" : ""}${m}`),
    ]
  );
}

function marginTiles(meta, opts) {
  const {
    cardW, cardH, gapX, gapY, compact,
    stageFont, scoreFont, marginFont,
    simpleSize, simpleFont,
  } = opts;

  if (meta.games?.length) {
    const tiles = meta.games.map((g) =>
      tileWrap(gameTile(g, { width: cardW, height: cardH, compact, stageFont, scoreFont, marginFont }), cardW, cardH, gapX, gapY)
    );
    if (meta.dreamGame) {
      tiles.push(tileWrap(
        gameTile(meta.dreamGame, { width: cardW, height: cardH, compact, stageFont, scoreFont, marginFont, isDream: true }),
        cardW, cardH, gapX, gapY
      ));
    } else if (meta.dream != null) {
      tiles.push(tileWrap(simpleMarginTile(meta.dream, simpleSize, simpleFont, true), simpleSize, simpleSize, gapX, gapY));
    }
    return tiles;
  }

  const tiles = (meta.margins || []).map((m) =>
    tileWrap(simpleMarginTile(m, simpleSize, simpleFont), simpleSize, simpleSize, gapX, gapY)
  );
  if (meta.dream != null) {
    tiles.push(tileWrap(simpleMarginTile(meta.dream, simpleSize, simpleFont, true), simpleSize, simpleSize, gapX, gapY));
  }
  return tiles;
}

function gem(rt, size, fontSize) {
  const t = tier(rt);
  return el(
    {
      width: size, height: size, borderRadius: size * 0.18,
      alignItems: "center", justifyContent: "center",
      background: t.bg, color: t.fg,
      fontSize, fontWeight: 900,
      boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
    },
    String(rt)
  );
}

/* Saira Condensed has no ★ glyph and satori's dynamic font fallback needs a
   runtime Google Fonts fetch — an inline SVG star avoids both. */
const starSvg = (size, color) => ({
  type: "svg",
  props: {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    children: [{
      type: "path",
      props: { d: "M12 2l2.9 6.26 6.6 1.01-4.75 4.28L18.18 20 12 16.6 5.82 20l1.43-6.45L2.5 9.27l6.6-1.01L12 2z", fill: color },
    }],
  },
});

function brandChip(record, fontSize, pad) {
  return el(
    {
      background: "#E8465A", color: "#fff",
      padding: `${pad * 0.4}px ${pad}px`,
      fontSize, fontWeight: 900, letterSpacing: 2,
      transform: "skewX(-8deg)", borderRadius: 6,
    },
    record
  );
}

function landscape(meta, host, copy) {
  const record = `${meta.w}–${meta.l}`;
  const isDaily = meta.mode === "daily";
  const brandLabel = isDaily && meta.n ? `DAILY #${meta.n}` : "PERFECT SWEEP";
  const rightLabel = isDaily ? "DAILY CHALLENGE" : "WORLD CUP GAUNTLET";
  const scoreLine =
    meta.result === "sweep" && meta.score != null ? `+${meta.score} MARGIN SCORE` :
    meta.result === "sweep" && meta.dream > 0 ? "DREAM TEAM BEATEN" :
    isDaily && meta.efficiency != null ? `EFF ${meta.efficiency}` :
    copy.category === "challenge" ? "CAN YOU TOP IT?" :
    copy.category === "champs" ? "CAN YOU GO UNDEFEATED?" : null;

  // Fixed canvas: space-between distributes leftover height BETWEEN bands
  // so air sits between groups, not in a dead stack at the bottom.
  return el(
    {
      width: "100%", height: "100%", flexDirection: "column",
      background: "linear-gradient(180deg,#10141d 0%,#0b0e15 55%,#080a10 100%)",
      color: "#EAF0F7", fontFamily: "Saira Condensed",
      padding: "48px 72px 44px", justifyContent: "space-between",
    },
    [
      el({ alignItems: "center", justifyContent: "space-between", width: "100%" }, [
        el({ alignItems: "center", gap: 22 }, [
          brandChip(record, 30, 22),
          el({ fontSize: 24, fontWeight: 700, letterSpacing: 4, color: "#7e8aa0" }, brandLabel),
        ]),
        el({ fontSize: 20, fontWeight: 700, letterSpacing: 4, color: "#7e8aa0" }, rightLabel),
      ]),

      // Result band: headline + score stay related; tiles sit a full step below
      el({ flexDirection: "column", gap: 36 }, [
        el({ flexDirection: "column", gap: 16 }, [
          el({ fontSize: 68, fontWeight: 900, letterSpacing: 2, color: copy.color, lineHeight: 1 },
            `${copy.imageHeadline} ${record}`),
          ...(scoreLine
            ? [el({ fontSize: 26, fontWeight: 700, letterSpacing: 3, color: "#f2d27c" }, scoreLine)]
            : []),
        ]),
        el({
          flexWrap: "wrap", marginRight: -16,
        }, marginTiles(meta, {
          cardW: 88, cardH: 96, gapX: 16, gapY: 12, compact: true,
          stageFont: 11, scoreFont: 14, marginFont: 18,
          simpleSize: 56, simpleFont: 24,
        })),
      ]),

      el({ justifyContent: "space-between", width: "100%", paddingTop: 4, paddingBottom: 4 },
        (meta.players || []).map((p) =>
          el({ flexDirection: "column", alignItems: "center", gap: 14, width: 196 }, [
            el({ fontSize: 18, fontWeight: 700, letterSpacing: 3, color: "#7e8aa0" }, p.pos),
            gem(p.rt, 56, 25),
            el({ flexDirection: "column", alignItems: "center", gap: 6 }, [
              el({
                fontSize: 22, fontWeight: 700, maxWidth: 186,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }, p.name),
              el({ fontSize: 16, fontWeight: 700, color: "#7e8aa0", letterSpacing: 1 }, p.t || ""),
            ]),
          ])
        )
      ),

      el({ justifyContent: "space-between", width: "100%", alignItems: "center" }, [
        el({ fontSize: 22, fontWeight: 900, letterSpacing: 2, color: "#E8465A" }, `TEAM OVR ${meta.ovr}`),
        el({ fontSize: 20, fontWeight: 700, letterSpacing: 2, color: "#7e8aa0" }, `PLAY AT ${host.toUpperCase()}`),
      ]),
    ]
  );
}

function story(meta, host, copy) {
  const record = `${meta.w}–${meta.l}`;
  const isDaily = meta.mode === "daily";
  const subLabel = isDaily && meta.n
    ? `DAILY CHALLENGE #${meta.n}`
    : "PERFECT SWEEP · WORLD CUP GAUNTLET";
  const scoreLine =
    meta.result === "sweep" && meta.score != null ? `+${meta.score} MARGIN SCORE` :
    meta.result === "sweep" && meta.dream > 0 ? "DREAM TEAM BEATEN" :
    isDaily && meta.efficiency != null ? `EFF ${meta.efficiency}` :
    copy.category === "challenge" ? "CAN YOU TOP IT?" :
    copy.category === "champs" ? "CAN YOU GO UNDEFEATED?" : null;

  return el(
    {
      width: "100%", height: "100%", flexDirection: "column",
      background: "linear-gradient(180deg,#10141d 0%,#0b0e15 55%,#080a10 100%)",
      color: "#EAF0F7", fontFamily: "Saira Condensed",
      // Room for IG chrome; space-between spreads leftover height between bands.
      padding: "160px 88px 180px", alignItems: "center",
      justifyContent: "space-between",
    },
    [
      el({ flexDirection: "column", alignItems: "center", gap: 22 }, [
        brandChip(record, 40, 30),
        el({ fontSize: 28, fontWeight: 700, letterSpacing: 6, color: "#7e8aa0" }, subLabel),
      ]),

      el({ flexDirection: "column", alignItems: "center", gap: 52 }, [
        el({ flexDirection: "column", alignItems: "center", gap: 20 }, [
          el({
            fontSize: 80, fontWeight: 900, letterSpacing: 2, color: copy.color,
            lineHeight: 1, textAlign: "center", maxWidth: 860,
          }, copy.imageHeadline),
          ...(scoreLine
            ? [el({ fontSize: 34, fontWeight: 700, letterSpacing: 4, color: "#f2d27c" }, scoreLine)]
            : []),
        ]),
        el({
          flexWrap: "wrap", justifyContent: "center",
          width: (118 + 22) * 5,
          marginRight: -22, marginBottom: -22,
        }, marginTiles(meta, {
          cardW: 118, cardH: 132, gapX: 22, gapY: 22, compact: false,
          stageFont: 14, scoreFont: 18, marginFont: 28,
          simpleSize: 100, simpleFont: 36,
        })),
      ]),

      el({ flexDirection: "column", gap: 52, width: "100%" },
        (meta.players || []).map((p) =>
          el({ alignItems: "center", gap: 36, width: "100%" }, [
            el({ fontSize: 28, fontWeight: 700, letterSpacing: 3, color: "#7e8aa0", width: 64 }, p.pos),
            gem(p.rt, 76, 34),
            el({ flexDirection: "column", flexGrow: 1, gap: 10 }, [
              el({
                fontSize: 38, fontWeight: 700, maxWidth: 620, lineHeight: 1,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }, p.name),
              el({ fontSize: 24, fontWeight: 700, color: "#7e8aa0", letterSpacing: 1, lineHeight: 1 }, p.t || ""),
            ]),
          ])
        )
      ),

      el({ flexDirection: "column", alignItems: "center", gap: 26 }, [
        el({ fontSize: 34, fontWeight: 900, letterSpacing: 2, color: "#E8465A" }, `TEAM OVR ${meta.ovr}`),
        el({
          fontSize: 28, fontWeight: 700, letterSpacing: 3, color: "#EAF0F7",
          background: "#1a2130", border: "2px solid #2a3448",
          padding: "20px 48px", borderRadius: 16,
        }, `PLAY AT ${host.toUpperCase()}`),
      ]),
    ]
  );
}

export default async function handler(req) {
  const url = new URL(req.url);
  const id = String(url.searchParams.get("id") || "").trim();
  const isStory = url.searchParams.get("format") === "story";
  // Always brand the card with the production domain — never preview/localhost hosts.
  const host = "perfectsweep.app";

  let run = null;
  if (ID_RE.test(id)) {
    try {
      run = await kv.get(`run:${id}`);
    } catch (err) {
      console.error("og kv error", err);
    }
  }
  if (!run || !run.meta) {
    return Response.redirect(new URL("/og.png", url.origin), 302);
  }

  const [bold, black] = await Promise.all([boldFont, blackFont]);
  const meta = run.meta;
  const copy = shareCopy(meta, id);

  return new ImageResponse(isStory ? story(meta, host, copy) : landscape(meta, host, copy), {
    width: isStory ? 1080 : 1200,
    height: isStory ? 1920 : 630,
    fonts: [
      { name: "Saira Condensed", data: bold, weight: 700, style: "normal" },
      { name: "Saira Condensed", data: black, weight: 900, style: "normal" },
    ],
    headers: {
      // id is a content hash — the image for a given id never changes.
      "Cache-Control": "public, s-maxage=31536000, max-age=86400, immutable",
    },
  });
}
