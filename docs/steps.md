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
- [x] `RuleBasedOpponent` as port of `aiTurn`/`aiTrick`, using actions only
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
- [x] Difficulty levels (easy/normal/hard) as parameters of the strategy
- [x] Simulation script: N games, report average net worth per strategy

## Step 2 – LLM rivals (separate planning later)

- [ ] `LlmOpponent` implementing `OpponentStrategy`, Claude API with tool use (legal actions as tools)
- [ ] Persona per rival from `AI_DEF`, short memory via recent events
- [ ] Timeout + fallback to `RuleBasedOpponent`, cost limit per game, prompt caching
- [ ] `end-quarter` via SSE
- [ ] `ANTHROPIC_API_KEY` as k8s secret
