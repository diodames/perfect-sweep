# Perfect Sweep · World Cup Edition

Roll national squads, draft your dream five, and chase the perfect FIBA World Cup sweep — win the Cup without losing a single game.

A single-page basketball drafting game built with React and Vite. Each run, you roll a random draw of legendary national-team squads across history, pick one player per slot (PG / SG / SF / PF / C) to build a five-man lineup, choose a playstyle, and simulate your way through an 8-game bracket (group stage → 2nd round → quarterfinal → semifinal → final). Win the Final to become World Champions; go undefeated (8–0) for the Perfect Sweep and unlock a bonus game against the 1992 Dream Team. Beat the Dream Team and you can submit a nickname + country to the global leaderboard, ranked by total margin.

## Features

- Draft-based lineup building from real historical national squads, each player rated and some carrying gameplay traits (hot streaks, injuries, playoff fades, etc.)
- Three playstyles (Run & Gun, Balanced, Lockdown) trading off pace, offense, and defense
- Simulated box scores, quarter-by-quarter play, and overtime resolution
- Shareable run results encoded into a URL, so a completed run can be sent and replayed/viewed by others
- Bonus "Face the Dream Team" round after a perfect sweep
- Global Dream Team leaderboard (Perfect Sweep + Dream Team win), scored by sum of tournament margins + Dream Team margin

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL in your browser.

### Other scripts

```bash
npm run build     # production build to dist/
npm run preview   # preview the production build locally
```

Local Vite (`npm run dev`) serves the SPA only. To exercise `/api/leaderboard` locally, use [Vercel CLI](https://vercel.com/docs/cli) (`vercel dev`) with the KV env vars below.

## Tech stack

- [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/) (via `@tailwindcss/vite`)
- [Vercel Analytics](https://vercel.com/analytics)
- [Vercel Serverless](https://vercel.com/docs/functions) + Redis/KV (`@vercel/kv`) for the leaderboard

## Deployment

The app is a Vite build deployed on [Vercel](https://vercel.com/). The `/api` folder is served as serverless functions alongside the static site.

### Leaderboard storage (Vercel KV / Redis)

The Dream Team leaderboard needs a Redis-compatible store linked to the Vercel project:

1. In the Vercel dashboard, open the project → **Storage** (or **Integrations**).
2. Create or connect a **Redis** store from the [Vercel Marketplace](https://vercel.com/marketplace?category=storage&search=redis) (legacy **Vercel KV** stores also work if you still have one).
3. Link it to the project so these environment variables are set for Production (and Preview if you want):
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
4. Redeploy after linking so the functions pick up the env.

Without those vars, `GET`/`POST` `/api/leaderboard` return a storage-not-configured error. The rest of the game still works.

## Project structure

- `perfect-sweep.jsx` — game data (squads, players, traits) and all game logic/UI
- `countries.js` — ISO country allowlist shared by client + API
- `api/leaderboard.js` — GET/POST leaderboard (Vercel serverless + KV)
- `main.jsx` — React entry point
- `index.html` — page shell, meta/OG tags, favicons
- `public/` — static assets (favicons, social share image)
