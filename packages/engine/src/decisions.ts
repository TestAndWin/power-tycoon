/**
 * Decision cards (phase 8): sometimes a player finds a card on the desk at the start of a quarter – a short
 * situation with two or three options. It is decided with the `decide` action; an open card gets its default
 * option at the end of the quarter. Rivals get the same cards.
 */
import { DECISION_CHANCE, DECISION_DATA, DECISIONS, EXEC_GRADES, HQ_LEVELS, type DecisionOptionDef } from './data.js';
import { emit } from './events.js';
import { pick, randomOf } from './rng.js';
import { isStore, producing, siteById, storeCapacity } from './rules.js';
import type {
  DecisionCard,
  DecisionKey,
  DecisionOptionView,
  DecisionView,
  GameEvent,
  GameState,
  Player,
  Site,
} from './types.js';

const ownSites = (g: GameState, p: Player): Site[] => g.sites.filter((x) => x.owner === p.id);

/** Land wind or solar projects of `p` whose permit is still being decided (citizens' protest). */
const protestable = (g: GameState, p: Player): Site[] =>
  ownSites(g, p).filter(
    (x) => x.permit === 'pending' && (x.type === 'wind' || x.type === 'solar') && (x.r === 'nd' || x.r === 'ib'),
  );
/** Free sites in regions where `p` already has sites (the community knows the company). */
const offeredSites = (g: GameState, p: Player): Site[] => {
  const regions = new Set(ownSites(g, p).map((x) => x.r));
  return g.sites.filter((x) => x.owner < 0 && regions.has(x.r));
};
const ownStores = (g: GameState, p: Player): Site[] =>
  ownSites(g, p).filter((x) => producing(x) && x.type && isStore(x.type));

/** What the grid operator pays for lending all own storages for a quarter (heat wave). */
export const heatwavePay = (g: GameState, p: Player): number =>
  Math.round(
    (ownStores(g, p).reduce((s, x) => s + storeCapacity(x) * g.spread, 0) * DECISION_DATA.heatwave.pay) / 1e4,
  ) * 1e4;

/** The card `key` for player `p` if its condition holds now (with the site or board member it is about). */
function cardFor(g: GameState, p: Player, key: DecisionKey): DecisionCard | null {
  const r = randomOf(g);
  const card = (extra: Partial<DecisionCard> = {}): DecisionCard => ({ key, turn: g.turn, ...extra });
  switch (key) {
    case 'citizens': {
      const xs = protestable(g, p);
      return xs.length ? card({ siteId: pick(r, xs).id }) : null;
    }
    case 'supplier':
      return !p.discount && ownSites(g, p).some((x) => x.type && !x.built && x.permit !== 'rejected') ? card() : null;
    case 'heatwave':
      return (g.q === 1 || g.q === 2) && ownStores(g, p).length ? card() : null;
    case 'grant':
      return card();
    case 'poach':
      return p.board.length ? card({ dept: pick(r, p.board).dept }) : null;
    case 'mayor': {
      const xs = offeredSites(g, p);
      return xs.length ? card({ siteId: pick(r, xs).id }) : null;
    }
  }
}

/** Deals new cards at the start of a quarter: each player without a card gets one with `DECISION_CHANCE`. */
export function dealDecisions(g: GameState, out: GameEvent[]): void {
  for (const p of g.players) {
    if (p.out || p.decision) continue;
    const r = randomOf(g);
    if (r() >= DECISION_CHANCE) continue;
    const cards = (Object.keys(DECISIONS) as DecisionKey[])
      .map((k) => cardFor(g, p, k))
      .filter((c): c is DecisionCard => c !== null);
    const total = cards.reduce((s, c) => s + DECISIONS[c.key].weight, 0);
    let n = r() * total;
    const card = cards.find((c) => (n -= DECISIONS[c.key].weight) <= 0);
    if (!card) continue;
    p.decision = card;
    emit(g, out, {
      type: 'decisionOffered',
      playerId: p.id,
      key: card.key,
      ...(card.siteId ? { siteId: card.siteId } : {}),
      ...(card.dept ? { dept: card.dept } : {}),
    });
  }
}

const salaryOf = (p: Player, card: DecisionCard): number => {
  const e = p.board.find((b) => b.dept === card.dept);
  return e ? EXEC_GRADES[e.grade].salary : 0;
};

/** Price, gain and chance of option `o` of `p`'s card. */
function optionNumbers(
  g: GameState,
  p: Player,
  card: DecisionCard,
  o: DecisionOptionDef,
): Omit<DecisionOptionView, 'key' | 'minHq' | 'default'> {
  const D = DECISION_DATA;
  const none = { cost: 0, gain: 0, chance: null };
  switch (card.key) {
    case 'citizens':
      if (o.key === 'talk') return { ...none, cost: D.citizens.talk.cost };
      if (o.key === 'report') return { ...none, cost: D.citizens.report.cost };
      return { ...none, chance: D.citizens.delay };
    case 'supplier':
      if (o.key === 'order') return { ...none, cost: D.supplier.order.cost };
      if (o.key === 'frame') return { ...none, cost: D.supplier.frame.cost };
      return none;
    case 'heatwave':
      return o.key === 'join' ? { ...none, gain: heatwavePay(g, p) } : none;
    case 'grant':
      if (o.key === 'apply') return { cost: D.grant.apply.cost, gain: D.grant.amount, chance: D.grant.apply.chance };
      if (o.key === 'lobbyist')
        return { cost: D.grant.lobbyist.cost, gain: D.grant.amount, chance: D.grant.lobbyist.chance };
      return none;
    case 'poach':
      if (o.key === 'raise') return { ...none, cost: D.poach.raise * salaryOf(p, card) };
      if (o.key === 'options') return { ...none, cost: D.poach.options * salaryOf(p, card) };
      return none;
    case 'mayor': {
      const x = siteById(g, card.siteId!)!;
      return o.key === 'lease' ? { ...none, cost: Math.round((x.lease * D.mayor.lease) / 5e4) * 5e4 } : none;
    }
  }
}

/** The card as the player sees it. */
export function decisionView(g: GameState, p: Player): DecisionView | null {
  const card = p.decision;
  if (!card) return null;
  return {
    key: card.key,
    ...(card.siteId ? { siteId: card.siteId } : {}),
    ...(card.dept ? { dept: card.dept } : {}),
    options: DECISIONS[card.key].options.map((o) => ({
      key: o.key,
      ...optionNumbers(g, p, card, o),
      minHq: o.minHq,
      default: !!o.default,
    })),
  };
}

/** Checks option `key` of `p`'s card: null if allowed; the price is checked by the caller. */
export function checkDecision(
  g: GameState,
  p: Player,
  key: unknown,
): 'noDecision' | 'invalidOption' | 'hqLocked' | 'invalidState' | null {
  const card = p.decision;
  if (!card) return 'noDecision';
  const o = DECISIONS[card.key].options.find((o) => o.key === key);
  if (!o) return 'invalidOption';
  if (p.hq < o.minHq) return 'hqLocked';
  if (card.key === 'mayor' && key === 'lease' && siteById(g, card.siteId!)!.owner >= 0) return 'invalidState';
  return null;
}

export const decisionPrice = (g: GameState, p: Player, key: string): number => {
  const card = p.decision!;
  const o = DECISIONS[card.key].options.find((o) => o.key === key)!;
  return optionNumbers(g, p, card, o).cost;
};

/** Applies option `key` of `p`'s card (checked and paid by the caller: `cost`) and closes the card. */
export function applyDecision(
  g: GameState,
  p: Player,
  key: string,
  cost: number,
  auto: boolean,
  out: GameEvent[],
): void {
  const card = p.decision!;
  p.decision = null;
  const r = randomOf(g);
  const D = DECISION_DATA;
  const x = card.siteId ? siteById(g, card.siteId) : undefined;
  const ev: Extract<GameEvent, { type: 'decisionTaken' }> = {
    type: 'decisionTaken',
    playerId: p.id,
    key: card.key,
    option: key,
    auto,
    cost,
    ...(card.siteId ? { siteId: card.siteId } : {}),
    ...(card.dept ? { dept: card.dept } : {}),
  };
  p.cash -= cost;
  // the project may have changed since the card was dealt (sold, decided)
  const stillPending = !!x && x.owner === p.id && x.permit === 'pending';
  switch (card.key) {
    case 'citizens':
      if (!stillPending) break;
      if (key === 'talk') x!.rejectMod -= D.citizens.talk.reject;
      else if (key === 'report') x!.rejectMod -= D.citizens.report.reject;
      else {
        ev.success = r() >= D.citizens.delay;
        if (!ev.success) x!.permitLeft++;
      }
      break;
    case 'supplier':
      if (key !== 'decline') {
        const d = key === 'frame' ? D.supplier.frame : D.supplier.order;
        p.discount = { pct: d.pct, until: g.turn + d.quarters - 1 };
      }
      break;
    case 'heatwave':
      if (key === 'join') {
        ev.gain = heatwavePay(g, p);
        p.cash += ev.gain;
        for (const s of ownStores(g, p)) s.offline = Math.max(s.offline, 1);
      }
      break;
    case 'grant':
      if (key !== 'skip') {
        ev.success = r() < (key === 'lobbyist' ? D.grant.lobbyist.chance : D.grant.apply.chance);
        if (ev.success) {
          ev.gain = D.grant.amount;
          p.cash += ev.gain;
        }
      }
      break;
    case 'poach':
      if (key === 'release') {
        const e = p.board.find((b) => b.dept === card.dept);
        if (e) {
          p.board = p.board.filter((b) => b !== e);
          out.push({ type: 'executiveLeft', playerId: p.id, dept: e.dept, grade: e.grade, cost: 0, poached: true });
        }
      }
      break;
    case 'mayor':
      if (key === 'lease' && x && x.owner < 0) {
        x.owner = p.id;
        emit(g, out, { type: 'siteLeased', playerId: p.id, siteId: x.id, amount: cost });
      }
      break;
  }
  out.push(ev);
}

/** End of the quarter: open cards get their default option (free). */
export function closeDecisions(g: GameState, out: GameEvent[]): void {
  for (const p of g.players) {
    if (p.out || !p.decision) continue;
    const def = DECISIONS[p.decision.key].options.find((o) => o.default)!;
    applyDecision(g, p, def.key, 0, true, out);
  }
}

/** Seats of the headquarters of `p` that are still free. */
export const freeSeats = (p: Player): number => HQ_LEVELS[p.hq].seats - p.board.length;
