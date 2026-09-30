# CLAUDE.md - Power Tycoon (Wattmogul)

## Project Overview

Browser strategy game about the energy transition (2026–2035). The player runs an
energy company, leases sites in four regions, gets permits, builds wind/solar/storage/hydro
plants, connects them to the grid and competes against three rival companies.

The game currently exists as a single-file client-side game in the `testandwin-net` repo
(copied to [legacy/](legacy/) for reference). The old game stays live there until this project is
deployed – do not change the `testandwin-net` repo as part of this work. This project turns it into a
**web app + API** with a **server-authoritative game engine**, so that the rivals can be
made much stronger — first by improving the rule-based AI, later (step 2) by an LLM.

Start with [docs/steps.md](docs/steps.md). Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
API: [docs/API.md](docs/API.md).

## Language Policy
- **Frontend/UI texts**: German
- **Source code, comments, documentation, commit messages**: English
- The engine never produces German text. It emits structured events and error codes;
  the web app turns them into German texts (`apps/web/src/texts.ts`).

## Architecture Decisions

| Area | Decision | ADR |
|------|----------|-----|
| Game authority | Server runs the whole simulation; client only renders and sends actions | [ADR-001](docs/adr/001-server-authoritative-engine.md) |
| Storage | SQLite (better-sqlite3), game state as JSON document | [ADR-002](docs/adr/002-sqlite-storage.md) |
| Game access | Anonymous: game id + secret token, only the token hash is stored | [ADR-003](docs/adr/003-game-token-access.md) |
| Stack | pnpm monorepo, TypeScript, Fastify, Vite without UI framework | [ADR-004](docs/adr/004-stack-and-monorepo.md) |
| Opponents | Strategy interface; rivals use the same actions as the player | [ADR-005](docs/adr/005-opponent-strategy-interface.md) |
| Hosting | One container on the MicroK8s server, same setup as `eat-hike-art` | - |

## Architecture Principles
- **KISS / YAGNI** – no features "for later" unless the docs say so
- **Engine is pure** – no I/O, no `Math.random()`, no `Date.now()`, no DOM in `packages/engine`
- **One source of truth** – rules live only in the engine; the web app never re-implements them
- **Same rules for everyone** – player and rivals go through the same action validation
- **Deterministic** – all randomness comes from the seeded RNG stored in the game state

## Repository Layout

```
packages/engine/   Pure game logic (rules, simulation, rule-based AI, player view)
apps/api/          Fastify server: REST API, SQLite, serves the built web app
apps/web/          Vite + TypeScript client (rendering, canvas scenes, minigames, sound)
legacy/            Original single-file game. Reference only – do not modify, do not import.
k8s/               Kubernetes manifests (MicroK8s)
docs/              Architecture, API, ADRs, step plan
```

## Commands (once set up)

```bash
pnpm install
pnpm dev          # api (watch) + web (vite, proxies /api)
pnpm test         # vitest in all packages
pnpm build        # engine + web + api
./deploy.sh       # on the server: build image, import into MicroK8s, apply manifests
```

## Coding Conventions
- TypeScript `strict`, ES modules, Node 22
- Money in whole euros as `number` (the legacy game uses e.g. `20e6`), energy in MWh
- IDs: sites keep the legacy format (`nd0`…`al15`), players are `0` (human) and `1..3` (rivals)
- Tests with vitest; engine tests use fixed seeds
- Keep the look and feel of the legacy game – port its CSS and canvas code instead of redesigning

## Security Notes
- The GitHub repo is **public**: never commit secrets. `k8s/secret.yaml` is git-ignored.
- Game tokens are never logged and never stored in plain text.
