# ADR-004: Stack and Monorepo

**Status:** Accepted
**Date:** 2026-09-30
**Decision Makers:** Michael Schlottmann

## Context

Engine, API and web client share types (actions, events, view). The legacy UI is ~1,300 lines of
vanilla JS with string templates and canvas drawing.

## Decision

- pnpm workspace with `packages/engine`, `apps/api`, `apps/web`, TypeScript strict, Node 22.
- API: Fastify (JSON schema validation, `inject` for tests, rate-limit and static plugins).
- Web: Vite + TypeScript **without a UI framework**. The legacy UI is ported, not rewritten.
- The API serves the web build: one container, one origin, no CORS.

## Consequences

- Minimal migration effort and the original look is preserved.
- If the UI grows a lot, a framework (e.g. Svelte) can be introduced later per view.
