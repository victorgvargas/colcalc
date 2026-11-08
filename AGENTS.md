# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ColCalc — a cost-of-living / income-tax / purchasing-power calculator SPA (Vite + React 19 + TypeScript + React Router 7). No backend lives in this repo; it talks to a separate ColCalc backend for auth and record sync (see Backend/auth below).

## Commands

```bash
npm install --legacy-peer-deps   # plain `npm install` fails on peer deps; never let it touch yarn.lock
npm run dev                      # vite dev server
npm run build                    # build-seo.mjs -> tsc -b -> vite build -> build-prerender.mjs
npm run lint
npm test                         # vitest run (single run)
npm run test:watch               # vitest watch
npm run test:e2e                 # playwright (auto-starts dev server on :5173)
npm run test:e2e:ui
```

Single test file: `npx vitest run src/components/Calculator/logic.test.ts`
Single e2e spec: `npx playwright test tests-e2e/calculator.spec.ts`

Node gotcha: the default nvm Node here (v22.2.0) is too old for Vite 7 and breaks vitest/jsdom (`ERR_REQUIRE_ESM`). Prepend a newer install before running anything:
```bash
export PATH="$HOME/.nvm/versions/node/v22.19.0/bin:$PATH"
```

The assistant FAB always renders; whether it works depends on the backend answering `GET /api/assistant/status`. No API key belongs in this repo or its build (`VITE_GEMINI_API_KEY` is gone — see `docs/assistant-proxy.md`). For local runs/e2e, stub `/api/assistant*`. Use the `verify` skill for the full drive-in-a-browser workflow.

Known flakiness: the full `npx vitest run` suite has pre-existing load-related timeouts in `Calculator.test.tsx` (passes in isolation) — don't attribute those to your change without checking the clean tree.

## Architecture

**Routing** (`src/main.tsx`): a single `createBrowserRouter` tree, all routes nested under `Layout`. Pages: `/` and `/calculator` (Calculator), `/cities-comparison`, `/purchasing-power`, `/tax-calculator`, `/cost-of-living/:citySlug` (CityPage), `/compare/:pairSlug` (ComparisonPage), `/auth/callback`.

**Layout** (`src/components/Layout`): renders `SEO`, `Sidebar`, an `Outlet` for the page, and the `Assistant` FAB — present on every route.

**Data sources — all client-side fetches, no server-side data layer for cost data:**
- `src/api/costOfLiving.ts` fetches the bundled static dataset `public/cost-of-living.json` (a lazily-memoized singleton promise) and turns raw per-item prices into monthly totals via `computeMonthlyCostsFromPrices` — a heuristic categorizer (rent center/outskirts split, transport/childcare median-with-cap, markets basket multiplier, exclude one-off/per-unit items). **This same logic is duplicated** in `src/components/Calculator/logic.ts` with an added `lifestyle` (frugal/average/comfortable) dimension that scales the markets/transport multipliers — when tuning the cost heuristics, check whether both copies need the change.
- `src/api/exchangeRates.ts` fetches live USD rates from a public CDN (`@fawazahmed0/currency-api`) as a memoized singleton; static fallback rates live in `CURRENCIES` in `Calculator/logic.ts` in case live rates are unavailable for a code.
- `src/api/taxRates.ts` calls the public `rel.tax` API (no auth, ~55 countries, ISO 3166-1 alpha-2 lowercase codes) for income tax estimates. `countryNameToCode` bridges the cost-of-living dataset's country names to rel.tax codes via an alias table.
- `src/api/assistant.ts` is a thin client for the backend's assistant proxy (`POST /api/assistant`, `GET /api/assistant/status`). The Gemini key, the model pin and the site-wide rate limit live server-side; the browser holds no credentials. `AssistantBusyError` (429, shared free-tier quota) and `AssistantUnavailableError` (503, no key configured) drive dedicated UI states. `docs/assistant-proxy.md` is the contract.

**Backend/auth** (`src/api/backend.ts`, `src/auth/AuthContext.tsx`): a thin fetch wrapper (`ApiError`, magic-link auth, record sync) against `VITE_API_BASE_URL` (defaults to same-origin `/api`; in prod, `vercel.json` rewrites `/api/*` to a separate `colcalc-be.vercel.app` deployment — that backend is not part of this repo). `useAuth()` degrades to a permanent no-op/anonymous value when no `<AuthProvider>` is mounted, so components can be tested in isolation without wiring auth.

**Calculator records & sync** — three-layer state for the calculator's saved-record history, all under `src/components/Calculator/`:
- `useCalculationRecords.ts` is the single source of truth: holds `records` + per-id `updatedAt` meta + tombstones for deletes, all mirrored to localStorage (`colcalc_records`, `colcalc_records_meta`, `colcalc_records_tombstones`), and listens for cross-tab `storage` events.
- `useRecordsSync.ts` drives two-way last-write-wins sync with the backend whenever authenticated (full push on login, debounced push on local changes, retry on `online`). Sync failures are swallowed to a console warning — the app is offline-first, so unsynced state just stays on disk.
- `logic.ts` holds the pure functions: cost heuristics (above), currency metadata/conversion, localStorage (de)serialization, share-URL query param encode/decode, import/export with a versioned envelope.

**Assistant** (`src/components/Assistant`, `src/assistant/appActions.ts`): a Gemini function-calling chat loop (max 6 tool-call turns per user message) with declared tools in `TOOL_DECLARATIONS` and their implementations in `runTool`. Tools read/write the *same* `colcalc_records` localStorage key as the Calculator directly (not through the `useCalculationRecords` hook — see `readRecords`/`writeRecords` in `appActions.ts`), and dispatch a synthetic `StorageEvent` after writes so the Calculator's storage listener picks up the change without a page reload. Chat sessions persist separately in localStorage under `colcalc_assistant_chats` (`useChatSessions.ts`).

**SEO / prerendering** (`scripts/build-seo.mjs`, `scripts/build-prerender.mjs`, both run as part of `npm run build`):
- `build-seo.mjs` reads `public/cost-of-living.json` and generates `public/sitemap.xml` plus `src/data/topCities.json` (curated popular cities/comparison pairs, resolved against the real dataset so nothing links to a missing page). This is a *build input* — it must run before `vite build` since the Calculator imports `topCities.json`.
- `build-prerender.mjs` runs after `vite build` and writes a per-route copy of `dist/index.html` with patched `<head>` tags (title/description/canonical/OG/JSON-LD) for the core routes plus the curated top cities/pairs, so crawlers without JS get correct metadata. The `<body>` stays empty; React hydrates client-side as normal. Set `VITE_SITE_URL` when building for prod so canonicals/sitemap match the real domain.

## Deployment

Dual target: `Dockerfile` + `nginx.conf` + `fly.toml` for Fly.io (SPA fallback to `index.html`, long-cache static assets), and `vercel.json` for Vercel (rewrites `/api/*` to the separate backend deployment). Both consume the same `npm run build` output.
