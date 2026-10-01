# Power Tycoon (Wattmogul)

Browser strategy game about the energy transition 2026–2035: lease sites, build wind, offshore,
solar, storage and hydro plants and outplay three rival companies. UI in German.

This repo is the successor of the single-file game at testandwin.net/power-tycoon:
a web app plus an API with a server-side game engine, so that the rivals can get smarter
(rule-based first, LLM-driven later). The old game stays live until this one is deployed.

- [docs/steps.md](docs/steps.md) – implementation plan and status
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – architecture
- [docs/API.md](docs/API.md) – REST API
- [docs/adr/](docs/adr/) – architecture decisions
- [legacy/](legacy/) – original game sources (reference only)

## Layout

```
packages/engine/   pure game logic (rules, simulation, rivals, player view)
apps/api/          Fastify + SQLite, serves the built web app
apps/web/          Vite + TypeScript client
```

## Run locally

Requires Node 22 and pnpm 10.

```bash
pnpm install
pnpm dev          # API on :3000 (watch) + Vite on :5173 (proxies /api)
pnpm test         # vitest in all packages
pnpm typecheck
pnpm build        # engine + web + api
node apps/api/dist/server.js   # serves web + API on :3000 (DATA_DIR defaults to ./data)
pnpm simulate     # bot-vs-bot simulation, e.g. `pnpm simulate -- --games 200 --seat0 normal --rivals hard`
```

API environment variables: `PORT` (3000), `HOST` (0.0.0.0 in the container), `DATA_DIR`
(SQLite file `power-tycoon.db`), `WEB_ROOT` (built web app, defaults to `apps/web/dist`).

## Container

```bash
docker build -t power-tycoon .
docker run --rm -p 3000:3000 -v "$PWD/data:/data" power-tycoon
```

## Deploy

Deployment to the MicroK8s server (`k8s/`, `deploy.sh`) follows the `eat-hike-art` setup –
see docs/ARCHITECTURE.md → Deployment (phase 5, not done yet).
