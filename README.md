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

Requires Node 24 and pnpm 10.

```bash
pnpm install
pnpm dev          # API on :3000 (watch) + Vite on :5173 (proxies /api)
pnpm test         # vitest in all packages
pnpm typecheck
pnpm build        # engine + web + api
node apps/api/dist/server.js   # serves web + API on :3000 (DATA_DIR defaults to ./data)
pnpm simulate     # bot-vs-bot simulation, e.g. `pnpm simulate -- --games 200 --seat0 smart --years 3`
```

API environment variables: `PORT` (3000), `HOST` (0.0.0.0 in the container), `DATA_DIR`
(SQLite file `power-tycoon.db`), `WEB_ROOT` (built web app, defaults to `apps/web/dist`).

## Container

```bash
docker build -t power-tycoon .
docker run --rm -p 3000:3000 -v "$PWD/data:/data" power-tycoon
```

## Deploy

Runs at https://powertycoon.testandwin.de on the MicroK8s server, same setup as `eat-hike-art`
(see docs/ARCHITECTURE.md → Deployment). Prerequisites on the server: MicroK8s with the `ingress`
addon, cert-manager with the cluster issuer `letsencrypt-prod`, Docker. DNS: an A record for
`powertycoon.testandwin.de` pointing to the server (Route 53).

```bash
git pull
./deploy.sh            # build image, import into MicroK8s, apply k8s/, restart the pod
./deploy.sh status     # pods, ingress, TLS certificate
./deploy.sh logs
```

The SQLite file lives on the host in `/srv/power-tycoon/data/power-tycoon.db` (owned by uid 1001,
`deploy.sh` creates the directory). `./deploy.sh delete` removes the namespace but keeps the data.

### Backup

Daily copy via SQLite's online backup (safe while the app is running, WAL mode), kept for 30 days.
Needs `sqlite3` on the host (`sudo apt install sqlite3`). `/etc/cron.daily/backup-power-tycoon`:

```bash
#!/bin/sh
set -e
BACKUP_DIR=/backups/power-tycoon
mkdir -p "$BACKUP_DIR"
sqlite3 /srv/power-tycoon/data/power-tycoon.db ".backup '$BACKUP_DIR/power-tycoon-$(date +%F).db'"
gzip -f "$BACKUP_DIR/power-tycoon-$(date +%F).db"
find "$BACKUP_DIR" -name 'power-tycoon-*.db.gz' -mtime +30 -delete
```

`sudo chmod +x /etc/cron.daily/backup-power-tycoon`. Restore: `./deploy.sh delete`, unzip the
backup to `/srv/power-tycoon/data/power-tycoon.db` (owner 1001), `./deploy.sh`.
