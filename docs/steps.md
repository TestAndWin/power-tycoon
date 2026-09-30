# Implementation Steps

Work phase by phase. Each phase ends with passing tests and a commit/PR.

## Open questions (ask Michael before the phase that needs them)

- [ ] Domain / host name for the Ingress (needed in phase 5)
- [ ] Should testandwin.net/power-tycoon link to or redirect to the new host once it is live? (phase 5)

## Phase 0 – Repo setup

- [ ] pnpm workspace: `packages/engine`, `apps/api`, `apps/web`; root `tsconfig.base.json` (strict)
- [ ] vitest, prettier, `.gitignore` (node_modules, dist, `*.db`, `k8s/secret.yaml`), `.nvmrc` (22)
- [ ] Root scripts: `dev`, `build`, `test`, `typecheck`
- [ ] GitHub Actions: install, typecheck, test on push/PR
- [ ] README (German or English? → English, short: what it is, how to run, how to deploy)

## Phase 1 – Engine (largest phase)

- [ ] Types: `GameState`, `Site`, `Player`, `Action`, `GameEvent`, `Challenge`, `PlayerView`, `ErrorCode`
- [ ] Data tables from legacy `core.js` (1:1 values)
- [ ] Seeded RNG in state
- [ ] `createGame`
- [ ] `applyAction` for every action in API.md, incl. minigame challenge flow
- [ ] `endQuarter` with the legacy order of steps, per-player contracts
- [ ] `playerView` with hidden information
- [ ] `RuleBasedOpponent` as port of `aiTurn`/`aiTrick`, using actions only
- [ ] Tests: each action (happy path + rule violations), determinism (same seed ⇒ same result),
      invariants (grid capacity never exceeded, cash bookkeeping), a full 40-quarter bot-vs-bot
      smoke game that ends without exceptions
- [ ] Compare balance roughly with legacy (rival net worth after 10 years in the same range)

## Phase 2 – API

- [ ] Fastify app, JSON schemas for all bodies (TypeBox), `/api/health`
- [ ] SQLite (`better-sqlite3`, WAL), migrations via `PRAGMA user_version`
- [ ] Game id + token creation, sha256 hash, timing-safe compare (ADR-003)
- [ ] Per-game lock, load → engine → save in one transaction
- [ ] Endpoints from API.md, error mapping
- [ ] `@fastify/rate-limit`, `@fastify/static` for the web build
- [ ] Cleanup of games older than 180 days
- [ ] Tests with `fastify.inject` against a temp DB (auth, happy paths, errors, token of game A cannot access game B)

## Phase 3 – Web app

- [ ] Vite + TS, dev proxy `/api` → API
- [ ] Port CSS/markup from `legacy/src/head.html` + `fonts.css`
- [ ] API client (`fetch` wrapper, token header, German error messages)
- [ ] Port `ui.js` render functions to render from `PlayerView`
- [ ] Port `scene.js`, `sound.js`
- [ ] Port minigames, seeded from challenge; resume open challenge after reload
- [ ] `texts.ts`: German texts for events, errors, report lines, news
- [ ] Start dialog: new game / continue (if `gameId` in localStorage and API returns it)
- [ ] Quarter report incl. animated rival actions
- [ ] Manual play-through on desktop and phone width; optional Playwright smoke test

## Phase 4 – Container

- [ ] Dockerfile (multi-stage, node:22-alpine, python3/make/g++ for better-sqlite3, non-root 1001)
- [ ] Container serves web + API on one port, `DATA_DIR=/data`
- [ ] `docker run` locally, play one quarter

## Phase 5 – Deployment on the eServer

- [ ] `k8s/` manifests following `eat-hike-art` (see ARCHITECTURE.md → Deployment)
- [ ] `deploy.sh` following `eat-hike-art/deploy.sh` (namespace/deployment name `power-tycoon`)
- [ ] DNS for the chosen domain, TLS via cert-manager
- [ ] Backup cron for the SQLite file (host side), documented in README
- [ ] Only after the new game is live and tested: update testandwin.net (repo `testandwin-net`) to point
      to the new game and retire the old single-file version there. Until then, leave it untouched.

## Phase 6 – Stronger rule-based rivals

Quick wins before any LLM, measured with bot-vs-bot simulations over many seeds:

- [ ] Evaluate sites with expected return (generation × price − costs) instead of fixed thresholds
- [ ] Use PPA contracts, storage arbitrage and grid reservations deliberately
- [ ] Target lobby tricks at the leader (esp. the human) when it pays off
- [ ] Difficulty levels (easy/normal/hard) as parameters of the strategy
- [ ] Simulation script: N games, report average net worth per strategy

## Step 2 – LLM rivals (separate planning later)

- [ ] `LlmOpponent` implementing `OpponentStrategy`, Claude API with tool use (legal actions as tools)
- [ ] Persona per rival from `AI_DEF`, short memory via recent events
- [ ] Timeout + fallback to `RuleBasedOpponent`, cost limit per game, prompt caching
- [ ] `end-quarter` via SSE
- [ ] `ANTHROPIC_API_KEY` as k8s secret
