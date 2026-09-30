# ADR-001: Server-Authoritative Game Engine

**Status:** Accepted
**Date:** 2026-09-30
**Decision Makers:** Michael Schlottmann

## Context

The legacy game runs entirely in the browser: simulation, rival AI and save game (`localStorage`).
The rivals should become much stronger, later driven by an LLM. That logic (and an API key) cannot run
in the browser, and if only the rivals ran on the server, player and rivals would share sites, grid
capacity and lobby tricks across two diverging states.

## Decision

The whole simulation runs on the server in a pure TypeScript engine (`packages/engine`).
The client only renders a `PlayerView` and sends one action per request. Rivals use exactly the same
actions and validation as the player.

## Consequences

- One source of truth, no sync problems, rivals' decisions are invisible to the client.
- Every player action is a network round trip (small JSON, acceptable for a turn-based game).
- Client-side skill minigames become two-step actions (challenge → result); their results are trusted.
- The game needs a running server; offline play is no longer possible.
