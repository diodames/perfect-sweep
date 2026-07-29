import React, { useEffect, useMemo, useState } from "react";

const SECRET_KEY = "ps_admin_secret";
const RANGES = [7, 30];

function pct(rate) {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function num(n) {
  return Number.isFinite(n) ? String(n) : "0";
}

function readInitialSecret() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("secret");
    if (fromUrl) {
      sessionStorage.setItem(SECRET_KEY, fromUrl);
      // Strip secret from the address bar after capture.
      const url = new URL(window.location.href);
      url.searchParams.delete("secret");
      window.history.replaceState(null, "", url.pathname + (url.search || ""));
      return fromUrl;
    }
    return sessionStorage.getItem(SECRET_KEY) || "";
  } catch {
    return "";
  }
}

function TrendChart({ daily }) {
  const w = 720;
  const h = 220;
  const pad = { t: 16, r: 16, b: 28, l: 36 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const series = useMemo(() => {
    const runs = daily.map((d) => d.run_completed || 0);
    const shares = daily.map((d) => d.share_clicked || 0);
    const maxY = Math.max(1, ...runs, ...shares);
    return { runs, shares, maxY, n: daily.length };
  }, [daily]);

  const xAt = (i) => {
    if (series.n <= 1) return pad.l + innerW / 2;
    return pad.l + (i / (series.n - 1)) * innerW;
  };
  const yAt = (v) => pad.t + innerH - (v / series.maxY) * innerH;

  const pathFor = (values) => values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(" ");

  const ticks = [0, Math.round(series.maxY / 2), series.maxY];
  const labelEvery = series.n > 14 ? 5 : series.n > 7 ? 2 : 1;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Runs and shares over time">
      <rect x="0" y="0" width={w} height={h} fill="#111622" rx="8" />
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={pad.l} y1={yAt(t)} x2={w - pad.r} y2={yAt(t)}
            stroke="#232b3d" strokeWidth="1"
          />
          <text x={pad.l - 8} y={yAt(t) + 4} fill="#5f6b7d" fontSize="10" textAnchor="end">{t}</text>
        </g>
      ))}
      <path d={pathFor(series.runs)} fill="none" stroke="#ff8b98" strokeWidth="2" />
      <path d={pathFor(series.shares)} fill="none" stroke="#6fe3a1" strokeWidth="2" />
      {daily.map((d, i) => (
        labelEvery > 1 && i % labelEvery !== 0 && i !== daily.length - 1 ? null : (
          <text
            key={d.date}
            x={xAt(i)}
            y={h - 8}
            fill="#5f6b7d"
            fontSize="9"
            textAnchor="middle"
          >
            {d.date.slice(5)}
          </text>
        )
      ))}
      <g transform={`translate(${pad.l}, ${pad.t})`}>
        <rect x="0" y="0" width="10" height="3" fill="#ff8b98" />
        <text x="14" y="4" fill="#93a1b5" fontSize="10">run_completed</text>
        <rect x="110" y="0" width="10" height="3" fill="#6fe3a1" />
        <text x="124" y="4" fill="#93a1b5" fontSize="10">share_clicked</text>
      </g>
    </svg>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="panel p-4" style={{ minWidth: 0 }}>
      <div className="eyebrow mb-1" style={{ fontSize: 10 }}>{label}</div>
      <div className="dsp9 text-2xl sm:text-3xl" style={{ color: "#EAF0F7" }}>{value}</div>
      {sub ? <div className="text-xs mt-1" style={{ color: "#5f6b7d" }}>{sub}</div> : null}
    </div>
  );
}

export default function AdminMetrics() {
  const [secret, setSecret] = useState(() => readInitialSecret());
  const [draft, setDraft] = useState("");
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(secret ? "Loading…" : "Enter admin secret");
  const [error, setError] = useState(null);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = "Metrics · Perfect Sweep";
    return () => {
      meta.remove();
      document.title = prevTitle;
    };
  }, []);

  useEffect(() => {
    if (!secret) return undefined;
    let cancelled = false;
    setStatus("Loading…");
    setError(null);
    fetch(`/api/admin/metrics?days=${days}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setData(body);
        setStatus(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setError(err.message || "Failed to load");
        setStatus(null);
      });
    return () => { cancelled = true; };
  }, [secret, days]);

  const unlock = (e) => {
    e.preventDefault();
    const s = draft.trim();
    if (!s) return;
    try { sessionStorage.setItem(SECRET_KEY, s); } catch { /* ignore */ }
    setSecret(s);
  };

  if (!secret) {
    return (
      <div className="min-h-screen px-4 py-16" style={{ background: "#0b0e15", color: "#EAF0F7" }}>
        <div className="max-w-md mx-auto panel p-6">
          <div className="eyebrow mb-2">INTERNAL</div>
          <h1 className="dsp9 text-2xl mb-4">Metrics</h1>
          <form onSubmit={unlock} className="flex flex-col gap-3">
            <input
              type="password"
              autoComplete="current-password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Admin secret"
              className="w-full px-3 py-2 text-sm"
              style={{ background: "#111622", border: "1px solid #232b3d", color: "#EAF0F7" }}
            />
            <button type="submit" className="btnP skew dsp9 px-4 py-2">
              <span className="unskew">Open</span>
            </button>
          </form>
          <p className="text-xs mt-4" style={{ color: "#5f6b7d" }}>
            Or open <code>/admin/metrics?secret=…</code> once — secret stays in session only.
          </p>
        </div>
      </div>
    );
  }

  const t = data?.totals;
  const d = data?.derived;

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: "#0b0e15", color: "#EAF0F7" }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <div className="eyebrow mb-1">INTERNAL · NOINDEX</div>
            <h1 className="dsp9 text-3xl">Metrics</h1>
            {data?.range ? (
              <p className="text-sm mt-1" style={{ color: "#93a1b5" }}>
                {data.range.from} → {data.range.to} UTC
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            {RANGES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDays(n)}
                className={`skew chip dsp px-4 py-2 text-sm ${days === n ? "btnP" : "btnG"}`}
              >
                <span className="unskew">{n}d</span>
              </button>
            ))}
          </div>
        </div>

        {status ? <p className="text-sm mb-4" style={{ color: "#93a1b5" }}>{status}</p> : null}
        {error ? <p className="text-sm mb-4" style={{ color: "#ff8b98" }}>{error}</p> : null}

        {data && t ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              <StatCard label="Share rate" value={pct(d.shareRate)} sub={`${num(t.share_clicked)} / ${num(t.run_completed)}`} />
              <StatCard label="Result CTR" value={pct(d.resultCTR)} sub={`${num(t.shared_result_opened)} / ${num(t.shared_result_viewed)}`} />
              <StatCard
                label="Runs by result"
                value={`${num(t.run_completed_sweep)} / ${num(t.run_completed_champion)} / ${num(t.run_completed_eliminated)}`}
                sub="sweep / champion / eliminated"
              />
              <StatCard label="Came from share" value={num(t.came_from_share)} sub="sessions via ?r=" />
              <StatCard label="Runs total" value={num(t.run_completed)} sub={`${num(t.share_clicked)} shares`} />
            </div>

            <div className="panel p-4 mb-6">
              <div className="eyebrow mb-3">TREND</div>
              <TrendChart daily={data.daily || []} />
            </div>

            <div className="panel p-4 overflow-x-auto">
              <div className="eyebrow mb-3">DAILY</div>
              <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr style={{ color: "#5f6b7d", textAlign: "left" }}>
                    {["Date", "Runs", "Sweep", "Champ", "Elim", "Shares", "Viewed", "Opened", "Came", "Share%", "CTR%"].map((h) => (
                      <th key={h} className="py-2 pr-3 font-normal" style={{ borderBottom: "1px solid #232b3d" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...(data.daily || [])].reverse().map((row) => (
                    <tr key={row.date} style={{ color: "#EAF0F7" }}>
                      <td className="py-2 pr-3" style={{ borderBottom: "1px solid #1c2333" }}>{row.date}</td>
                      <td className="py-2 pr-3" style={{ borderBottom: "1px solid #1c2333" }}>{row.run_completed}</td>
                      <td className="py-2 pr-3" style={{ borderBottom: "1px solid #1c2333" }}>{row.run_completed_sweep}</td>
                      <td className="py-2 pr-3" style={{ borderBottom: "1px solid #1c2333" }}>{row.run_completed_champion}</td>
                      <td className="py-2 pr-3" style={{ borderBottom: "1px solid #1c2333" }}>{row.run_completed_eliminated}</td>
                      <td className="py-2 pr-3" style={{ borderBottom: "1px solid #1c2333" }}>{row.share_clicked}</td>
                      <td className="py-2 pr-3" style={{ borderBottom: "1px solid #1c2333" }}>{row.shared_result_viewed}</td>
                      <td className="py-2 pr-3" style={{ borderBottom: "1px solid #1c2333" }}>{row.shared_result_opened}</td>
                      <td className="py-2 pr-3" style={{ borderBottom: "1px solid #1c2333" }}>{row.came_from_share}</td>
                      <td className="py-2 pr-3" style={{ borderBottom: "1px solid #1c2333" }}>{pct(row.shareRate)}</td>
                      <td className="py-2 pr-3" style={{ borderBottom: "1px solid #1c2333" }}>{pct(row.resultCTR)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
