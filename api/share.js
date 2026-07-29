import { kv } from "@vercel/kv";

const ID_RE = /^[A-Za-z0-9_-]{4,16}$/;

const esc = (t) =>
  String(t).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

function baseUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || (String(host).startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function titleFor(meta) {
  const rec = `${meta.w}–${meta.l}`;
  switch (meta.result) {
    case "sweep": {
      const score = meta.score != null ? ` (+${meta.score})` : "";
      return meta.dream != null && meta.dream > 0
        ? `PERFECT SWEEP ✅ ${rec} — DREAM TEAM BEATEN${score}`
        : `PERFECT SWEEP ✅ ${rec}`;
    }
    case "champs": return `WORLD CHAMPIONS 🏆 ${rec}`;
    case "group": return `OUT IN THE GROUP STAGE ❌ ${rec}`;
    case "r2": return `OUT IN THE 2ND ROUND ❌ ${rec}`;
    case "elim": return `ELIMINATED ❌ ${rec}`;
    default: return `MY WORLD CUP RUN — ${rec}`;
  }
}

function descriptionFor(meta) {
  const five = (meta.players || [])
    .map((p) => `${p.pos} ${p.name}${p.t ? ` (${p.t})` : ""}`)
    .join(" · ");
  const ovr = meta.ovr ? ` — OVR ${meta.ovr}` : "";
  return `${five}${ovr}. Draft your dream national five and chase the Perfect Sweep: win the World Cup without losing a single game.`;
}

export default async function handler(req, res) {
  const base = baseUrl(req);
  const id = String(req.query?.id || "").trim();

  let run = null;
  if (ID_RE.test(id)) {
    try {
      run = await kv.get(`run:${id}`);
    } catch (err) {
      console.error("share kv error", err);
    }
  }

  if (!run || !run.meta) {
    res.setHeader("Cache-Control", "public, s-maxage=60");
    res.writeHead(302, { Location: `${base}/` });
    return res.end();
  }

  const meta = run.meta;
  const title = titleFor(meta);
  const description = descriptionFor(meta);
  const appUrl = `${base}/?r=${id}`;
  const pageUrl = `${base}/r/${id}`;
  const imageUrl = `${base}/api/og?id=${id}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} · Perfect Sweep</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(pageUrl)}" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Perfect Sweep" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(pageUrl)}" />
<meta property="og:image" content="${esc(imageUrl)}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(imageUrl)}" />
<meta http-equiv="refresh" content="0;url=${esc(appUrl)}" />
</head>
<body style="margin:0;background:#0b0e15;color:#EAF0F7;font-family:sans-serif;">
<script>window.location.replace(${JSON.stringify(appUrl)});</script>
<p style="padding:2rem;text-align:center;">
  Loading the run… <a href="${esc(appUrl)}" style="color:#ff8b98;">Open Perfect Sweep</a>
</p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  return res.status(200).send(html);
}
