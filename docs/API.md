# API

Base path `/api`. JSON in, JSON out. All game endpoints except `POST /games` need
`Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/games` | Start a new game |
| `GET` | `/api/games/:id` | Load the game (continue) – player view incl. rivals |
| `POST` | `/api/games/:id/actions` | Execute **one** player action |
| `POST` | `/api/games/:id/end-quarter` | Rivals move, quarter is simulated, report returned |
| `GET` | `/api/health` | Liveness/readiness probe |

There is deliberately no separate "rivals" endpoint: `GET /api/games/:id` returns everything the
player may know about the rivals. Add `GET /api/games/:id/rivals` only if the view gets too large.

## `POST /api/games`

```json
// request
{ "companyName": "Deichwatt AG", "autoMinigames": false }
// 201 response
{ "gameId": "q3Jb0…", "token": "x9F…(43 chars)", "view": { … } }
```

The token is returned **only here**. The client stores `{ gameId, token }` in `localStorage`.
Rate limit: 10 new games per IP per hour.

## `GET /api/games/:id`

`200 { "view": PlayerView }` · `401` wrong/missing token · `404` unknown game.
Unknown game and wrong token may both return `404` to avoid probing – decide in implementation.

## `POST /api/games/:id/actions`

```json
// request
{ "action": { "type": "lease", "siteId": "nd4" } }
// 200 response
{ "view": { … }, "events": [ … ], "challenge": null }
// 422 response (rule violation, state unchanged)
{ "error": "insufficientFunds" }
```

Action types (TypeScript union exported by the engine):

| `type` | Payload | Legacy handler |
|---|---|---|
| `survey` | `siteId` | `A.survey` |
| `lease` | `siteId` | `A.lease` |
| `applyPermit` | `siteId`, `plantType` | `A.permit` |
| `changePlantType` | `siteId` | `A.retype` |
| `build` | `siteId` | `A.build` (returns challenge) |
| `connectGrid` | `siteId` | `A.connect` (returns challenge) |
| `repairSelf` | `siteId` | `A.fixSelf` (returns challenge) |
| `repairService` | `siteId` | `A.fixPro` |
| `sellSite` | `siteId` | `A.sellSite` |
| `reserveGrid` | `region` | `A.reserve` |
| `acceptContract` | `offerId` | `A.accept` |
| `borrow` | `amount` | `A.borrow` |
| `repay` | `amount` or `"all"` | `A.repay` |
| `lobby` | `trick`, `siteId` | `A.doTrick` |
| `minigameResult` | `challengeId`, `outcome` | result of `mini*()` |

The confirmation step of `sellSite` is pure UI and stays in the client.

## `POST /api/games/:id/end-quarter`

```json
// 200 response
{
  "view": { … },
  "report": { "lines": [["Börsenverkauf", 1234567]], "events": [ … ], "startCash": 0, "endCash": 0, "price": 0 },
  "rivalActions": [ { "playerId": 1, "events": [ … ] } ]
}
```

`409 { "error": "challengeOpen" }` while a minigame challenge is pending, `409 { "error": "gameOver" }` after the end.
The client animates `rivalActions` one after the other (replaces the legacy "Konkurrenz" log in the report).

Step 2 (LLM rivals) will be slow, so this endpoint then switches to **Server-Sent Events**
with the same payload pieces as events (`rivalAction`, `report`, `done`). Keep the shapes identical so
only the transport changes.

## Errors

| Status | When |
|---|---|
| `400` | malformed body (schema validation, Fastify JSON schema / TypeBox) |
| `401` | missing/invalid token |
| `404` | unknown game |
| `409` | state conflict (challenge open, game over) |
| `422` | action violates a rule (`insufficientFunds`, `siteTaken`, `noGridCapacity`, `trickLimit`, …) |
| `429` | rate limit |

Error codes are English identifiers; the web app maps them to German messages.
