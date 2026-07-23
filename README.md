# Perfect Sweep · World Cup Edition

Roll national squads, draft your dream five, and chase the perfect FIBA World Cup sweep — win the Cup without losing a single game.

A single-page basketball drafting game built with React and Vite. Each run, you roll a random draw of legendary national-team squads across history, pick one player per slot (PG / SG / SF / PF / C) to build a five-man lineup, choose a playstyle, and simulate your way through an 8-game bracket (group stage → 2nd round → quarterfinal → semifinal → final). Win the Final to become World Champions; go undefeated (8–0) for the Perfect Sweep and unlock a bonus game against the 1992 Dream Team.

## Features

- Draft-based lineup building from real historical national squads, each player rated and some carrying gameplay traits (hot streaks, injuries, playoff fades, etc.)
- Three playstyles (Run & Gun, Balanced, Lockdown) trading off pace, offense, and defense
- Simulated box scores, quarter-by-quarter play, and overtime resolution
- Shareable run results encoded into a URL, so a completed run can be sent and replayed/viewed by others
- Bonus "Face the Dream Team" round after a perfect sweep

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

## Tech stack

- [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/) (via `@tailwindcss/vite`)
- [Vercel Analytics](https://vercel.com/analytics)

## Deployment

The app is a static Vite build deployed on [Vercel](https://vercel.com/).

## Project structure

- `perfect-sweep.jsx` — game data (squads, players, traits) and all game logic/UI
- `main.jsx` — React entry point
- `index.html` — page shell, meta/OG tags, favicons
- `public/` — static assets (favicons, social share image)
