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
      (`normal` was removed in phase 9)
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
- [x] Rules sheet (no step-by-step tutorial): explains the game once, opened from the start dialog and the top bar

## Phase 9 – Play-test feedback (October 2026)

Feedback of a 3-year game against `normal` rivals: one strategy won without resistance (standard solar parks
in Iberia on the full credit line, 88 M€ vs. 51 M€ for the best rival). Decisions by Michael: `normal` is
removed (the former `hard` is the only level – it already bids for the top sites and aims its tricks at the
leader); grid capacity stays as it is (cable duels happen in real games).

**Balance**
- [x] Only one difficulty: `Difficulty`, `settings.difficulty` and the start dialog's choice are gone; stored
      games keep playing (the old field is ignored, an old client's `difficulty` is dropped by the API)
- [x] Depreciation: a new plant counts `PLANT_BOOK` (90 %) of its costs, minus 1 % per operating quarter, at
      least 35 % – building in the last quarters costs net worth
- [x] Interest grows with the share of the credit line used: 1 % per quarter up to half the line, then up to
      2.5 % at a full line (square of the share above half) on the whole loan; shown in the bank and in the
      report line (first version: 1 % + 2 % × utilisation², too hard on the start with the minimum credit line)
- [x] Smaller gap between the regions: Iberian sun 1500–1850 kWh/kWp (was 1550–1950), North German wind
      6.2–8.2 m/s (was 5.8–7.8); onshore wind permits take 1–3 quarters (was 2–4) and are rejected less often (base 15 %, was 20 %)
- [x] Solar cannibalisation: the solar capture rate of a region drops by 4 % per 100 MW solar (stronger in summer,
      at most 20 %); storage in the region offsets half its MW; PPAs keep their fixed price
- [x] Permit risk by region (`REGIONS[r].reject`: ND +5, IB +6, AL +5 points) and crowding (+3 points per 100 MW
      approved or built in the region, at most +15); shown before applying and while the application runs. A
      lawsuit against a granted permit delays it; the review confirms it unless the lawsuit wins
- [x] Board fee and salaries scale with the game length (3 years 40 %, 5 years 65 %)
- [x] Climate bonus: 20 € per tonne of CO₂ avoided at the end of the game, part of the final net worth
- [x] Rivals value all of it (real permit risk, cannibalisation incl. parks under way and the relief of storage,
      marginal interest, climate bonus) and keep the money for the grid connections of what they build –
      without it a human-like bot went bankrupt in 5 % of the 3-year games under the new interest

**UX**
- [x] Blocked by money: "Es fehlen … – Kredit aufnehmen" with a jump to the bank, under lease, permit, build,
      connect and repower
- [x] Without minigames the odds are shown at the buttons (assembly, grid connection, cable duel)
- [x] Citizens' protest card: no longer says "before the authority decides" for a permit reopened by a lawsuit;
      "Aussitzen" delays the authority's decision by a quarter
- [x] Larger click area of the plots (margin into the gaps between them)
- [x] A rival's portrait in the office opens the rivals' files at that rival
- [x] End screen and news show the climate bonus

**Simulation** (`pnpm simulate`, 60 games each, average net worth; before = all rivals `hard`)

| Game | Seat 0 | Seat 0 before | Rivals before | Seat 0 after | Rivals after |
|------|--------|---------------|---------------|--------------|--------------|
| 3 years | `solar` (Iberia solar, full credit) | 37.8 M€ | 41.9 M€ | 27.1 M€ | 36.7 M€ |
| 3 years | `smart` | 34.5 M€ | 41.4 M€ | 28.8 M€ | 35.4 M€ |
| 3 years | `smart --skilled` | 41.1 M€ (23 % wins) | 41.7 M€ | 32.6 M€ (8 % wins) | 35.3 M€ |
| 5 years | `solar` | – | – | 37.2 M€ | 58.5 M€ |
| 5 years | `smart` | – | – | 42.3 M€ | 57.0 M€ |
| 5 years | `smart --skilled` | – | – | 56.6 M€ (10 % wins) | 59.5 M€ |
| 10 years | `solar` | 96.8 M€ | 318.9 M€ | 90.2 M€ | 271.1 M€ |
| 10 years | `smart` | 188.1 M€ | 332.1 M€ | 151.4 M€ | 264.1 M€ |
| 10 years | `smart --skilled` | 296.9 M€ (30 % wins) | 290.8 M€ | 300.0 M€ (30 % wins) | 291.8 M€ |

All net worths are lower, mostly because of the depreciation (it also lowers the credit limit, 50 % of the
book value) and the solar cannibalisation; a first calibration (80 % book value when built, cannibalisation up
to 30 %) cost another 10–20 % and was softened. The one-sided solar strategy falls back clearly. In the
3-year game a skilled bot in seat 0 now wins less often than before – watch this in the next play-test.
A bot-played 3-year game through the web app: all four companies built solar in Iberia only (330 MW, −13 %
solar revenue, +14 points permit risk); the player-seat bot was stuck at the minimum credit limit with three
approved parks it could not finance. After the region and interest changes: still all solar in Iberia in the
3-year game (240 MW, −10 %), because wind permits take 2–4 quarters and are rejected more often; per invested
euro North German wind and Iberian solar now earn about the same. With the faster wind permits two more
bot-played 3-year games: still 14–15 of 16 Iberian sites with solar, one wind park in North Germany. Solar
keeps the edge through the lower rejection risk (11–20 % vs. 25 % for wind) and the cheaper build.
- [x] Rivals' weak spots found with `scripts/compare.ts` (paired games: one seat plays a variant, 10 years,
      120–200 games each): the forecast valuation was 12.5 % (± 4.5) behind the plain estimates. Causes: grid
      reservations (−10.5 % ± 3.1; now only when the others' waiting projects would take the capacity first) and
      surveys of every North Sea site without the money for offshore (now only financeable projects). Also: idle
      cash is repaid. Afterwards forecast and plain estimates are even (+1.8 % ± 4.9), PPAs are worth +13 %,
      diversification costs about 1 % (kept, it spreads the rivals over the regions). Rivals end at 59 M€
      (5 years) and 271–292 M€ (10 years) instead of 49 / 226–230 M€

- [x] Rivals' plants at the end (average over 20 games of three rivals): 5 years – Iberian solar 9.9, North
      German wind 1.5, Iberian wind 0.9, others below 0.5; 10 years – North German wind 9.7, Iberian solar 8.6,
      Alpine solar 4.7, storage 9.8, Iberian wind 3.7, offshore 2.4, hydro 2.1
- [x] The 3-year game is removed: too short for projects to pay off under the new rules (start dialog offers
      5 and 10 years; stored 3-year games keep playing). The 3-year rows above are kept for reference
- [ ] Play-test a 5-year and a 10-year game with the new rules

## Step 2 – LLM rivals (separate planning later)

- [ ] `LlmOpponent` implementing `OpponentStrategy`, Claude API with tool use (legal actions as tools)
- [ ] Persona per rival from `AI_DEF`, short memory via recent events
- [ ] Timeout + fallback to `SmartOpponent`, cost limit per game, prompt caching
- [ ] `end-quarter` via SSE
- [ ] `ANTHROPIC_API_KEY` as k8s secret
