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
│  RuleBasedOpponent (later: LlmOpponent)                 │
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
| `opponents/` | `RuleBasedOpponent` (easy), `SmartOpponent` (normal/hard) |

- `GameState` is a plain JSON-serializable object (like the legacy `G`), including the RNG state.
- Functions work on a copy (or mutate a clone made by the caller); a rejected action leaves the state unchanged.
- `ActionResult = { ok: true; state; events: GameEvent[]; challenge?: Challenge } | { ok: false; error: ErrorCode }`
- `QuarterResult = { state; report: QuarterReport; rivalActions: RivalActionLog[] }`

### Rules to carry over (from legacy)

- Data tables: `REG`, `PT`, `SEASON`, `CAPTURE`, `PRICE_SEASON`, `TRICK`, `HIST`, `AI_DEF`, `BUYERS`, constants.
- Quarter end order must stay the same as `endQuarter()` in legacy: historic event → random event →
  spread → permits → reservations → **rival turns** → generation/revenue/costs → price → solvency →
  advance quarter → offers → history → game-over check.
- Lobby tricks: max 2 per player per quarter (legacy only limited the human; apply it to all).
- PPA contracts: legacy stores `G.contracts` globally for the human only. Store contracts **per player**
  so rivals can use them. The legacy rival AI (`easy`) does not accept contracts; `SmartOpponent` does.

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
- `GameState.v` (schema version) stays; bump it and migrate old JSON on load if the shape changes.
- Cleanup job on startup + daily: delete games not updated for 180 days.
- Backup: `sqlite3 .backup` via a host cron job (documented in README, not part of the app).

## Web app (`apps/web`)

Vite + TypeScript, no framework. Port the legacy files with minimal changes:

| Legacy | New | Change |
|---|---|---|
| `head.html` (CSS + markup), `fonts.css` | `index.html`, `src/styles.css` | split markup/CSS |
| `ui.js` | `src/ui/*.ts` (one module per tab, dialogs, charts) + `src/main.ts` | render from `PlayerView` instead of `G`; action handlers call the API |
| `scene.js` | `src/scene/*.ts` (sky, landscape, plots, objects, effects) | read from view; drawing functions get a `Frame` |
| `mini.js` | `src/minigames.ts` | seeded from challenge, returns outcome |
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
  decide(view: PlayerView, legal: Action[], ctx: { playerId: PlayerId; profile: RivalProfile }): Promise<Action[]>;
}
```

- The engine applies the returned actions one by one via `applyAction`; invalid actions are skipped and logged.
- `RuleBasedOpponent`: port of `aiTurn()` / `aiTrick()` expressed as actions (borrow, survey, lease, applyPermit,
  build, connectGrid, reserveGrid, repay, lobby). Used for difficulty `easy` and for games created before
  difficulties existed (`settings.difficulty` missing).
- `SmartOpponent` (phase 6, difficulties `normal` / `hard`): values every project by its expected
  contribution to net worth at game end (remaining quarters × margin + book value − investment), surveys
  before leasing, finances with debt up to a share of the credit limit, accepts PPA contracts covered by
  its own generation, values storage by the spread, reserves grid capacity (`hard`) and aims lobby tricks
  at the leader, preferably the human (`humanBias`). Difficulty = a parameter set (`SMART_PARAMS`).
- `opponentsFor(difficulty)` builds the three rivals; the API calls it with the stored difficulty.
- `pnpm simulate -- --games 200 --seat0 normal --rivals hard` measures strategies over many seeds.
  Reference (200 games, mixed rivals, seat 0 = legacy bot): easy ≈ 112 M€, normal ≈ 221 M€, hard ≈ 266 M€.
- Step 2 `LlmOpponent`: gets the view + recent events as JSON, the legal actions as tools, and a persona from
  `AI_DEF`. Falls back to `RuleBasedOpponent` on timeout/error. Details are decided when step 2 starts.

## Deployment

Same pattern as `eat-hike-art` (MicroK8s on the eServer):

- `Dockerfile`: multi-stage, `node:22-alpine`, build tools for `better-sqlite3`, non-root user `1001`.
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
