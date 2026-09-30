# ADR-002: SQLite Storage

**Status:** Accepted
**Date:** 2026-09-30
**Decision Makers:** Michael Schlottmann

## Context

Games must be saved on the server and continued later. Data volume is small (one JSON document of
roughly 50–150 KB per game), access is always by game id, the app runs as a single container.

## Decision

SQLite via `better-sqlite3` in WAL mode, file on a hostPath volume. One table `games` with the game
state as JSON text plus a `version` counter. Schema migrations via `PRAGMA user_version`, no ORM.

## Consequences

- No database server to operate; backup is copying one file (`sqlite3 .backup`).
- Exactly one replica with `strategy: Recreate` – no horizontal scaling (not needed).
- `better-sqlite3` is a native module: the Docker build stage needs python3/make/g++.
