# ADR-003: Anonymous Game Access with Game Id and Secret Token

**Status:** Accepted
**Date:** 2026-09-30
**Decision Makers:** Michael Schlottmann

## Context

There are no user accounts. A player must be able to continue their game, but nobody must be able to
read or change someone else's game by guessing or knowing a game id.

## Decision

- `POST /api/games` creates a random game id (16 bytes, base64url) and a separate random secret token
  (32 bytes, base64url) with `crypto.randomBytes`.
- The server stores only `sha256(token)`. A fast hash is sufficient because the token has 256 bits of
  entropy (no password, no brute force possible); argon2/bcrypt are not needed.
- The token is returned once. The client stores `{ gameId, token }` in `localStorage` and sends
  `Authorization: Bearer <token>` on every call. The server compares hashes with `timingSafeEqual`.
- Tokens are never logged.

## Consequences

- No login, no personal data (GDPR-friendly).
- Clearing browser data or switching devices loses access to the game. Optional later: a
  "Spiel auf anderem Gerät fortsetzen" link with id and token in the URL fragment (`#`), which is never sent to the server.
