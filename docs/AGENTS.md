# Agent context: Capital Quiz

Context for AI agents working in this repo. Read this before making changes.

## What this is

A small browser game. The user is shown a red dot on a 3D globe and has to type the name of the capital city it represents. 3 questions per day, 30s each, one play per day per browser. Daily quiz is deterministic — every player gets the same questions on the same date.

## Stack

- **Build:** Vite + TypeScript (no framework, plain DOM).
- **Globe:** [`globe.gl`](https://github.com/vasturiano/globe.gl) (Three.js wrapper) for the 3D globe and dot/polygon rendering.
- **Fuzzy matching:** `fastest-levenshtein` for tolerating typos and accents in user input.
- **Persistence:** a cookie records today's play so the user can't replay.
- **No backend.** All data ships as static JSON in `public/data/`.

Entry HTML is `index.html`; entry script is `src/main.ts`.

## Layout

```
index.html              # Shell with all four screens (start/game/end/done) as sibling divs
style.css               # Styling for screens, globe container, timer bar, feedback overlay
src/
  main.ts               # Game loop, screen transitions, timer, scoring, share text
  globe.ts              # initGlobe / highlightCapital / revealCountry / clearCountry / resetDots
  match.ts              # isCorrect(input, expected) — Levenshtein-based fuzzy match
  seed.ts               # todayISO() and seededShuffle() — deterministic daily quiz
  cookie.ts             # hasPlayedToday / getPlayRecord / saveResult / clearPlayRecord
  types.ts              # Capital, GeoJSON type definitions
public/data/
  capitals.json         # [{ city, country, lat, lng, ... }] — the answer set
  countries.geojson     # Country polygons used to flash the country after each answer
```

## Key behaviors and invariants

- **Daily determinism.** `seed.ts` shuffles the capital list using `todayISO()` as a seed and slices the first N. Don't replace this with `Math.random()` or the "same quiz for everyone today" property breaks.
- **One play per day.** Enforced client-side via a cookie (`cookie.ts`). The `?reset` query param clears it — keep this for local testing.
- **Screens are sibling divs** in `index.html`, toggled via an `.active` class by `show(id)` in `main.ts`. There is no router.
- **The globe persists across questions.** `initGlobe` is called once per game; subsequent questions just call `resetDots` + `highlightCapital` + later `revealCountry`. Don't tear down and recreate the globe per question.
- **Fuzzy matching is intentional.** `isCorrect` accepts minor typos and missing accents. If you tighten it, double-check that common alternate spellings (Kyiv/Kiev, etc.) still pass.
- **`TIMER_SECS` in `main.ts`** is the per-question time budget. The constant currently reads `300` but the user-facing copy says 30 — if you touch one, check the other.

## Data files

- `public/data/capitals.json` — source of truth for what's askable. Each entry needs at least `city`, `country`, `lat`, `lng`. The `country` field must match a `name`/`ADMIN` property in `countries.geojson` for the post-answer country highlight to work.
- `public/data/countries.geojson` — standard country polygons. Large file; don't reformat or re-pretty-print it casually (diff noise).

If you add a capital, verify the country name matches an entry in the GeoJSON, otherwise the reveal animation will silently no-op.

## Running

```
npm run dev      # Vite dev server with HMR
npm run build    # tsc + vite build → dist/
npm run preview  # serve the built dist/
```

There is no test suite. If you change `match.ts` or `seed.ts`, exercise the change manually in the browser — those are the two modules where regressions are easiest to miss.
