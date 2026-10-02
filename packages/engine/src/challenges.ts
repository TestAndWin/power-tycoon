/**
 * Skill minigames ("challenges") inside building, connecting and repairing. A human player
 * plays them in the browser; rivals and players with `autoMinigames` get a random outcome.
 */
import { AUTO_MINIGAME, LAYOUT_RANGE, PLANTS, SELF_REPAIR_COST } from './data.js';
import { emit } from './events.js';
import { clamp, nextUint, rand, randomOf } from './rng.js';
import { consumeReserve, siteById } from './rules.js';
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

function autoOutcome(g: GameState, kind: ChallengeKind): number | boolean {
  const r = randomOf(g);
  if (kind === 'layout') return Math.round(rand(r, AUTO_MINIGAME.layout[0], AUTO_MINIGAME.layout[1]) * 100) / 100;
  return r() < AUTO_MINIGAME[kind];
}

/** Opens a challenge for `step` on site `x`; resolves it at once if the player does not play minigames. */
export function startChallenge(
  g: GameState,
  pid: PlayerId,
  kind: ChallengeKind,
  x: Site,
  step: ChallengeStep,
  out: GameEvent[],
): void {
  const ch: OpenChallenge = { id: g.nextId++, kind, siteId: x.id, seed: nextUint(g), playerId: pid, step };
  if (autoResolves(g, pid)) resolveChallenge(g, ch, autoOutcome(g, kind), out);
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
      const mw = PLANTS[x.type!].mw;
      const cost = PLANTS[x.type!].grid;
      if (ok) {
        x.grid = true;
        consumeReserve(g, x.r, pid, mw);
        emit(g, out, { type: 'gridConnected', playerId: pid, siteId: x.id, mw, cost });
      } else emit(g, out, { type: 'gridConnectFailed', playerId: pid, siteId: x.id, cost });
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

/** The part of an open challenge the client may see. */
export const publicChallenge = (ch: OpenChallenge | null): Challenge | null =>
  ch ? { id: ch.id, kind: ch.kind, siteId: ch.siteId, seed: ch.seed } : null;
