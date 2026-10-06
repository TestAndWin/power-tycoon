# Architecture

## Goals

1. Keep Wattmogul a browser game with the same look, feel and rules as the legacy version.
2. Move all game logic to the server so that rivals can become stronger without the client
   being able to see or manipulate their decisions.
3. Make rivals pluggable: rule-based now, LLM-based in step 2 – without touching the engine rules.

## Overview

```
┌──────────────────────── Browser ────────────────────────┐
│ apps/web (Vite + TS)                                    │
│  render(view) · canvas scenes · minigames · sound       │
│  localStorage: { gameId, token } only                   │
└──────────────┬──────────────────────────────────────────┘
               │ HTTPS  /api/*   Authorization: Bearer <token>
┌──────────────▼──────────────────────────────────────────┐
│ apps/api (Fastify)                                      │
│  auth (token hash) · per-game lock · rate limit         │
│  load state → engine → save state                       │
│  serves apps/web build as static files                  │
├─────────────────────────────────────────────────────────┤
│ packages/engine (pure TS)                               │
│  createGame · applyAction · endQuarter · playerView     │
│  SmartOpponent (later: LlmOpponent)                     │
├─────────────────────────────────────────────────────────┤
│ SQLite  /data/power-tycoon.db  (hostPath volume)        │
└─────────────────────────────────────────────────────────┘
```

One container, one Ingress, no CORS. The API serves the web build under `/` and the API under `/api`.

## Engine (`packages/engine`)

Port of [legacy/src/core.js](../legacy/src/core.js) plus the game-rule parts of
[legacy/src/ui.js](../legacy/src/ui.js) (the `A` action handlers, `pay()`, trick logic).

### Public API

```ts
createGame(opts: { companyName: string; autoMinigames: boolean; seed: number }): GameState
applyAction(state: GameState, playerId: PlayerId, action: Action): ActionResult
endQuarter(state: GameState, opponents: OpponentStrategy[]): Promise<QuarterResult>
playerView(state: GameState, playerId: PlayerId): PlayerView
legalActions(state: GameState, playerId: PlayerId): Action[]   // used by AI and for tests
actionOptions(state: GameState, playerId: PlayerId): ActionOption[]   // also in the view as `options`
```

Modules of `packages/engine/src`:

| Module | Content |
|---|---|
| `data.ts` | data tables and constants (1:1 from legacy) |
| `rules.ts` | pure rule helpers (costs, values, grid, credit, capacity factor, allowed plant types) |
| `actions.ts` | one handler per action type: rule check, price, effect; `validateAction`, `applyAction` |
| `challenges.ts` | minigame challenge flow (open, auto-resolve, resolve) |
| `legal.ts` | candidate actions → `legalActions` and `actionOptions` |
| `world.ts` | historic and random world events |
| `quarter.ts` | `endQuarter` as named steps (permits, rival turns, production, settlement, price, solvency, next quarter) |
| `events.ts` | event recording, news feed, what a viewer may see |
| `view.ts` | `playerView` (hidden information removed) and helpers on the view |
| `opponents/` | `SmartOpponent` (normal/hard) |

- `GameState` is a plain JSON-serializable object (like the legacy `G`), including the RNG state.
- Functions work on a copy (or mutate a clone made by the caller); a rejected action leaves the state unchanged.
- `ActionResult = { ok: true; state; events: GameEvent[]; challenge?: Challenge } | { ok: false; error: ErrorCode }`
- `QuarterResult = { state; report: QuarterReport; rivalActions: RivalActionLog[] }`

### Rules to carry over (from legacy)

- Data tables: `REG`, `PT`, `SEASON`, `CAPTURE`, `PRICE_SEASON`, `TRICK`, `HIST`, `AI_DEF`, `BUYERS`, constants.
  Deviation: the `HIST` milestones are spread evenly over the 40 quarters (legacy: 2028–2035, EU 2040 only
  in the last year); their effects and those of the random world events are data (`HIST`, `WORLD_EVENTS`).
  The upcoming milestones are public: `PlayerView.milestones` lists them with their effects (overview and
  news tab show them), and the rivals plan with them.
- Quarter end order must stay the same as `endQuarter()` in legacy: historic event → random event →
  spread → permits → reservations → **rival turns** → generation/revenue/costs → price → solvency →
  advance quarter → offers → history → game-over check.
- Storage (deviation from legacy, where every storage earned capacity × spread): a storage first takes the
  generation of its owner's plants in the same region and earns the full spread on it; the rest of its
  capacity trades with bought power at `STORE_MARKET_SHARE` of the spread (`storeIncome` in `rules.ts`).
  The report books both parts as separate `storage` lines.
- Change of mind (new): `applyPermit` for another plant type on an unbuilt site replaces a running application;
  with an approved permit it runs as `Site.alt` next to it – granted, it replaces type and permit, rejected,
  the approved permit stays (`permitDecided.previous`). Starting the build drops it.
- Lobby tricks: max 2 per player per quarter (legacy only limited the human; apply it to all).
- Yield surveys: max `MAX_SURVEYS` (4) per player per quarter (`surveyLimit`, `PlayerView.me.surveysLeft` / `surveyLimit`; the development board member adds more).

### Phase 7 additions (ideas from Oil Imperium)

- Espionage: `spy` buys a report on a rival, valid `SPY_QUARTERS` (current one included, `Player.intel`).
  The view then shows that rival's site data (`SiteView.intel`, resource values) and `PlayerSummary.intel`
  (contracts, detectives, tricks left). Lobby tricks need a valid report on the target's owner (`noSpyReport`).
- Detectives (`hireDetectives`, `basic`/`pro`, `DETECTIVE_QUARTERS`, `Player.detectives`): tricks against the
  client succeed less often (`shield`), failed culprits are caught more often, successful ones sometimes
  afterwards, spies may be caught (no report, the target is told). Hidden from other players.
  The target learns about undiscovered failed attempts on its sites (`trickFailed` with `actorId: null` and
  `defended` = it had detectives), so it sees what the agency fended off.
  The term is stored as the last protected turn (`until`). It starts with `termStart`: the current turn, or the
  next one when hired during `endQuarter` (`GameState.phase = 'quarterEnd'`), because the rivals act after the
  human – so both sides get `DETECTIVE_QUARTERS` turns of the others covered.
- Court: a caught culprit pays the fine and `damages` to the victim (`TRICKS`).
- Plant sizes: `Site.size` (`std`/`large`), chosen with `applyPermit`.
  `plantDef(t, size)` scales capacity, storage volume and costs (`LARGE`); large permits take a quarter longer
  and are rejected more often. `repower` upgrades a running standard plant (`repowerCost`, needs the extra grid
  capacity) and takes it offline for `REPOWER_QUARTERS` (`Site.offline`).
- Book value (`siteValue`) is built from what was paid: `Site.permitPaid`, `invested` (building, depreciated
  with age, plus the repowering) and `gridPaid` (the repowering adds the bigger connection there).
- Cable duel: when the free grid capacity is below `DUEL_SCARCITY` × the plant's MW, the player's own
  reservations do not cover the plant and another player has a project waiting for the grid in the region (`duelRivals`; the view
  flags it as `own.duelRisk`), `connectGrid` opens the `cable` challenge with `rival: { playerId, seconds }` (`duelSeconds`: `DUEL_PACE` × puzzle size `CABLE_COLS` × `CABLE_ROWS`). Lost:
  `DUEL_REFUND` of the costs back, the rival reserves capacity for its own waiting project
  (`DUEL_RESERVE_QUARTERS`). Rivals and `autoMinigames` roll `AUTO_MINIGAME.cableDuel`.
- Game length: `createGame({ years })` with `GAME_YEAR_OPTIONS`; `historicFor(startYear, endYear)` squeezes
  the milestones into the game.
### Phase 8 additions (headquarters)

Concept: [headquarters.md](headquarters.md). Modules `decisions.ts` (cards) and `awards.ts`.

- Board: `Player.board` (one `Executive` per department, `EXEC_GRADES` junior/senior with fee, salary and power),
  limited by the seats of the headquarters (`HQ_LEVELS[hq].seats`). Effects per power point (`EXEC_EFFECTS`):
  project development lowers the rejection chance (`rejectChance`) and adds surveys (`surveyLimit`); grid &
  engineering gives more duel time / a better auto duel and cheaper repowering (`repowerPrice`); trading adds
  €/MWh to new contracts and more market spread for storage (`storeIncome`); legal raises the court damages a
  caught culprit pays and lowers the chance to be caught (`trickOdds`).
- Headquarters: `Player.hq` 0–3 and `hqPaid` (`HQ_BOOK` of it counts into `worth`). Salaries and upkeep are booked
  in `settle` as the report lines `board` and `hq`.
- Decision cards: `dealDecisions` at the end of `nextQuarter` gives a player without a card one with
  `DECISION_CHANCE` (weighted among the cards whose condition holds); `decide` applies an option; `closeDecisions`
  after the rival turns applies the default option of every open card. Options can need a headquarters level
  (`minHq`). Effects: `Site.rejectMod` (citizens), `Player.discount` on build prices (`buildPrice`), storage
  offline for a quarter (heat wave), gambles with the seeded RNG (grant, citizens' delay), losing a board member
  (poach), a discounted lease (mayor). `PlayerView.me.decision` shows the card with price, gain and chance per
  option.
- Awards: `checkAwards` after the history step of `nextQuarter`; gold for the first company (several in the same
  quarter all gold), silver later; the annual cup at the start of a year for the largest growth of `hist` over
  the year before. Public (`PlayerSummary.awards`, news), progress in `PlayerView.me.awardProgress`.
- Rivals (`SmartOpponent`): value board members by their effect over `BOARD_HORIZON` against fee and salaries
  (`boardEdge`), extend the headquarters for a needed seat, dismiss on `hard`, and decide cards by expected value.

- PPA contracts: legacy stores `G.contracts` globally for the human only. Store contracts **per player**
  so rivals can use them; `SmartOpponent` accepts contracts.

### Randomness

Replace `Math.random()` with a small seeded PRNG (e.g. sfc32/mulberry32) whose state lives in
`GameState.rng`. Same seed + same actions ⇒ same game. This enables reproducible tests, bug reports
("seed 1234, quarter 17") and fair comparison of AI strategies.

### Events instead of texts

Legacy builds German strings inside the logic (`news(...)`, `clog(...)`, `rep.events`). The engine
instead emits structured events, e.g.

```ts
{ type: 'siteLeased', playerId: 2, siteId: 'nd4', amount: 1_200_000 }
{ type: 'permitDecided', siteId: 'al3', approved: false }
{ type: 'trickSucceeded', trick: 'bi', siteId: 'ib7', actorId: 1, suspected: true }
{ type: 'worldEvent', key: 'darkDoldrums' }
```

The web app formats them in German (`apps/web/src/texts.ts`). The news feed in the state stores events,
not text. Structured events are also what the LLM rivals will read in step 2.

### Hidden information (`playerView`)

The view sent to the client contains everything the legacy UI shows, but:

- `wind` / `sun` / `hydro` of a site only if the player owns it or has surveyed it.
- `surveyed` only for the requesting player (not which rivals surveyed which site).
- Rival reservations only as used capacity, not by owner, if the UI does not need it.
- No RNG state, no pending results of other players.

Rival cash, loan, number of sites, MW, generation and CO₂ stay visible (legacy "Konkurrenz" tab shows them).

## Minigames

Build and grid connection depend on skill minigames that run in the browser
(`miniLayout`, `miniRotor`, `miniCable`, `miniFreq` in [legacy/src/mini.js](../legacy/src/mini.js)).
They become two-step actions:

1. The player sends e.g. `build`. The engine charges the cost and returns a **challenge**
   `{ id, kind: 'layout' | 'rotor' | 'cable' | 'frequency', siteId, seed }`. The challenge is stored in the state.
2. The client plays the minigame (field generated from `seed`) and sends
   `minigameResult { challengeId, outcome }`. The engine clamps the outcome
   (`layout`: efficiency 0.80–1.15, others: boolean) and continues the flow
   (wind build: layout → rotor; failed rotor ⇒ `fail = true`, etc.).

Rules:
- While a challenge is open, only `minigameResult` is accepted; `end-quarter` is rejected.
- After a reload the client gets the open challenge in the view and restarts the minigame.
- With `autoMinigames: true` (and always for rivals) the engine resolves challenges itself with the
  legacy probabilities (layout `rand(.9, 1.08)`, wind assembly 80 %, grid 85 %, frequency 62 %).
  Rivals on `hard` play like a practised human (`AUTO_MINIGAME_HARD`: layout `rand(1, 1.15)`, assembly and
  grid 95 %, frequency 85 %). A human who wins every minigame earns about 16 % more per plant, which
  compounds to roughly +50 % net worth over the game.
- Minigame results are **trusted** from the client (clamped only). Acceptable, because a player can only
  help themselves against the AI. Revisit if a public high-score list is ever added.

## API (`apps/api`)

See [API.md](API.md). Request flow for every mutating call:

1. Authenticate: look up game, compare `sha256(token)` with the stored hash (timing-safe).
2. Acquire an in-process per-game lock (single replica ⇒ a `Map<gameId, Promise>` is enough).
3. Load state, call engine, save state + bump `version` in one transaction.
4. Return the new `PlayerView` plus events/report.

## Persistence

SQLite via `better-sqlite3`, WAL mode, file on a hostPath volume.

```sql
CREATE TABLE games (
  id           TEXT PRIMARY KEY,        -- random, URL-safe (e.g. 16 bytes base64url)
  token_hash   TEXT NOT NULL,           -- sha256(token), hex
  state        TEXT NOT NULL,           -- JSON GameState
  version      INTEGER NOT NULL,        -- incremented on every write
  status       TEXT NOT NULL,           -- 'running' | 'bankrupt' | 'time' | 'monopoly'
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
```

- Migrations: a numbered list of SQL strings applied at startup (`PRAGMA user_version`). No ORM.
- No compatibility with older saved games while the game is not live: a change of the `GameState` shape needs a
  fresh database. Once it is live, bump `GameState.v` and migrate old JSON on load.
- Cleanup job on startup + daily: delete games not updated for 180 days.
- Backup: `sqlite3 .backup` via a host cron job (documented in README, not part of the app).

## Web app (`apps/web`)

Vite + TypeScript, no framework. Port the legacy files with minimal changes:

| Legacy | New | Change |
|---|---|---|
| `head.html` (CSS + markup), `fonts.css` | `index.html`, `src/styles.css` | split markup/CSS |
| `ui.js` | `src/ui/*.ts` (one module per tab, dialogs, charts) + `src/main.ts` | render from `PlayerView` instead of `G`; action handlers call the API |
| `scene.js` | `src/scene/*.ts` (sky, landscape, plots, objects, effects) | read from view; drawing functions get a `Frame` |
| `mini.js` | `src/minigames/*.ts` (one module per minigame) | seeded from challenge, returns outcome; game logic (`LayoutField`, `RotorAssembly`, cable puzzle, `FrequencyControl`) separate from drawing and tested |
| `sound.js` | `src/sound.ts` | unchanged |
| texts inside `core.js` | `src/texts.ts` | German formatting of events, errors, reports |

Cost previews and helper numbers the UI shows (build cost with learning curve, credit limit, grid
capacity, generation estimate) come either in the view or from pure helpers exported by the engine.
The web app never decides whether an action is allowed: its buttons come from `view.options`
(which actions apply, their price and whether they are blocked), and the server validates every request.

`localStorage` stores only `{ gameId, token }` (key `wattmogul-game`). UI state (tab, selected region,
sound on/off) may also be kept there. "Neues Spiel" creates a new game and replaces the stored id.

## Rivals

```ts
interface OpponentStrategy {
  explore?(view: PlayerView, legal: Action[], ctx: OpponentContext): Promise<Action[]>;
  decide(view: PlayerView, legal: Action[], ctx: OpponentContext): Promise<Action[]>;
}
```

- The engine applies the returned actions one by one via `applyAction`; invalid actions are skipped and logged.
- `explore` (optional) runs first and gathers information (surveys, spy reports); `decide` then gets a fresh
  view with the results – a rival can survey and lease in the same quarter, like the human.
- `SmartOpponent` (phase 6, difficulties `normal` / `hard`; the legacy rival AI was removed): values every project by its expected
  contribution to net worth at game end (remaining quarters × margin + book value − investment), surveys
  before leasing, finances with debt up to a share of the credit limit, accepts PPA contracts covered by
  its own generation, values storage by the spread and how much of it its own plants in the region can fill, reserves grid capacity (`hard`) and aims lobby tricks
  at the leader, preferably the human (`humanBias`). Difficulty = a parameter set (`SMART_PARAMS`).
  `hard` additionally uses the full credit limit and
  - forecasts price and storage spread per quarter like the engine's price model (trend, the announced
    `HIST` milestones, this quarter's world event from `WORLD_EVENTS`) and grid capacity (projects of
    others, announced expansions); a project is valued along its timeline, only finished parts count at the end,
  - surveys the unknown sites with the best expected return first (offshore too), sells dead projects,
    spreads over regions and raises its project limits with uncommitted financing room,
  - goes for big projects (offshore) as soon as they can be financed (`bigProjects`): counts the operating
    cash flow until the plant is built and does not prefer small projects while its financing room covers
    the big one,
  - values tricks by the target's real loss (season, timing, end of game), may use both tricks of a quarter
    and strikes back at a human who was caught or suspected tricking it.
  Both levels spy on a target before tricking it (in `explore`, so the report – including the target's
  detectives – is known when they decide), back off from a target with detectives with probability
  `1 − shield`, hire detectives after an attack (`normal` basic, `hard` pro),
  choose the plant size by return per invested euro (large only if it is financeable now and clearly better)
  and repower running plants when the extra margin pays for the upgrade and the quarter offline.
  Planning noise is a fixed misjudgement per site, so rivals disagree consistently instead of randomly.
- `opponentsFor(difficulty)` builds the three rivals; the API calls it with the stored difficulty.
- `pnpm simulate -- --games 200 --seat0 normal --rivals hard` measures strategies over many seeds;
  `--skilled` lets seat 0 win every minigame like a good human player, `--years` sets the game length.
  Reference (200 games, mixed rivals, seat 0 = normal bot): normal ≈ 194 M€, hard ≈ 322 M€.
  Hard rivals vs. a skilled hard bot in seat 0 (`--seat0 hard --rivals hard --skilled`): seat 0 ≈ 325 M€ and
  wins 25 %, rivals ≈ 339 M€ and 25 % each (before the hard minigame odds and `bigProjects`: seat 0 won 70 %;
  before phase 7: 13 %; before `explore` the rivals only leased from the second quarter on: 309 / 318 M€). A good human plays better than the bot, so this is the target range for "about even" on `hard`.
- Step 2 `LlmOpponent`: gets the view + recent events as JSON, the legal actions as tools, and a persona from
  `AI_DEF`. Falls back to `SmartOpponent` (`normal`) on timeout/error. Details are decided when step 2 starts.

## Deployment

Same pattern as `eat-hike-art` (MicroK8s on the eServer):

- `Dockerfile`: multi-stage, `node:24-alpine`, build tools for `better-sqlite3`, non-root user `1001`.
- `deploy.sh`: `docker build` → `docker save` → `microk8s ctr image import` → `kubectl apply` → rollout restart.
- `k8s/`: `namespace.yaml`, `configmap.yaml`, `deployment.yaml`, `service.yaml`, `ingress.yaml`
  (step 2 adds `secret.yaml.example` for the `ANTHROPIC_API_KEY`).
- Namespace `power-tycoon`, `replicas: 1`, `strategy: Recreate` (SQLite must never have two writers).
- Data: hostPath `/srv/power-tycoon/data` → `/data`.
- Service type **ClusterIP** (eat-hike-art already uses NodePort 30080; the Ingress does not need a NodePort).
- Ingress class `public`, cert-manager `letsencrypt-prod` (the cluster issuer already exists).
- Probes on `GET /api/health`.
- Domain: `powertycoon.testandwin.de` (A record in Route 53). testandwin.net stays at Strato and
  later only links to the new host, no iframe.
- The API trusts exactly one proxy hop (`TRUST_PROXY=1`, the ingress) for the client IP used by the
  rate limits.
