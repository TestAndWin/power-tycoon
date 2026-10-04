/** Quarter end: port of legacy `endQuarter()` / `randomEvent()` with the same order of steps. */
import { applyActionInPlace } from './actions.js';
import { AI_DEF, CAPTURE, CO2, INTEREST, PLANTS, plantDef, PRICE_FOLLOW, PRICE_SEASON, TARGET_DRIFT } from './data.js';
import { concerns, emit, eventsForViewer, isConfrontation } from './events.js';
import { clamp, createRng, gauss, nextUint, randomOf } from './rng.js';
import {
  clone,
  creditLimit,
  genEstimate,
  genOffers,
  isStore,
  operating,
  resetSite,
  siteDef,
  storeIncome,
  updateSpread,
  worth,
} from './rules.js';
import type {
  Action,
  ErrorCode,
  GameEvent,
  GameState,
  OpponentStrategy,
  Player,
  PlayerId,
  QuarterReport,
  QuarterResult,
  ReportLine,
  RivalActionLog,
  RivalProfile,
  Site,
} from './types.js';
import { playerView } from './view.js';
import { applyWorldEvents } from './world.js';

/** Thrown by `endQuarter` when the quarter cannot be ended. */
export class EngineError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code);
  }
}

/** Upper bound of actions a strategy may return per quarter. */
export const MAX_ACTIONS_PER_TURN = 60;

export function canEndQuarter(g: GameState): ErrorCode | null {
  if (g.over) return 'gameOver';
  if (g.challenge) return 'challengeOpen';
  return null;
}

export function rivalProfile(pid: PlayerId): RivalProfile {
  const def = AI_DEF[pid - 1];
  return def ? { name: def.name, pref: [...def.pref] } : { name: 'Player', pref: ['nd', 'ib', 'al', 'ns', 'ib'] };
}

/**
 * Lets `strategy` act for player `pid` on `g` (mutates): builds the view, asks the strategy,
 * applies the returned actions one by one. Invalid actions are skipped and logged as `actionRejected`.
 */
export async function runTurnInPlace(g: GameState, pid: PlayerId, strategy: OpponentStrategy): Promise<GameEvent[]> {
  const events: GameEvent[] = [];
  const random = createRng(nextUint(g));
  let actions: unknown;
  try {
    const view = playerView(g, pid);
    // the allowed options are exactly the legal actions
    const legal = view.options.filter((o) => o.error === null).map((o) => o.action);
    actions = await strategy.decide(view, legal, {
      playerId: pid,
      profile: rivalProfile(pid),
      random,
    });
  } catch {
    actions = [];
  }
  const list = Array.isArray(actions) ? actions.slice(0, MAX_ACTIONS_PER_TURN) : [];
  for (const a of list) {
    const err = applyActionInPlace(g, pid, a, events);
    if (err)
      events.push({ type: 'actionRejected', playerId: pid, action: String((a as Action | null)?.type), error: err });
  }
  return events;
}

/** Runs a strategy for a player outside the quarter end (e.g. a bot in seat 0 in simulations). */
export async function playTurn(
  state: GameState,
  pid: PlayerId,
  strategy: OpponentStrategy,
): Promise<{ state: GameState; events: GameEvent[] }> {
  const g = clone(state);
  const events = await runTurnInPlace(g, pid, strategy);
  return { state: g, events };
}

/** Pending permits count down; decided ones are approved or rejected (a successful lawsuit forces a rejection). */
function decidePermits(g: GameState, out: GameEvent[]): void {
  const r = randomOf(g);
  for (const x of g.sites) {
    if (x.alt && x.type) {
      const alt = x.alt;
      if (--alt.left <= 0) {
        const ok = r() >= plantDef(alt.type, alt.size).reject,
          previous = x.type;
        x.alt = null;
        if (ok)
          Object.assign(x, {
            type: alt.type,
            size: alt.size,
            permit: 'approved',
            permitLeft: 0,
            killed: false,
          });
        out.push({
          type: 'permitDecided',
          playerId: x.owner,
          siteId: x.id,
          plantType: alt.type,
          approved: ok,
          previous,
        });
        if (ok) continue;
      }
    }
    if (x.permit !== 'pending' || !x.type) continue;
    x.permitLeft--;
    if (x.permitLeft > 0) continue;
    const rej = x.killed || r() < siteDef(x).reject;
    x.killed = false;
    x.permit = rej ? 'rejected' : 'approved';
    out.push({ type: 'permitDecided', playerId: x.owner, siteId: x.id, plantType: x.type, approved: !rej });
  }
}

function expireReservations(g: GameState): void {
  for (const o of g.res) o.left--;
  g.res = g.res.filter((o) => o.left > 0);
}

/** Every active rival plays its turn. Returns all their events and the log the human may see. */
async function rivalTurns(
  g: GameState,
  opponents: (OpponentStrategy | undefined)[],
  viewer: PlayerId,
): Promise<{ events: GameEvent[]; log: RivalActionLog[] }> {
  const events: GameEvent[] = [];
  const log: RivalActionLog[] = [];
  for (const p of g.players) {
    if (p.human || p.out) continue;
    const strategy = opponents[p.id - 1];
    if (!strategy) continue;
    const ev = await runTurnInPlace(g, p.id, strategy);
    events.push(...ev);
    // the log is attributed to the rival, so tricks only appear if the actor is known anyway
    const visible = eventsForViewer(ev, viewer).filter((e) => !(e.type === 'trickSucceeded' && e.actorId === null));
    log.push({ playerId: p.id, events: visible });
  }
  return { events, log };
}

interface Output {
  /** Generated MWh. */
  gen: number;
  /** Market value of the generation (spot price × capture rate). */
  val: number;
  /** Storage revenue from own generation and from market trading, and the own MWh shifted. */
  storeOwn: number;
  storeMarket: number;
  storeMwh: number;
}

/** Operating plants age, may fail or recover, and produce. Returns the output per player. */
function produce(g: GameState, price: number, out: GameEvent[]): Map<PlayerId, Output> {
  const r = randomOf(g);
  const st = new Map<PlayerId, Output>();
  for (const p of g.players) {
    p.genLast = 0;
    st.set(p.id, { gen: 0, val: 0, storeOwn: 0, storeMarket: 0, storeMwh: 0 });
  }
  const gen = new Map<string, number>();
  const stores: Site[] = [];
  for (const x of g.sites) {
    if (!operating(x) || !x.type) continue;
    x.age++;
    if (x.offline > 0) {
      // repowering: no production this quarter
      x.offline--;
      continue;
    }
    if (x.fault) {
      if (r() < 0.2) {
        x.fault = false;
        out.push({ type: 'faultCleared', playerId: x.owner, siteId: x.id });
      }
      continue;
    }
    if (r() < 0.025) {
      x.fault = true;
      out.push({ type: 'plantFault', playerId: x.owner, siteId: x.id, cause: 'technical' });
      continue;
    }
    const s = st.get(x.owner)!;
    if (isStore(x.type)) stores.push(x);
    else {
      const e = genEstimate(g, x);
      const cls = PLANTS[x.type].cls as 'wind' | 'solar' | 'hydro';
      gen.set(x.id, e);
      s.gen += e;
      s.val += e * price * CAPTURE[cls][g.q]!;
    }
    if (x.curtail > 0) x.curtail--;
  }
  for (const [id, inc] of storeIncome(g, gen, stores)) {
    const s = st.get(g.sites.find((x) => x.id === id)!.owner)!;
    s.storeOwn += inc.own;
    s.storeMarket += inc.market;
    s.storeMwh += inc.ownMwh;
  }
  return st;
}

/** Books revenue (contracts first, the rest at the spot market) and running costs. Returns the report lines. */
function settle(g: GameState, p: Player, s: Output, price: number, out: GameEvent[]): ReportLine[] {
  p.genLast = s.gen;
  p.co2 += s.gen * CO2;
  const lines: ReportLine[] = [];
  const avgCap = s.gen > 0 ? s.val / s.gen : price;
  let left = s.gen;
  let ppa = 0;
  for (const c of p.contracts) {
    const d = Math.min(left, c.vol);
    const short = c.vol - d;
    left -= d;
    const v = d * c.price + short * (c.price - price * 1.15);
    ppa += v;
    lines.push({ kind: 'ppa', amount: Math.round(v), buyer: c.buyer, shortfall: short });
    c.left--;
  }
  const spot = left * avgCap;
  lines.push({ kind: 'spot', amount: Math.round(spot), mwh: left });
  if (s.storeOwn > 0) lines.push({ kind: 'storage', source: 'own', amount: Math.round(s.storeOwn), mwh: s.storeMwh });
  if (s.storeMarket > 0) lines.push({ kind: 'storage', source: 'market', amount: Math.round(s.storeMarket) });
  for (const c of p.contracts) if (c.left <= 0) out.push({ type: 'contractExpired', playerId: p.id, buyer: c.buyer });
  p.contracts = p.contracts.filter((c) => c.left > 0);
  p.cash += Math.round(spot + s.storeOwn + s.storeMarket + ppa);
  let op = 0;
  let ls = 0;
  for (const x of g.sites) {
    if (x.owner !== p.id) continue;
    ls += x.lease * 0.02;
    if (x.built && x.type) op += siteDef(x).opex;
  }
  const interest = p.loan * INTEREST;
  p.cash -= Math.round(op + ls + interest);
  lines.push({ kind: 'opex', amount: -Math.round(op) });
  lines.push({ kind: 'lease', amount: -Math.round(ls) });
  lines.push({ kind: 'interest', amount: -Math.round(interest) });
  return lines;
}

/** The base price drifts towards the target with some noise. */
function movePrice(g: GameState): void {
  const r = randomOf(g);
  g.target *= TARGET_DRIFT;
  g.base += (g.target - g.base) * PRICE_FOLLOW + gauss(r) * g.base * 0.06;
  g.base = clamp(g.base, 35, 260);
}

/** Negative cash is covered by an emergency loan; without credit the human loses and a rival is out. */
function checkSolvency(g: GameState, out: GameEvent[]): void {
  for (const p of g.players) {
    if (p.out || p.cash >= 0) continue;
    const need = Math.ceil(-p.cash / 1e6) * 1e6;
    if (p.loan + need <= creditLimit(g, p)) {
      p.loan += need;
      p.cash += need;
      out.push({ type: 'loanTaken', playerId: p.id, amount: need, emergency: true });
    } else if (p.human) g.over = 'bankrupt';
    else {
      p.out = true;
      p.contracts = [];
      for (const x of g.sites) if (x.owner === p.id) resetSite(x);
      g.res = g.res.filter((o) => o.pid !== p.id);
      emit(g, out, { type: 'playerBankrupt', playerId: p.id });
    }
  }
}

/** Moves to the next quarter: new price, offers and history; checks the end of the game. */
function nextQuarter(g: GameState, out: GameEvent[]): void {
  g.q++;
  g.turn++;
  for (const p of g.players) {
    p.trickUsed = 0;
    if (p.detectives && p.detectives.until < g.turn) {
      p.detectives = null;
      out.push({ type: 'detectivesExpired', playerId: p.id });
    }
    for (const k of Object.keys(p.intel)) if (p.intel[k]! < g.turn) delete p.intel[k];
  }
  if (g.q > 3) {
    g.q = 0;
    g.year++;
  }
  g.price = Math.round(g.base * PRICE_SEASON[g.q]! * 100) / 100;
  g.fx = null;
  updateSpread(g);
  genOffers(g);
  g.priceHist.push(Math.round(g.price));
  g.spreadHist.push(g.spread);
  for (const p of g.players) p.hist.push(p.out ? null : worth(g, p));
  if (!g.over && g.year >= g.endYear) g.over = 'time';
  if (!g.over && g.players.every((p) => p.human || p.out)) g.over = 'monopoly';
}

/**
 * Ends the quarter: world events, permits, reservations, rival turns, generation and revenue,
 * price, solvency, next quarter. `opponents[i]` plays rival `i + 1`.
 * Throws `EngineError` if a challenge is open or the game is over.
 */
export async function endQuarter(
  state: GameState,
  opponents: (OpponentStrategy | undefined)[],
): Promise<QuarterResult> {
  const blocked = canEndQuarter(state);
  if (blocked) throw new EngineError(blocked);
  const g = clone(state);
  const human = 0;
  const P = g.players[human]!;
  const events: GameEvent[] = [];
  const startCash = P.cash;
  const reportYear = g.year;
  const reportQ = g.q;

  applyWorldEvents(g, events);
  updateSpread(g);
  const price = g.price * g.fx!.price;
  decidePermits(g, events);
  expireReservations(g);
  g.phase = 'quarterEnd';
  const rivals = await rivalTurns(g, opponents, human);
  g.phase = 'players';
  const output = produce(g, price, events);
  let lines: ReportLine[] = [];
  for (const p of g.players) {
    if (p.out) continue;
    const L = settle(g, p, output.get(p.id)!, price, events);
    if (p.id === human) lines = L.filter((l) => l.amount !== 0);
  }
  movePrice(g);
  checkSolvency(g, events);
  nextQuarter(g, events);

  // confrontations by rivals concern their target as well
  const confrontations = rivals.events.filter(isConfrontation);
  const report: QuarterReport = {
    year: reportYear,
    q: reportQ,
    lines,
    events: eventsForViewer(
      [...events, ...confrontations].filter((e) => concerns(e, human)),
      human,
    ),
    gen: P.genLast,
    startCash,
    endCash: P.cash,
    price,
  };
  return { state: g, report, rivalActions: rivals.log };
}
