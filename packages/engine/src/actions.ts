/**
 * Player actions: port of the legacy `A` handlers (legacy/src/ui.js) and `pay()`.
 * Every action is validated first (`validateAction`), then executed on a clone.
 * Rivals go through exactly the same code.
 */
import {
  AUTO_MINIGAME,
  LAYOUT_RANGE,
  MAX_CONTRACTS,
  MAX_TRICKS,
  PLANTS,
  REGIONS,
  RESERVE_COST,
  RESERVE_MW,
  RESERVE_QUARTERS,
  SELF_REPAIR_COST,
  TRICK_CAUGHT,
  TRICK_SUSPECTED,
  TRICKS,
} from './data.js';
import { clamp, nextUint, rand, randint, randomOf } from './rng.js';
import {
  buildCost,
  clone,
  consumeReserve,
  creditLimit,
  emit,
  freeGrid,
  regionOk,
  resetSite,
  retryCost,
  sellValue,
  serviceCost,
  siteById,
  surveyCost,
  trickTargets,
} from './rules.js';
import type {
  Action,
  ActionResult,
  Challenge,
  ChallengeKind,
  ChallengeStep,
  ErrorCode,
  GameEvent,
  GameState,
  OpenChallenge,
  Player,
  PlayerId,
  Site,
  TrickType,
} from './types.js';

const SITE_ACTIONS = new Set([
  'survey',
  'lease',
  'applyPermit',
  'changePlantType',
  'build',
  'connectGrid',
  'repairSelf',
  'repairService',
  'sellSite',
  'lobby',
]);

/** Cost the action would charge right now (0 if free). Assumes the action is otherwise valid. */
function priceOf(g: GameState, a: Action, x: Site | undefined): number {
  switch (a.type) {
    case 'survey':
      return surveyCost(x!);
    case 'lease':
      return x!.lease;
    case 'applyPermit':
      return PLANTS[a.plantType].permit;
    case 'build':
      return x!.fail ? retryCost(g, x!.type!) : buildCost(g, x!.type!);
    case 'connectGrid':
      return PLANTS[x!.type!].grid;
    case 'repairSelf':
      return SELF_REPAIR_COST;
    case 'repairService':
      return serviceCost(x!.type!);
    case 'reserveGrid':
      return RESERVE_COST;
    case 'lobby':
      return TRICKS[a.trick].cost;
    default:
      return 0;
  }
}

/** Returns the error code if `a` is not allowed for player `pid`, else null. Never mutates. */
export function validateAction(g: GameState, pid: PlayerId, a: Action): ErrorCode | null {
  if (!a || typeof a !== 'object' || typeof a.type !== 'string') return 'unknownAction';
  const p = g.players[pid];
  if (!p) return 'unknownPlayer';
  if (g.over) return 'gameOver';
  if (p.out) return 'playerOut';
  if (a.type === 'minigameResult') {
    const ch = g.challenge;
    if (!ch || ch.playerId !== pid) return 'noChallenge';
    if (ch.id !== a.challengeId) return 'challengeMismatch';
    if (ch.kind === 'layout') {
      if (typeof a.outcome !== 'number' || !Number.isFinite(a.outcome)) return 'invalidOutcome';
    } else if (typeof a.outcome !== 'boolean') return 'invalidOutcome';
    return null;
  }
  if (g.challenge) return 'challengeOpen';

  let x: Site | undefined;
  if (SITE_ACTIONS.has(a.type)) {
    x = siteById(g, (a as { siteId: string }).siteId);
    if (!x) return 'unknownSite';
  }
  const own = () => (x!.owner === pid ? null : 'notOwner');
  let err: ErrorCode | null = null;
  switch (a.type) {
    case 'survey':
      if (x!.owner >= 0) return 'siteTaken';
      if (x!.surveyed.includes(pid)) return 'alreadySurveyed';
      break;
    case 'lease':
      if (x!.owner >= 0) return 'siteTaken';
      break;
    case 'applyPermit': {
      if ((err = own())) return err;
      const t = a.plantType;
      if (!(t in PLANTS) || !REGIONS[x!.r].types.includes(t)) return 'invalidPlantType';
      if ((t === 'hydro' || t === 'pump') && !x!.hydro) return 'invalidPlantType';
      if (x!.type) {
        if (x!.permit !== 'rejected') return 'invalidState';
        if (x!.type !== t) return 'invalidPlantType';
      }
      break;
    }
    case 'changePlantType':
      if ((err = own())) return err;
      if (x!.permit !== 'rejected') return 'invalidState';
      break;
    case 'build':
      if ((err = own())) return err;
      if (x!.permit !== 'approved' || x!.built) return 'invalidState';
      break;
    case 'connectGrid':
      if ((err = own())) return err;
      if (!x!.built || x!.grid) return 'invalidState';
      if (freeGrid(g, x!.r, pid) < PLANTS[x!.type!].mw) return 'noGridCapacity';
      break;
    case 'repairSelf':
    case 'repairService':
      if ((err = own())) return err;
      if (!x!.fault || !x!.grid) return 'invalidState';
      break;
    case 'sellSite':
      if ((err = own())) return err;
      break;
    case 'reserveGrid':
      if (!regionOk(a.region)) return 'unknownRegion';
      if (freeGrid(g, a.region, pid) < RESERVE_MW) return 'noGridCapacity';
      break;
    case 'acceptContract':
      if (p.contracts.length >= MAX_CONTRACTS) return 'contractLimit';
      if (!g.offers.some((o) => o.id === a.offerId)) return 'unknownOffer';
      break;
    case 'borrow':
      if (typeof a.amount !== 'number' || !Number.isInteger(a.amount) || a.amount <= 0) return 'invalidAmount';
      if (p.loan + a.amount > creditLimit(g, p)) return 'creditLimit';
      break;
    case 'repay': {
      if (a.amount !== 'all' && (typeof a.amount !== 'number' || !Number.isInteger(a.amount) || a.amount <= 0))
        return 'invalidAmount';
      const amt = a.amount === 'all' ? p.loan : Math.min(a.amount, p.loan);
      if (amt <= 0) return 'invalidAmount';
      if (p.cash < amt) return 'insufficientFunds';
      break;
    }
    case 'lobby':
      if (!(a.trick in TRICKS)) return 'unknownTrick';
      if (p.trickUsed >= MAX_TRICKS) return 'trickLimit';
      if (!trickTargets(g, a.trick, pid).includes(x!)) return 'invalidTarget';
      break;
    default:
      return 'unknownAction';
  }
  if (p.cash < priceOf(g, a, x)) return 'insufficientFunds';
  return null;
}

function pay(p: Player, c: number): void {
  p.cash -= c;
}

/* ---------------- Minigame challenges ---------------- */

const autoResolves = (g: GameState, pid: PlayerId): boolean => !g.players[pid]!.human || g.settings.autoMinigames;

function autoOutcome(g: GameState, kind: ChallengeKind): number | boolean {
  const r = randomOf(g);
  if (kind === 'layout') return Math.round(rand(r, AUTO_MINIGAME.layout[0], AUTO_MINIGAME.layout[1]) * 100) / 100;
  return r() < AUTO_MINIGAME[kind];
}

function startChallenge(
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

function finishBuild(g: GameState, pid: PlayerId, x: Site, out: GameEvent[]): void {
  x.built = true;
  x.fail = false;
  emit(g, out, { type: 'plantBuilt', playerId: pid, siteId: x.id, plantType: x.type! });
}

function resolveChallenge(g: GameState, ch: OpenChallenge, outcome: number | boolean, out: GameEvent[]): void {
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

/* ---------------- Tricks ---------------- */

function applyTrick(g: GameState, type: TrickType, x: Site): void {
  const r = randomOf(g);
  if (type === 'klage') {
    x.permit = 'pending';
    x.permitLeft = Math.max(x.permitLeft, 0) + 2;
    if (r() < 0.15) {
      x.permitLeft = 0;
      x.killed = true;
    }
  } else if (type === 'bi') x.curtail = 2;
  else x.fault = true;
}

/* ---------------- Execution ---------------- */

/** Executes a validated action on `g` (mutates). */
function execute(g: GameState, pid: PlayerId, a: Action, out: GameEvent[]): void {
  const p = g.players[pid]!;
  const r = randomOf(g);
  const x = SITE_ACTIONS.has(a.type) ? siteById(g, (a as { siteId: string }).siteId)! : undefined;
  const cost = priceOf(g, a, x);
  switch (a.type) {
    case 'survey':
      pay(p, cost);
      x!.surveyed.push(pid);
      emit(g, out, { type: 'siteSurveyed', playerId: pid, siteId: x!.id, cost });
      break;
    case 'lease':
      pay(p, cost);
      x!.owner = pid;
      emit(g, out, { type: 'siteLeased', playerId: pid, siteId: x!.id, amount: cost });
      break;
    case 'applyPermit': {
      pay(p, cost);
      x!.type = a.plantType;
      x!.permit = 'pending';
      x!.permitLeft = randint(r, ...PLANTS[a.plantType].permitQ);
      emit(g, out, {
        type: 'permitApplied',
        playerId: pid,
        siteId: x!.id,
        plantType: a.plantType,
        cost,
        quarters: x!.permitLeft,
      });
      break;
    }
    case 'changePlantType':
      x!.type = null;
      x!.permit = null;
      emit(g, out, { type: 'plantTypeCleared', playerId: pid, siteId: x!.id });
      break;
    case 'build': {
      const t = x!.type!;
      pay(p, cost);
      emit(g, out, { type: 'buildStarted', playerId: pid, siteId: x!.id, plantType: t, cost, retry: x!.fail });
      if (x!.fail) {
        startChallenge(g, pid, 'rotor', x!, 'retry', out);
        break;
      }
      x!.invested = cost;
      const cls = PLANTS[t].cls;
      if (cls === 'wind' || t === 'solar') startChallenge(g, pid, 'layout', x!, 'build', out);
      else {
        x!.eff = 1;
        finishBuild(g, pid, x!, out);
      }
      break;
    }
    case 'connectGrid':
      pay(p, cost);
      startChallenge(g, pid, 'cable', x!, 'connect', out);
      break;
    case 'repairSelf':
      pay(p, cost);
      startChallenge(g, pid, 'frequency', x!, 'repair', out);
      break;
    case 'repairService':
      pay(p, cost);
      x!.fault = false;
      emit(g, out, { type: 'repaired', playerId: pid, siteId: x!.id, method: 'service', cost });
      break;
    case 'sellSite': {
      const val = sellValue(x!);
      p.cash += val;
      resetSite(x!);
      emit(g, out, { type: 'siteSold', playerId: pid, siteId: x!.id, amount: val });
      break;
    }
    case 'reserveGrid':
      pay(p, cost);
      g.res.push({ pid, r: a.region, mw: RESERVE_MW, left: RESERVE_QUARTERS });
      emit(g, out, { type: 'gridReserved', playerId: pid, region: a.region, mw: RESERVE_MW, cost });
      break;
    case 'acceptContract': {
      const o = g.offers.find((o) => o.id === a.offerId)!;
      g.offers = g.offers.filter((q) => q !== o);
      p.contracts.push({
        id: o.id,
        buyer: o.buyer,
        vol: o.vol,
        quarters: o.quarters,
        price: o.price,
        left: o.quarters,
      });
      emit(g, out, {
        type: 'contractAccepted',
        playerId: pid,
        offerId: o.id,
        buyer: o.buyer,
        vol: o.vol,
        price: o.price,
        quarters: o.quarters,
      });
      break;
    }
    case 'borrow':
      p.loan += a.amount;
      p.cash += a.amount;
      emit(g, out, { type: 'loanTaken', playerId: pid, amount: a.amount, emergency: false });
      break;
    case 'repay': {
      const amt = a.amount === 'all' ? p.loan : Math.min(a.amount, p.loan);
      p.cash -= amt;
      p.loan -= amt;
      emit(g, out, { type: 'loanRepaid', playerId: pid, amount: amt });
      break;
    }
    case 'lobby': {
      const T = TRICKS[a.trick];
      pay(p, cost);
      p.trickUsed++;
      const targetId = x!.owner as PlayerId;
      if (r() < T.chance) {
        applyTrick(g, a.trick, x!);
        const suspected = r() < TRICK_SUSPECTED;
        emit(g, out, { type: 'trickSucceeded', actorId: pid, targetId, trick: a.trick, siteId: x!.id, suspected });
      } else {
        const caught = T.fine > 0 && r() < TRICK_CAUGHT;
        if (caught) p.cash -= T.fine;
        emit(g, out, {
          type: 'trickFailed',
          actorId: pid,
          targetId,
          trick: a.trick,
          siteId: x!.id,
          caught,
          fine: caught ? T.fine : 0,
        });
      }
      break;
    }
    case 'minigameResult':
      resolveChallenge(g, g.challenge!, a.outcome, out);
      break;
  }
}

/** Validates and executes in place. Used by the engine for rival turns. */
export function applyActionInPlace(g: GameState, pid: PlayerId, a: Action, out: GameEvent[]): ErrorCode | null {
  const err = validateAction(g, pid, a);
  if (err) return err;
  execute(g, pid, a, out);
  return null;
}

export const publicChallenge = (ch: OpenChallenge | null): Challenge | null =>
  ch ? { id: ch.id, kind: ch.kind, siteId: ch.siteId, seed: ch.seed } : null;

/** Applies one action of player `pid`. A rejected action leaves `state` untouched. */
export function applyAction(state: GameState, pid: PlayerId, action: Action): ActionResult {
  const err = validateAction(state, pid, action);
  if (err) return { ok: false, error: err };
  const g = clone(state);
  const events: GameEvent[] = [];
  execute(g, pid, action, events);
  const ch = g.challenge && g.challenge.playerId === pid ? publicChallenge(g.challenge) : null;
  return { ok: true, state: g, events, challenge: ch };
}
