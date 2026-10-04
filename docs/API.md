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
{ "companyName": "Deichwatt AG", "autoMinigames": false, "difficulty": "normal", "years": 10 }
// 201 response
{ "gameId": "q3Jb0…", "token": "x9F…(43 chars)", "view": { … } }
```

`years` (`3` | `5` | `10`) is the game length, optional, default `10`; the historic milestones are squeezed into
it. `difficulty` (`normal` | `hard`) is optional, default `normal`. Stored games without a difficulty (or with
the removed `easy`) play against `normal`.
The token is returned **only here**. The client stores `{ gameId, token }` in `localStorage`.
Rate limit: 10 new games per IP per hour.

## `GET /api/games/:id`

`200 { "view": PlayerView }` · `401` wrong/missing token · `404` unknown game.
Decision: wrong token returns `401` (as in the error table); game ids are 128-bit random, so `404` for
unknown ids does not help probing.

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
| `applyPermit` | `siteId`, `plantType`, `size?` (`std` \| `large`, default `std`) | `A.permit` |
| `changePlantType` | `siteId` | `A.retype` |
| `build` | `siteId` | `A.build` (returns challenge) |
| `connectGrid` | `siteId` | `A.connect` (returns challenge; a `cable` challenge with `rival` is a duel when capacity is scarce) |
| `repower` | `siteId` | new: upgrade a running standard plant to large |
| `repairSelf` | `siteId` | `A.fixSelf` (returns challenge) |
| `repairService` | `siteId` | `A.fixPro` |
| `sellSite` | `siteId` | `A.sellSite` |
| `reserveGrid` | `region` | `A.reserve` |
| `acceptContract` | `offerId` | `A.accept` |
| `borrow` | `amount` | `A.borrow` |
| `repay` | `amount` or `"all"` | `A.repay` |
| `lobby` | `trick`, `siteId` | `A.doTrick` (needs a valid spy report on the owner) |
| `spy` | `targetId` | new: spy report on a rival |
| `hireDetectives` | `level` (`basic` \| `pro`) | new: protection against tricks and spies |
| `minigameResult` | `challengeId`, `outcome` | result of `mini*()` |

The confirmation step of `sellSite` is pure UI and stays in the client.

### Action options in the view

`view.options` lists every action that applies to the player's current state, so the client never has
to re-implement rules to decide which buttons to show:

```json
{ "action": { "type": "connectGrid", "siteId": "nd4" }, "cost": 1200000, "error": "noGridCapacity" }
```

`error` is `null` if the action is allowed now, or a code that only blocks it for the moment
(`insufficientFunds`, `noGridCapacity`, `creditLimit`, `contractLimit`, `trickLimit`, `noSpyReport`,
`detectivesActive`). Actions that do not
apply at all (e.g. `build` on a site without permit) are not listed. The client shows a button for every
option and disables it while `error` is set; the server still validates every request.

## `POST /api/games/:id/end-quarter`

```json
// 200 response
{
  "view": { … },
  "report": {
    "year": 2026, "q": 0,
    "lines": [{ "kind": "spot", "amount": 1234567, "mwh": 15000 }, { "kind": "opex", "amount": -120000 }],
    "events": [ … ], "gen": 15000, "startCash": 0, "endCash": 0, "price": 0
  },
  "rivalActions": [ { "playerId": 1, "events": [ … ] } ]
}
```

Report lines are structured (`kind`: `ppa` | `spot` | `storage` | `opex` | `lease` | `interest`; storage lines carry
`source`: `own` (own generation of the region shifted, with `mwh`) or `market`) because the
engine never produces German text; the web app labels them.

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
| `429` | rate limit (`{ "error": "rateLimited" }`) |

Error codes are English identifiers; the web app maps them to German messages.
