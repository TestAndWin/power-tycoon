/**
 * Skill minigames ("challenges") inside building, connecting and repairing. A human player
 * plays them in the browser; rivals and players with `autoMinigames` get a random outcome.
 */
import { DUEL_REFUND, DUEL_RESERVE_QUARTERS, LAYOUT_RANGE, PLANTS, SELF_REPAIR_COST } from './data.js';
import { emit } from './events.js';
import { clamp, nextUint, rand, randomOf } from './rng.js';
import {
  autoMinigame,
  consumeReserve,
  freeGrid,
  myReserve,
  siteById,
  siteDef,
  siteMw,
  waitingForGrid,
} from './rules.js';
import type {
  Challenge,
  ChallengeKind,
  ChallengeStep,
  GameEvent,
  GameState,
  OpenChallenge,
  PlayerId,
  Site,
} from './types.js';

const autoResolves = (g: GameState, pid: PlayerId): boolean => !g.players[pid]!.human || g.settings.autoMinigames;

function autoOutcome(g: GameState, pid: PlayerId, kind: ChallengeKind): number | boolean {
  const r = randomOf(g);
  const M = autoMinigame(g.settings.difficulty, g.players[pid]!.human);
  if (kind === 'layout') return Math.round(rand(r, M.layout[0], M.layout[1]) * 100) / 100;
  return r() < M[kind];
}

/** Opens a challenge for `step` on site `x`; resolves it at once if the player does not play minigames. */
export function startChallenge(
  g: GameState,
  pid: PlayerId,
  kind: ChallengeKind,
  x: Site,
  step: ChallengeStep,
  out: GameEvent[],
  rival?: OpenChallenge['rival'],
): void {
  const ch: OpenChallenge = { id: g.nextId++, kind, siteId: x.id, seed: nextUint(g), playerId: pid, step };
  if (rival) ch.rival = rival;
  if (autoResolves(g, pid)) resolveChallenge(g, ch, autoOutcome(g, pid, kind), out);
  else g.challenge = ch;
}

export function finishBuild(g: GameState, pid: PlayerId, x: Site, out: GameEvent[]): void {
  x.built = true;
  x.fail = false;
  emit(g, out, { type: 'plantBuilt', playerId: pid, siteId: x.id, plantType: x.type! });
}

/** Applies the outcome of a challenge (validated by the caller) and continues the flow it belongs to. */
export function resolveChallenge(g: GameState, ch: OpenChallenge, outcome: number | boolean, out: GameEvent[]): void {
  g.challenge = null;
  const x = siteById(g, ch.siteId)!;
  const pid = ch.playerId;
  const ok = outcome === true;
  switch (ch.step) {
    case 'build':
      if (ch.kind === 'layout') {
        x.eff = clamp(Number(outcome), LAYOUT_RANGE[0], LAYOUT_RANGE[1]);
        emit(g, out, { type: 'layoutRated', playerId: pid, siteId: x.id, eff: x.eff });
        if (PLANTS[x.type!].cls === 'wind') startChallenge(g, pid, 'rotor', x, 'build', out);
        else finishBuild(g, pid, x, out);
      } else if (ok) finishBuild(g, pid, x, out);
      else {
        x.fail = true;
        emit(g, out, { type: 'assemblyFailed', playerId: pid, siteId: x.id });
      }
      break;
    case 'retry':
      if (ok) finishBuild(g, pid, x, out);
      else emit(g, out, { type: 'assemblyFailed', playerId: pid, siteId: x.id });
      break;
    case 'connect': {
      const mw = siteMw(x);
      const cost = siteDef(x).grid;
      if (ch.rival) {
        const reservedMw = ok ? 0 : duelLost(g, ch.rival.playerId, x);
        const refund = ok ? 0 : Math.round(cost * DUEL_REFUND);
        g.players[pid]!.cash += refund;
        emit(g, out, {
          type: 'gridDuel',
          playerId: pid,
          rivalId: ch.rival.playerId,
          siteId: x.id,
          won: ok,
          refund,
          reservedMw,
        });
      }
      if (ok) {
        x.grid = true;
        consumeReserve(g, x.r, pid, mw);
        emit(g, out, { type: 'gridConnected', playerId: pid, siteId: x.id, mw, cost });
      } else if (!ch.rival) emit(g, out, { type: 'gridConnectFailed', playerId: pid, siteId: x.id, cost });
      break;
    }
    case 'repair':
      if (ok) {
        x.fault = false;
        emit(g, out, { type: 'repaired', playerId: pid, siteId: x.id, method: 'self', cost: SELF_REPAIR_COST });
      } else emit(g, out, { type: 'repairFailed', playerId: pid, siteId: x.id });
      break;
  }
}

/**
 * The rival won the cable duel for the region of `x`: it secures capacity for its own project waiting for the
 * grid there (as a short reservation). Returns the reserved MW (0 if it has no such project).
 */
function duelLost(g: GameState, rival: PlayerId, x: Site): number {
  const need = g.sites
    .filter((y) => y.r === x.r && y.owner === rival && waitingForGrid(y))
    .reduce((s, y) => s + siteMw(y), 0);
  const have = myReserve(g, x.r, rival);
  // `freeGrid` counts the rival's own reservations as free: only the rest is still available
  const mw = Math.min(need - have, freeGrid(g, x.r, rival) - have);
  if (mw <= 0) return 0;
  g.res.push({ pid: rival, r: x.r, mw, left: DUEL_RESERVE_QUARTERS });
  return mw;
}

/** The part of an open challenge the client may see. */
export const publicChallenge = (ch: OpenChallenge | null): Challenge | null =>
  ch
    ? { id: ch.id, kind: ch.kind, siteId: ch.siteId, seed: ch.seed, ...(ch.rival ? { rival: { ...ch.rival } } : {}) }
    : null;
