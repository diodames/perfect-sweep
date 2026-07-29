import { ImageResponse } from "@vercel/og";
import { kv } from "@vercel/kv";

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

const THEME = {
  sweep:  { headline: "PERFECT SWEEP", color: "#6fe3a1" },
  champs: { headline: "WORLD CHAMPIONS", color: "#f2d27c" },
  group:  { headline: "OUT IN THE GROUP STAGE", color: "#ff8b98" },
  r2:     { headline: "OUT IN THE 2ND ROUND", color: "#ff8b98" },
  elim:   { headline: "ELIMINATED", color: "#ff8b98" },
  run:    { headline: "WORLD CUP RUN", color: "#EAF0F7" },
};

const WIN_TILE  = { background: "#12301f", border: "2px solid #2c5c40", color: "#6fe3a1" };
const LOSS_TILE = { background: "#331519", border: "2px solid #5c2c34", color: "#ff8b98" };
const STAR_TILE = { background: "#332a0f", border: "2px solid #5c4d1d", color: "#f2d27c" };

function marginTiles(meta, size, fontSize, gapX = 0, gapY = gapX) {
  // Pad wrapper around each tile — more reliable in Satori than flex gap/margin.
  const wrap = (child) => el(
    {
      width: size + gapX, height: size + gapY,
      alignItems: "flex-start", justifyContent: "flex-start",
      paddingRight: gapX, paddingBottom: gapY,
    },
    [child]
  );
  const tileStyle = {
    width: size, height: size, borderRadius: Math.round(size * 0.16),
    alignItems: "center", justifyContent: "center",
    fontSize, fontWeight: 900,
  };
  const tiles = (meta.margins || []).map((m) => {
    const win = m > 0;
    return wrap(el({ ...tileStyle, ...(win ? WIN_TILE : LOSS_TILE) }, `${win ? "+" : ""}${m}`));
  });
  if (meta.dream != null) {
    tiles.push(wrap(el(
      {
        ...tileStyle,
        flexDirection: "column",
        ...(meta.dream > 0 ? STAR_TILE : LOSS_TILE),
      },
      [
        starSvg(fontSize * 0.7, meta.dream > 0 ? "#f2d27c" : "#ff8b98"),
        el({ fontSize: fontSize * 0.62, lineHeight: 1.1 }, `${meta.dream > 0 ? "+" : ""}${meta.dream}`),
      ]
    )));
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

function landscape(meta, host) {
  const t = THEME[meta.result] || THEME.run;
  const record = `${meta.w}–${meta.l}`;
  const scoreLine =
    meta.result === "sweep" && meta.score != null ? `+${meta.score} MARGIN SCORE` :
    meta.result === "sweep" && meta.dream > 0 ? "DREAM TEAM BEATEN" : null;

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
          el({ fontSize: 24, fontWeight: 700, letterSpacing: 4, color: "#7e8aa0" }, "PERFECT SWEEP"),
        ]),
        el({ fontSize: 20, fontWeight: 700, letterSpacing: 4, color: "#7e8aa0" }, "WORLD CUP GAUNTLET"),
      ]),

      // Result band: headline + score stay related; tiles sit a full step below
      el({ flexDirection: "column", gap: 36 }, [
        el({ flexDirection: "column", gap: 16 }, [
          el({ fontSize: 68, fontWeight: 900, letterSpacing: 2, color: t.color, lineHeight: 1 },
            `${t.headline} ${record}`),
          ...(scoreLine
            ? [el({ fontSize: 26, fontWeight: 700, letterSpacing: 3, color: "#f2d27c" }, scoreLine)]
            : []),
        ]),
        // Compensate trailing pad so the row doesn't look right-heavy
        el({ marginRight: -20 }, marginTiles(meta, 56, 24, 20, 0)),
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

function story(meta, host) {
  const t = THEME[meta.result] || THEME.run;
  const record = `${meta.w}–${meta.l}`;
  const scoreLine =
    meta.result === "sweep" && meta.score != null ? `+${meta.score} MARGIN SCORE` :
    meta.result === "sweep" && meta.dream > 0 ? "DREAM TEAM BEATEN" : null;

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
        el({ fontSize: 28, fontWeight: 700, letterSpacing: 6, color: "#7e8aa0" }, "PERFECT SWEEP · WORLD CUP GAUNTLET"),
      ]),

      el({ flexDirection: "column", alignItems: "center", gap: 52 }, [
        el({ flexDirection: "column", alignItems: "center", gap: 20 }, [
          el({
            fontSize: 80, fontWeight: 900, letterSpacing: 2, color: t.color,
            lineHeight: 1, textAlign: "center", maxWidth: 860,
          }, t.headline),
          ...(scoreLine
            ? [el({ fontSize: 34, fontWeight: 700, letterSpacing: 4, color: "#f2d27c" }, scoreLine)]
            : []),
        ]),
        // Cap width so exactly 5 tiles fit per row (size+gap)*5
        el({
          flexWrap: "wrap", justifyContent: "center",
          width: (100 + 22) * 5,
          marginRight: -22, marginBottom: -22,
        }, marginTiles(meta, 100, 36, 22)),
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

  return new ImageResponse(isStory ? story(meta, host) : landscape(meta, host), {
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
