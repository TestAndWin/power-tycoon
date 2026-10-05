# Implementation Steps

Work phase by phase. Each phase ends with passing tests and a commit/PR.

## Open questions (ask Michael before the phase that needs them)

- [x] Domain / host name for the Ingress: `powertycoon.testandwin.de` (DNS in Route 53, testandwin.net
      stays at Strato)
- [x] testandwin.net/power-tycoon gets a link to the new host (no redirect), once the game is live (phase 5)

## Phase 0 – Repo setup

- [x] pnpm workspace: `packages/engine`, `apps/api`, `apps/web`; root `tsconfig.base.json` (strict)
- [x] vitest, prettier, `.gitignore` (node_modules, dist, `*.db`, `k8s/secret.yaml`), `.nvmrc` (22)
- [x] Root scripts: `dev`, `build`, `test`, `typecheck`
- [x] GitHub Actions: install, typecheck, test on push/PR
- [x] README (German or English? → English, short: what it is, how to run, how to deploy)

## Phase 1 – Engine (largest phase)

- [x] Types: `GameState`, `Site`, `Player`, `Action`, `GameEvent`, `Challenge`, `PlayerView`, `ErrorCode`
- [x] Data tables from legacy `core.js` (1:1 values)
- [x] Seeded RNG in state
- [x] `createGame`
- [x] `applyAction` for every action in API.md, incl. minigame challenge flow
- [x] `endQuarter` with the legacy order of steps, per-player contracts
- [x] `playerView` with hidden information
- [x] `RuleBasedOpponent` as port of `aiTurn`/`aiTrick`, using actions only (removed in phase 6)
- [x] Tests: each action (happy path + rule violations), determinism (same seed ⇒ same result),
      invariants (grid capacity never exceeded, cash bookkeeping), a full 40-quarter bot-vs-bot
      smoke game that ends without exceptions
- [x] Compare balance roughly with legacy (rival net worth after 10 years in the same range)

## Phase 2 – API

- [x] Fastify app, JSON schemas for all bodies (TypeBox), `/api/health`
- [x] SQLite (`better-sqlite3`, WAL), migrations via `PRAGMA user_version`
- [x] Game id + token creation, sha256 hash, timing-safe compare (ADR-003)
- [x] Per-game lock, load → engine → save in one transaction
- [x] Endpoints from API.md, error mapping
- [x] `@fastify/rate-limit`, `@fastify/static` for the web build
- [x] Cleanup of games older than 180 days
- [x] Tests with `fastify.inject` against a temp DB (auth, happy paths, errors, token of game A cannot access game B)

## Phase 3 – Web app

- [x] Vite + TS, dev proxy `/api` → API
- [x] Port CSS/markup from `legacy/src/head.html` + `fonts.css`
- [x] API client (`fetch` wrapper, token header, German error messages)
- [x] Port `ui.js` render functions to render from `PlayerView`
- [x] Port `scene.js`, `sound.js`
- [x] Port minigames, seeded from challenge; resume open challenge after reload
- [x] `texts.ts`: German texts for events, errors, report lines, news
- [x] Start dialog: new game / continue (if `gameId` in localStorage and API returns it)
- [x] Quarter report incl. animated rival actions
- [x] Play-through on desktop and phone width (Playwright bot, 40 quarters, no console/API errors)

## Phase 4 – Container

- [x] Dockerfile (multi-stage, node:24-alpine, python3/make/g++ for better-sqlite3, non-root 1001)
- [x] Container serves web + API on one port, `DATA_DIR=/data`
- [ ] `docker run` locally, play one quarter (Docker Hub was not reachable from the build sandbox; the
      `pnpm deploy` bundle the image uses was started natively and played one quarter – run once on the server)

## Phase 5 – Deployment on the eServer

- [x] `k8s/` manifests following `eat-hike-art` (see ARCHITECTURE.md → Deployment)
- [x] `deploy.sh` following `eat-hike-art/deploy.sh` (namespace/deployment name `power-tycoon`)
- [ ] DNS for `powertycoon.testandwin.de` (A record in Route 53), TLS via cert-manager – Michael
- [x] Backup cron for the SQLite file (host side), documented in README
- [ ] First deployment on the server and a played test game – Michael
- [ ] Only after the new game is live and tested: update testandwin.net (repo `testandwin-net`) to point
      to the new game and retire the old single-file version there. Until then, leave it untouched.

## Phase 6 – Stronger rule-based rivals

Quick wins before any LLM, measured with bot-vs-bot simulations over many seeds:

- [x] Evaluate sites with expected return (generation × price − costs) instead of fixed thresholds
- [x] Use PPA contracts, storage arbitrage and grid reservations deliberately
- [x] Target lobby tricks at the leader (esp. the human) when it pays off
- [x] Difficulty levels (normal/hard) as parameters of the strategy; the legacy rivals (`easy`) were removed
- [x] Simulation script: N games, report average net worth per strategy
- [x] Hard: market/grid forecast, end-of-game accounting, value-based surveys, selling dead projects,
      diversification, timed lobby tricks and revenge on the human; historic milestones spread over the game
- [x] Hard was too easy for a good human (net worth 437 M€ vs. 83–165 M€): rivals on hard get practised
      minigame odds, `simulate --skilled` models a human who wins every minigame
- [x] Hard rivals go offshore earlier (they kept 100 M€+ idle once the onshore sites were gone): the
      financing check counts the cash flow until the build, big projects are not ranked below small ones while
      the financing room covers them. Tried without gain: stricter financing of new leases (much weaker),
      higher project limits, more lobby tricks, valuing the chance of hydro in surveys
- [ ] Play-test hard again

## Phase 7 – More game fun (ideas from Oil Imperium, reLINE 1989)

Each feature goes through actions/events like everything else, the rivals use it too, and the effect on
balance is measured with the simulation script (normal/hard) before merging.

**Espionage, detectives and court (A/B/C)**
- [x] `spy` action on a rival: costs money, produces a spy report valid for some quarters. The report
      reveals hidden information about that rival (site resource values, efficiency, contracts, pending permits)
- [x] Lobby tricks against a rival need a valid spy report on that rival (`noSpyReport`)
- [x] `hireDetectives` action: duration (e.g. 4 quarters), 2 quality levels. Active detectives lower the
      success chance of tricks against the player and raise the chance to catch the culprit
- [x] Caught culprit pays the fine **and** damages to the victim (court); new events for the report
- [x] Rivals: spy before tricks, hire detectives when they were targeted; hard rivals weigh it by value
- [x] Web: espionage panel (report view), detective status, German texts
- [x] Playtest fixes: rivals survey and lease in the same quarter (`OpponentStrategy.explore`), at most four
      surveys per quarter for everyone, stronger detectives (shield 0.6 / 0.4) that deter rivals, and the
      target sees attempts that were fended off

**Selectable game length (D)**
- [x] `createGame` option `years` (3 / 5 / 10, default 10) → `endYear`; stored games keep 10
- [x] Historic milestones and the hard rivals' end-of-game accounting scale with the game length
- [x] Start dialog: choose the game length

**Cable duel when grid capacity is scarce (E)**
- [x] When free grid capacity in the region drops below a threshold (e.g. 2× the plant's MW), `connectGrid`
      opens a cable duel (`cable` challenge with `rival`) against a random rival active in that region instead of the solo cable puzzle
- [x] Duel minigame: same cable puzzle, the rival solves its own board in parallel; its speed depends on
      difficulty (seeded from the challenge). Win → connected; lose → not connected, part of the cost is lost
- [x] Rivals connecting under scarcity: resolved in the engine by a seeded roll (no minigame)
- [x] `autoMinigames`: duel is resolved like the other auto-played challenges

**Plant sizes and repowering (F)**
- [x] Two sizes per plant type: standard (today's values) and large (more MW, higher build cost, needs more
      grid capacity); size is chosen with `applyPermit`
- [x] `repower` action: upgrade a standard plant to large later (surcharge + free grid capacity needed;
      plant is offline for a quarter)
- [x] Rivals choose the size by expected return; hard rivals repower when grid capacity allows
- [x] Web: size choice in the permit dialog, repower button, larger sprites in the scene

**Not now**
- Price spikes (H): electricity cannot be held back like oil. Possible later as short spikes during dark
  doldrums and negative prices in solar surplus, which reward storage and PPAs
- Time budget per quarter, hot-seat multiplayer: too large for the fun they add in solo play

## Phase 8 – Headquarters: the office as main view

Concept: [headquarters.md](headquarters.md). Mechanics first (they give the office its purpose), then the
scene, then the paper look. Balance measured with the simulation script like phase 7.

**Engine**
- [x] Board: `hireExecutive` / `fireExecutive`, four departments, junior/senior, salary per quarter, effects
- [x] Decision cards: `DECISIONS` data, `decide` action, default option at quarter end, rivals decide by value
- [x] HQ building: `upgradeHq`, four levels, upkeep, board limit, book value in net worth
- [x] Awards (gold for the first, silver after) and the annual cup for the largest net worth growth per year
- [x] Rivals: hire, decide and upgrade by value (normal with a higher bar, hard also dismisses); simulation
- [x] Simulation (200 games): hard 322 M€ before / 322 M€ after, normal 194 / 205 M€ (the first valuation of the
      grid board member was too optimistic and cost hard rivals 24 M€)

**Web**
- [x] Office canvas scene (`scene/office.ts`) per HQ level, hotspots as buttons over the canvas
- [x] Folder overlay replaces the tab switch on desktop; phone keeps the tabs with an office header picture
- [x] Board members with speech bubbles replace "Handlungsbedarf"; phone calls from rival CEOs
- [x] Quarter report as board meeting
- [x] Trophy shelf and awards folder (cabinet of awards, race for the annual cup)
- [x] Paper documents: permit form with stamp, lease contract, redacted spy file, newspaper
- [x] Sounds: folder, phone buzz, stamp; reduced motion (no looping room sound – it would wear on the player)
- [x] Playwright play-through on desktop and phone width

## Step 2 – LLM rivals (separate planning later)

- [ ] `LlmOpponent` implementing `OpponentStrategy`, Claude API with tool use (legal actions as tools)
- [ ] Persona per rival from `AI_DEF`, short memory via recent events
- [ ] Timeout + fallback to `SmartOpponent` (normal), cost limit per game, prompt caching
- [ ] `end-quarter` via SSE
- [ ] `ANTHROPIC_API_KEY` as k8s secret
