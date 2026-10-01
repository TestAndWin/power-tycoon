/** Quarter end: port of legacy `endQuarter()` / `randomEvent()` with the same order of steps. */
import { applyActionInPlace } from './actions.js';
import { AI_DEF, CAPTURE, CO2, HIST, INTEREST, PLANTS, PRICE_SEASON, REGION_KEYS } from './data.js';
import { legalActions } from './legal.js';
import { clamp, createRng, gauss, nextUint, pick, randomOf } from './rng.js';
import {
  clone,
  creditLimit,
  emit,
  eventsForViewer,
  genEstimate,
  genOffers,
  isStore,
  operating,
  resetSite,
  storeRevenue,
  updateSpread,
  worth,
} from './rules.js';
import type {
  Action,
  ErrorCode,
  GameEvent,
  GameState,
  OpponentStrategy,
  PlayerId,
  QuarterReport,
  QuarterResult,
  ReportLine,
  RivalActionLog,
  RivalProfile,
} from './types.js';
import { playerView } from './view.js';

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
    actions = await strategy.decide(playerView(g, pid), legalActions(g, pid), {
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

function randomEvent(g: GameState, out: GameEvent[]): void {
  const r = randomOf(g);
  const fx = g.fx!;
  const winter = g.q === 0 || g.q === 3;
  const E: [number, () => GameEvent][] = [
    [
      winter ? 4 : 0,
      () => {
        fx.wind = 0.6;
        fx.solar = 0.5;
        fx.price = 1.4;
        fx.spread = 40;
        return { type: 'worldEvent', key: 'darkDoldrums' };
      },
    ],
    [
      winter ? 0 : 3,
      () => {
        fx.solar = 1.15;
        fx.price = 0.85;
        return { type: 'worldEvent', key: 'recordSummer' };
      },
    ],
    [
      3,
      () => {
        fx.wind = 0.75;
        return { type: 'worldEvent', key: 'lull' };
      },
    ],
    [
      2,
      () => {
        fx.wind = 1.15;
        for (const x of g.sites) {
          if (operating(x) && x.type === 'off' && r() < 0.3) {
            x.fault = true;
            out.push({ type: 'plantFault', playerId: x.owner, siteId: x.id, cause: 'storm' });
          }
        }
        return { type: 'worldEvent', key: 'stormSeries' };
      },
    ],
    [
      2,
      () => {
        g.base *= 1.25;
        g.target *= 1.12;
        fx.price = 1.2;
        return { type: 'worldEvent', key: 'gasShock' };
      },
    ],
    [
      3,
      () => {
        const region = pick(r, REGION_KEYS);
        g.grid[region] += 150;
        return { type: 'worldEvent', key: 'gridExpansion', region };
      },
    ],
    [
      2,
      () => {
        fx.hydro = 0.6;
        return { type: 'worldEvent', key: 'drought' };
      },
    ],
    [
      2,
      () => {
        g.target *= 0.9;
        g.base *= 0.93;
        return { type: 'worldEvent', key: 'industryDip' };
      },
    ],
  ];
  const tot = E.reduce((s, e) => s + e[0], 0);
  let k = r() * tot;
  for (const [w, f] of E) {
    k -= w;
    if (w && k <= 0) {
      emit(g, out, f());
      return;
    }
  }
}

function applyHistoric(g: GameState, key: (typeof HIST)[number]['key']): void {
  switch (key) {
    case 'ets2':
      g.target *= 1.08;
      break;
    case 'grid2030':
      for (const r of REGION_KEYS) g.grid[r] += 150;
      break;
    case 'hydrogen':
      g.target *= 1.15;
      g.ppaBoost = 1.6;
      break;
    case 'coalExit':
      g.target *= 1.1;
      g.spreadAdd += 20;
      break;
    case 'eu2040':
      g.target *= 1.06;
      break;
  }
}

/** Is this event of interest for player `pid`'s quarterly report? */
function concerns(e: GameEvent, pid: PlayerId): boolean {
  switch (e.type) {
    case 'historicEvent':
    case 'worldEvent':
    case 'playerBankrupt':
      return true;
    case 'trickSucceeded':
    case 'trickFailed':
      return e.targetId === pid;
    default:
      return 'playerId' in e && e.playerId === pid;
  }
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
  const r = randomOf(g);
  const human = 0;
  const P = g.players[human]!;
  const events: GameEvent[] = [];
  const startCash = P.cash;
  const reportYear = g.year;
  const reportQ = g.q;

  g.fx = { wind: 1, solar: 1, hydro: 1, price: 1, spread: 0 };
  const h = HIST.find((e) => e.year === g.year && e.q === g.q);
  if (h) {
    applyHistoric(g, h.key);
    emit(g, events, { type: 'historicEvent', key: h.key });
  }
  if (r() < 0.32) randomEvent(g, events);
  updateSpread(g);
  const price = g.price * g.fx.price;

  // permits
  for (const x of g.sites) {
    if (x.permit !== 'pending' || !x.type) continue;
    x.permitLeft--;
    if (x.permitLeft > 0) continue;
    const rej = x.killed || r() < PLANTS[x.type].reject;
    x.killed = false;
    x.permit = rej ? 'rejected' : 'approved';
    events.push({ type: 'permitDecided', playerId: x.owner, siteId: x.id, plantType: x.type, approved: !rej });
  }
  // reservations
  for (const o of g.res) o.left--;
  g.res = g.res.filter((o) => o.left > 0);

  // rival turns
  const rivalActions: RivalActionLog[] = [];
  const rivalEvents: GameEvent[] = [];
  for (const p of g.players) {
    if (p.human || p.out) continue;
    const strategy = opponents[p.id - 1];
    if (!strategy) continue;
    const ev = await runTurnInPlace(g, p.id, strategy);
    rivalEvents.push(...ev);
    // the log is attributed to the rival, so tricks only appear if the actor is known anyway
    const visible = eventsForViewer(ev, human).filter((e) => !(e.type === 'trickSucceeded' && e.actorId === null));
    rivalActions.push({ playerId: p.id, events: visible });
  }

  // generation
  const st = new Map<PlayerId, { gen: number; val: number; store: number }>();
  for (const p of g.players) {
    p.genLast = 0;
    p.revLast = 0;
    st.set(p.id, { gen: 0, val: 0, store: 0 });
  }
  for (const x of g.sites) {
    if (!operating(x) || !x.type) continue;
    x.age++;
    if (x.fault) {
      if (r() < 0.2) {
        x.fault = false;
        events.push({ type: 'faultCleared', playerId: x.owner, siteId: x.id });
      }
      continue;
    }
    if (r() < 0.025) {
      x.fault = true;
      events.push({ type: 'plantFault', playerId: x.owner, siteId: x.id, cause: 'technical' });
      continue;
    }
    const s = st.get(x.owner)!;
    if (isStore(x.type)) s.store += storeRevenue(g, x);
    else {
      const e = genEstimate(g, x);
      const cls = PLANTS[x.type].cls as 'wind' | 'solar' | 'hydro';
      s.gen += e;
      s.val += e * price * CAPTURE[cls][g.q]!;
    }
    if (x.curtail > 0) x.curtail--;
  }
  // revenue and costs (contracts per player)
  const lines: ReportLine[] = [];
  let reportGen = 0;
  for (const p of g.players) {
    if (p.out) continue;
    const s = st.get(p.id)!;
    p.genLast = s.gen;
    p.co2 += s.gen * CO2;
    const L: ReportLine[] = [];
    const avgCap = s.gen > 0 ? s.val / s.gen : price;
    let left = s.gen;
    let ppa = 0;
    for (const c of p.contracts) {
      const d = Math.min(left, c.vol);
      const short = c.vol - d;
      left -= d;
      const v = d * c.price + short * (c.price - price * 1.15);
      ppa += v;
      L.push({ kind: 'ppa', amount: Math.round(v), buyer: c.buyer, shortfall: short });
      c.left--;
    }
    const spot = left * avgCap;
    L.push({ kind: 'spot', amount: Math.round(spot), mwh: left });
    L.push({ kind: 'storage', amount: Math.round(s.store) });
    const rev = spot + s.store + ppa;
    for (const c of p.contracts)
      if (c.left <= 0) events.push({ type: 'contractExpired', playerId: p.id, buyer: c.buyer });
    p.contracts = p.contracts.filter((c) => c.left > 0);
    p.cash += Math.round(rev);
    p.revLast = rev;
    let op = 0;
    let ls = 0;
    for (const x of g.sites) {
      if (x.owner !== p.id) continue;
      ls += x.lease * 0.02;
      if (x.built && x.type) op += PLANTS[x.type].opex;
    }
    const interest = p.loan * INTEREST;
    p.cash -= Math.round(op + ls + interest);
    L.push({ kind: 'opex', amount: -Math.round(op) });
    L.push({ kind: 'lease', amount: -Math.round(ls) });
    L.push({ kind: 'interest', amount: -Math.round(interest) });
    if (p.id === human) {
      reportGen = s.gen;
      lines.push(...L.filter((l) => l.amount !== 0));
    }
  }
  // price
  g.target *= 1.0025;
  g.base += (g.target - g.base) * 0.15 + gauss(r) * g.base * 0.06;
  g.base = clamp(g.base, 35, 260);
  // solvency
  for (const p of g.players) {
    if (p.out || p.cash >= 0) continue;
    const need = Math.ceil(-p.cash / 1e6) * 1e6;
    if (p.loan + need <= creditLimit(g, p)) {
      p.loan += need;
      p.cash += need;
      events.push({ type: 'loanTaken', playerId: p.id, amount: need, emergency: true });
    } else if (p.human) g.over = 'bankrupt';
    else {
      p.out = true;
      p.contracts = [];
      for (const x of g.sites) if (x.owner === p.id) resetSite(x);
      g.res = g.res.filter((o) => o.pid !== p.id);
      emit(g, events, { type: 'playerBankrupt', playerId: p.id });
    }
  }
  // next quarter
  g.q++;
  g.turn++;
  for (const p of g.players) p.trickUsed = 0;
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

  const reportEvents = eventsForViewer(
    [...events, ...rivalEvents.filter((e) => e.type === 'trickSucceeded' || e.type === 'trickFailed')].filter((e) =>
      concerns(e, human),
    ),
    human,
  );
  const report: QuarterReport = {
    year: reportYear,
    q: reportQ,
    lines,
    events: reportEvents,
    gen: reportGen,
    startCash,
    endCash: P.cash,
    price,
  };
  return { state: g, report, rivalActions };
}
