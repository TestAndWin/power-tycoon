/**
 * Player actions: port of the legacy `A` handlers (legacy/src/ui.js) and `pay()`.
 * Every action type has one handler that bundles its rule check, its price and its effect.
 * An action is validated first (`validateAction`), then executed on a clone.
 * Rivals go through exactly the same code.
 */
import {
  MAX_CONTRACTS,
  MAX_TRICKS,
  PLANTS,
  RESERVE_COST,
  RESERVE_MW,
  RESERVE_QUARTERS,
  SELF_REPAIR_COST,
  TRICK_CAUGHT,
  TRICK_SUSPECTED,
  TRICKS,
} from './data.js';
import { finishBuild, publicChallenge, resolveChallenge, startChallenge } from './challenges.js';
import { emit } from './events.js';
import { randint, randomOf } from './rng.js';
import {
  buildCost,
  clone,
  creditLimit,
  freeGrid,
  plantTypesFor,
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
  ActionType,
  ErrorCode,
  GameEvent,
  GameState,
  Player,
  PlayerId,
  Site,
  TrickType,
} from './types.js';

type ActionOf<K extends ActionType> = Extract<Action, { type: K }>;

interface Ctx<A extends Action> {
  g: GameState;
  pid: PlayerId;
  p: Player;
  a: A;
  /** The target site, for actions with a `siteId`. */
  x: A extends { siteId: string } ? Site : undefined;
}

interface Handler<A extends Action> {
  /** The action targets a site (`siteId`), which must exist. */
  site?: true;
  /** Allowed while a challenge is open (only the minigame result). */
  duringChallenge?: true;
  /** Rule check; the price is checked afterwards. */
  validate(c: Ctx<A>): ErrorCode | null;
  /** What the action costs right now (default 0). */
  price?(c: Ctx<A>): number;
  execute(c: Ctx<A>, cost: number, out: GameEvent[]): void;
}

const ownSite = (c: { x: Site; pid: PlayerId }): ErrorCode | null => (c.x.owner === c.pid ? null : 'notOwner');
const freeSite = (c: { x: Site }): ErrorCode | null => (c.x.owner >= 0 ? 'siteTaken' : null);
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;
const repayAmount = (p: Player, amount: number | 'all'): number =>
  amount === 'all' ? p.loan : Math.min(amount, p.loan);

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

const HANDLERS: { [K in ActionType]: Handler<ActionOf<K>> } = {
  survey: {
    site: true,
    validate: (c) => freeSite(c) ?? (c.x.surveyed.includes(c.pid) ? 'alreadySurveyed' : null),
    price: (c) => surveyCost(c.x),
    execute({ g, p, pid, x }, cost, out) {
      p.cash -= cost;
      x.surveyed.push(pid);
      emit(g, out, { type: 'siteSurveyed', playerId: pid, siteId: x.id, cost });
    },
  },
  lease: {
    site: true,
    validate: freeSite,
    price: (c) => c.x.lease,
    execute({ g, p, pid, x }, cost, out) {
      p.cash -= cost;
      x.owner = pid;
      emit(g, out, { type: 'siteLeased', playerId: pid, siteId: x.id, amount: cost });
    },
  },
  applyPermit: {
    site: true,
    validate(c) {
      const { x, a } = c;
      const err = ownSite(c);
      if (err) return err;
      if (!plantTypesFor(x).includes(a.plantType)) return 'invalidPlantType';
      if (!x.type) return null;
      if (x.permit === 'rejected') return x.type !== a.plantType ? 'invalidPlantType' : null;
      // change of mind: a running application is replaced, an approved permit stays until the new one is decided
      if (x.built) return 'invalidState';
      if (x.type === a.plantType || x.alt?.type === a.plantType) return 'invalidState';
      return null;
    },
    price: (c) => PLANTS[c.a.plantType].permit,
    execute({ g, p, pid, x, a }, cost, out) {
      p.cash -= cost;
      const left = randint(randomOf(g), ...PLANTS[a.plantType].permitQ);
      if (x.type && x.permit === 'approved') {
        x.alt = { type: a.plantType, left };
        emit(g, out, {
          type: 'permitApplied',
          playerId: pid,
          siteId: x.id,
          plantType: a.plantType,
          cost,
          quarters: left,
        });
        return;
      }
      x.type = a.plantType;
      x.permit = 'pending';
      x.killed = false;
      x.permitLeft = left;
      emit(g, out, {
        type: 'permitApplied',
        playerId: pid,
        siteId: x.id,
        plantType: a.plantType,
        cost,
        quarters: x.permitLeft,
      });
    },
  },
  changePlantType: {
    site: true,
    validate: (c) => ownSite(c) ?? (c.x.permit !== 'rejected' ? 'invalidState' : null),
    execute({ g, pid, x }, _cost, out) {
      x.type = null;
      x.permit = null;
      x.alt = null;
      emit(g, out, { type: 'plantTypeCleared', playerId: pid, siteId: x.id });
    },
  },
  build: {
    site: true,
    validate: (c) => ownSite(c) ?? (c.x.permit !== 'approved' || c.x.built ? 'invalidState' : null),
    price: ({ g, x }) => (x.fail ? retryCost(g, x.type!) : buildCost(g, x.type!)),
    execute({ g, p, pid, x }, cost, out) {
      const t = x.type!;
      p.cash -= cost;
      x.alt = null;
      emit(g, out, { type: 'buildStarted', playerId: pid, siteId: x.id, plantType: t, cost, retry: x.fail });
      if (x.fail) return startChallenge(g, pid, 'rotor', x, 'retry', out);
      x.invested = cost;
      if (PLANTS[t].cls === 'wind' || t === 'solar') startChallenge(g, pid, 'layout', x, 'build', out);
      else {
        x.eff = 1;
        finishBuild(g, pid, x, out);
      }
    },
  },
  connectGrid: {
    site: true,
    validate(c) {
      const { g, pid, x } = c;
      const err = ownSite(c);
      if (err) return err;
      if (!x.built || x.grid) return 'invalidState';
      if (freeGrid(g, x.r, pid) < PLANTS[x.type!].mw) return 'noGridCapacity';
      return null;
    },
    price: (c) => PLANTS[c.x.type!].grid,
    execute({ g, p, pid, x }, cost, out) {
      p.cash -= cost;
      startChallenge(g, pid, 'cable', x, 'connect', out);
    },
  },
  repairSelf: {
    site: true,
    validate: (c) => ownSite(c) ?? (!c.x.fault || !c.x.grid ? 'invalidState' : null),
    price: () => SELF_REPAIR_COST,
    execute({ g, p, pid, x }, cost, out) {
      p.cash -= cost;
      startChallenge(g, pid, 'frequency', x, 'repair', out);
    },
  },
  repairService: {
    site: true,
    validate: (c) => ownSite(c) ?? (!c.x.fault || !c.x.grid ? 'invalidState' : null),
    price: (c) => serviceCost(c.x.type!),
    execute({ g, p, pid, x }, cost, out) {
      p.cash -= cost;
      x.fault = false;
      emit(g, out, { type: 'repaired', playerId: pid, siteId: x.id, method: 'service', cost });
    },
  },
  sellSite: {
    site: true,
    validate: ownSite,
    execute({ g, p, pid, x }, _cost, out) {
      const val = sellValue(x);
      p.cash += val;
      resetSite(x);
      emit(g, out, { type: 'siteSold', playerId: pid, siteId: x.id, amount: val });
    },
  },
  reserveGrid: {
    validate({ g, pid, a }) {
      if (!regionOk(a.region)) return 'unknownRegion';
      return freeGrid(g, a.region, pid) < RESERVE_MW ? 'noGridCapacity' : null;
    },
    price: () => RESERVE_COST,
    execute({ g, p, pid, a }, cost, out) {
      p.cash -= cost;
      g.res.push({ pid, r: a.region, mw: RESERVE_MW, left: RESERVE_QUARTERS });
      emit(g, out, { type: 'gridReserved', playerId: pid, region: a.region, mw: RESERVE_MW, cost });
    },
  },
  acceptContract: {
    validate({ g, p, a }) {
      if (p.contracts.length >= MAX_CONTRACTS) return 'contractLimit';
      return g.offers.some((o) => o.id === a.offerId) ? null : 'unknownOffer';
    },
    execute({ g, p, pid, a }, _cost, out) {
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
    },
  },
  borrow: {
    validate({ g, p, a }) {
      if (!isAmount(a.amount)) return 'invalidAmount';
      return p.loan + a.amount > creditLimit(g, p) ? 'creditLimit' : null;
    },
    execute({ g, p, pid, a }, _cost, out) {
      p.loan += a.amount;
      p.cash += a.amount;
      emit(g, out, { type: 'loanTaken', playerId: pid, amount: a.amount, emergency: false });
    },
  },
  repay: {
    validate({ p, a }) {
      if (a.amount !== 'all' && !isAmount(a.amount)) return 'invalidAmount';
      const amt = repayAmount(p, a.amount);
      if (amt <= 0) return 'invalidAmount';
      return p.cash < amt ? 'insufficientFunds' : null;
    },
    execute({ g, p, pid, a }, _cost, out) {
      const amt = repayAmount(p, a.amount);
      p.cash -= amt;
      p.loan -= amt;
      emit(g, out, { type: 'loanRepaid', playerId: pid, amount: amt });
    },
  },
  lobby: {
    site: true,
    validate({ g, pid, p, a, x }) {
      if (!(a.trick in TRICKS)) return 'unknownTrick';
      if (!trickTargets(g, a.trick, pid).includes(x)) return 'invalidTarget';
      return p.trickUsed >= MAX_TRICKS ? 'trickLimit' : null;
    },
    price: (c) => TRICKS[c.a.trick].cost,
    execute({ g, p, pid, a, x }, cost, out) {
      const T = TRICKS[a.trick];
      const r = randomOf(g);
      p.cash -= cost;
      p.trickUsed++;
      const targetId = x.owner as PlayerId;
      if (r() < T.chance) {
        applyTrick(g, a.trick, x);
        const suspected = r() < TRICK_SUSPECTED;
        emit(g, out, { type: 'trickSucceeded', actorId: pid, targetId, trick: a.trick, siteId: x.id, suspected });
      } else {
        const caught = T.fine > 0 && r() < TRICK_CAUGHT;
        if (caught) p.cash -= T.fine;
        emit(g, out, {
          type: 'trickFailed',
          actorId: pid,
          targetId,
          trick: a.trick,
          siteId: x.id,
          caught,
          fine: caught ? T.fine : 0,
        });
      }
    },
  },
  minigameResult: {
    duringChallenge: true,
    validate({ g, pid, a }) {
      const ch = g.challenge;
      if (!ch || ch.playerId !== pid) return 'noChallenge';
      if (ch.id !== a.challengeId) return 'challengeMismatch';
      if (ch.kind === 'layout')
        return typeof a.outcome === 'number' && Number.isFinite(a.outcome) ? null : 'invalidOutcome';
      return typeof a.outcome === 'boolean' ? null : 'invalidOutcome';
    },
    execute({ g, a }, _cost, out) {
      resolveChallenge(g, g.challenge!, a.outcome, out);
    },
  },
};

/** Errors that only block an otherwise applicable action for now (money, capacity, limits). */
const BLOCKING = new Set<ErrorCode>([
  'insufficientFunds',
  'noGridCapacity',
  'creditLimit',
  'contractLimit',
  'trickLimit',
]);
export const isBlocking = (e: ErrorCode): boolean => BLOCKING.has(e);

type Prepared =
  { error: ErrorCode; cost?: number } | { error: null; handler: Handler<Action>; ctx: Ctx<Action>; cost: number };

/** Looks up the handler and the context of `a` and runs all checks. Never mutates. */
function prepare(g: GameState, pid: PlayerId, a: Action): Prepared {
  if (!a || typeof a !== 'object' || typeof a.type !== 'string') return { error: 'unknownAction' };
  const p = g.players[pid];
  if (!p) return { error: 'unknownPlayer' };
  if (g.over) return { error: 'gameOver' };
  if (p.out) return { error: 'playerOut' };
  if (!Object.hasOwn(HANDLERS, a.type)) return { error: 'unknownAction' };
  const handler = HANDLERS[a.type] as Handler<Action>;
  if (g.challenge && !handler.duringChallenge) return { error: 'challengeOpen' };
  let x: Site | undefined;
  if (handler.site) {
    x = siteById(g, (a as { siteId: string }).siteId);
    if (!x) return { error: 'unknownSite' };
  }
  const ctx = { g, pid, p, a, x } as Ctx<Action>;
  const err = handler.validate(ctx);
  if (err && !isBlocking(err)) return { error: err };
  const cost = handler.price?.(ctx) ?? 0;
  if (err) return { error: err, cost };
  if (p.cash < cost) return { error: 'insufficientFunds', cost };
  return { error: null, handler, ctx, cost };
}

/** Returns the error code if `a` is not allowed for player `pid`, else null. Never mutates. */
export const validateAction = (g: GameState, pid: PlayerId, a: Action): ErrorCode | null => prepare(g, pid, a).error;

/** Like `validateAction`, plus the price (known for allowed and for blocked actions). */
export function checkAction(g: GameState, pid: PlayerId, a: Action): { error: ErrorCode | null; cost?: number } {
  const { error, cost } = prepare(g, pid, a);
  return { error, cost };
}

/** Validates and executes in place. Used by the engine for rival turns. */
export function applyActionInPlace(g: GameState, pid: PlayerId, a: Action, out: GameEvent[]): ErrorCode | null {
  const res = prepare(g, pid, a);
  if (res.error) return res.error;
  res.handler.execute(res.ctx, res.cost, out);
  return null;
}

/** Applies one action of player `pid`. A rejected action leaves `state` untouched. */
export function applyAction(state: GameState, pid: PlayerId, action: Action): ActionResult {
  const err = validateAction(state, pid, action);
  if (err) return { ok: false, error: err };
  const g = clone(state);
  const events: GameEvent[] = [];
  applyActionInPlace(g, pid, action, events);
  const ch = g.challenge && g.challenge.playerId === pid ? publicChallenge(g.challenge) : null;
  return { ok: true, state: g, events, challenge: ch };
}
