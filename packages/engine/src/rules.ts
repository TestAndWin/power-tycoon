/** Rule helpers ported from legacy/src/core.js. All functions are pure or mutate only the given state. */
import {
  AUTO_MINIGAME,
  AUTO_MINIGAME_HARD,
  BUYERS,
  DETECTIVES,
  DUEL_SCARCITY,
  EXEC_EFFECTS,
  EXEC_GRADES,
  HOURS,
  HQ_BOOK,
  HQ_LEVELS,
  MAX_SURVEYS,
  MIN_CREDIT,
  PLANTS,
  REGIONS,
  REPOWER_FACTOR,
  SEASON,
  STORE_MARKET_SHARE,
  TRICK_CAUGHT,
  TRICKS,
  plantDef,
  type AutoMinigameDef,
  type PlantDef,
} from './data.js';
import { clamp, pick, rand, randint, randomOf } from './rng.js';
import type {
  Department,
  DetectiveLevel,
  Difficulty,
  GameState,
  Player,
  PlantSize,
  PlantType,
  PlayerId,
  RegionKey,
  Site,
  TrickType,
} from './types.js';

/** Automatic minigame outcomes for a rival (`human` false) or a player with `autoMinigames`. */
export const autoMinigame = (difficulty: Difficulty, human: boolean): AutoMinigameDef =>
  !human && difficulty === 'hard' ? AUTO_MINIGAME_HARD : AUTO_MINIGAME;

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const yearsIn = (g: GameState): number => g.year - g.startYear + g.q / 4;
export const learnF = (g: GameState, t: PlantType): number => Math.pow(1 - PLANTS[t].learn, yearsIn(g));
export const buildCost = (g: GameState, t: PlantType, size: PlantSize): number =>
  Math.round((plantDef(t, size).build * learnF(g, t)) / 1e4) * 1e4;
export const retryCost = (g: GameState, t: PlantType, size: PlantSize): number =>
  Math.round((buildCost(g, t, size) * 0.1) / 1e4) * 1e4;
export const serviceCost = (t: PlantType, size: PlantSize): number =>
  Math.round((plantDef(t, size).build * 0.04) / 1e4) * 1e4;

/** Plant data of a site with a type, for its size. */
export const siteDef = (x: { type: PlantType | null; size: PlantSize }): PlantDef => plantDef(x.type!, x.size);
/** Capacity of the (planned) plant on a site in MW (0 without type). */
export const siteMw = (x: { type: PlantType | null; size: PlantSize }): number => (x.type ? siteDef(x).mw : 0);
/** Extra capacity of a repowered plant (MW). */
export const repowerMw = (t: PlantType): number => plantDef(t, 'large').mw - PLANTS[t].mw;
/** The grid part of a repowering price: the bigger connection of the large plant. */
export const repowerGridCost = (t: PlantType): number => plantDef(t, 'large').grid - PLANTS[t].grid;
/** Price of repowering a standard plant to large: extra build costs with a surcharge, plus the bigger grid connection. */
export const repowerCost = (g: GameState, t: PlantType): number =>
  Math.round(((buildCost(g, t, 'large') - buildCost(g, t, 'std')) * REPOWER_FACTOR) / 1e4) * 1e4 + repowerGridCost(t);

/* ---------- board and headquarters ---------- */

/** Power of player `p`'s board member in department `d` (0 = vacant, junior 1, senior 2). */
export const execPower = (p: Pick<Player, 'board'> | undefined, d: Department): number => {
  const e = p?.board.find((b) => b.dept === d);
  return e ? EXEC_GRADES[e.grade].power : 0;
};
/** Salaries of the board and upkeep of the headquarters per quarter. */
export const salaries = (p: Pick<Player, 'board'>): number =>
  p.board.reduce((s, e) => s + EXEC_GRADES[e.grade].salary, 0);
export const overhead = (p: Pick<Player, 'board' | 'hq'>): number => salaries(p) + HQ_LEVELS[p.hq].upkeep;
/** Yield surveys player `p` may order per quarter. */
export const surveyLimit = (p: Player): number => MAX_SURVEYS + EXEC_EFFECTS.dev.surveys * execPower(p, 'dev');
/** Rejection chance of a permit application for plant data `reject` on site `x`. */
export const rejectChance = (g: GameState, x: Site, reject: number): number =>
  clamp(reject + x.rejectMod - EXEC_EFFECTS.dev.reject * execPower(g.players[x.owner], 'dev'), 0.01, 1);
/** Build-cost factor of player `p` (supplier discount from a decision card). */
const discountF = (g: GameState, p: Player): number =>
  p.discount && p.discount.until >= g.turn ? 1 - p.discount.pct : 1;
/** What player `p` pays to build (or retry) a plant. */
export const buildPrice = (g: GameState, p: Player, t: PlantType, size: PlantSize, retry = false): number =>
  Math.round(((retry ? retryCost(g, t, size) : buildCost(g, t, size)) * discountF(g, p)) / 1e4) * 1e4;
/** What player `p` pays to repower (grid & engineering board member: cheaper). */
export const repowerPrice = (g: GameState, p: Player, t: PlantType): number =>
  Math.round((repowerCost(g, t) * (1 - EXEC_EFFECTS.grid.repower * execPower(p, 'grid'))) / 1e4) * 1e4;

export const surveyCost = (x: Site): number => (x.r === 'ns' ? 0.3e6 : 0.05e6);

/** Owned, built and connected (a fault only pauses production). Works on sites and site views. */
export const operating = (x: Pick<Site, 'owner' | 'built' | 'grid'>): boolean => x.owner >= 0 && x.built && x.grid;
/** Operating and producing this quarter: no fault and not offline for repowering. */
export const producing = (x: Pick<Site, 'owner' | 'built' | 'grid' | 'fault' | 'offline'>): boolean =>
  operating(x) && !x.fault && x.offline <= 0;
/** A plant (or approved project) that will need a grid connection: built or approved, not connected. */
export const waitingForGrid = (x: Pick<Site, 'type' | 'grid' | 'built' | 'permit'>): boolean =>
  !!x.type && !x.grid && (x.built || x.permit === 'approved');
export const isStore = (t: PlantType): boolean => PLANTS[t].cls === 'store';

/** Plant types allowed on a site: the region's types, hydro and pump only with a (known) slope. */
export const plantTypesFor = (x: { r: RegionKey; hydro: boolean | null }): PlantType[] =>
  REGIONS[x.r].types.filter((t) => !((t === 'hydro' || t === 'pump') && x.hydro !== true));

export function capFactor(x: Pick<Site, 'type' | 'wind' | 'sun'>): number {
  const t = x.type;
  if (t === 'wind' || t === 'off') return 0.08 + ((x.wind ?? 0) - 4.5) * 0.075;
  if (t === 'solar') return (x.sun ?? 0) / 8760;
  if (t === 'hydro') return 0.5;
  return 0;
}

/** Expected generation in MWh. With `q` given, weather effects (fx) are ignored. */
export function genEstimate(g: GameState, x: Site, q?: number): number {
  if (!x.type || isStore(x.type)) return 0;
  const cls = PLANTS[x.type].cls as 'wind' | 'solar' | 'hydro';
  const fx = g.fx ? g.fx[cls] : 1;
  return (
    siteMw(x) * HOURS * capFactor(x) * SEASON[cls][q ?? g.q]! * x.eff * (x.curtail > 0 ? 0.5 : 1) * (q == null ? fx : 1)
  );
}

/** MWh a storage plant can shift per quarter. */
export function storeCapacity(x: Pick<Site, 'type' | 'eff' | 'size'>): number {
  if (!x.type) return 0;
  const P = siteDef(x);
  return (P.mwh ?? 0) * (P.cycles ?? 0) * (P.eta ?? 0) * x.eff;
}

export interface StoreIncome {
  /** MWh taken from the owner's own plants in the same region. */
  ownMwh: number;
  /** Revenue from the own MWh (full spread). */
  own: number;
  /** Revenue from the rest of the capacity, charged from the market. */
  market: number;
}

/**
 * Storage revenue per storage site. Each storage first takes the generation (`gen`, MWh per site id) of its
 * owner's plants in the same region and sells it later at the full spread; the remaining capacity trades on
 * the market at `STORE_MARKET_SHARE` of the spread. Several storages of one owner share that generation in
 * site order.
 */
export function storeIncome(g: GameState, gen: ReadonlyMap<string, number>, stores: Site[]): Map<string, StoreIncome> {
  const pool = new Map<string, number>();
  for (const x of g.sites) {
    const e = gen.get(x.id);
    if (e) pool.set(x.owner + x.r, (pool.get(x.owner + x.r) ?? 0) + e);
  }
  const res = new Map<string, StoreIncome>();
  for (const x of stores) {
    const cap = storeCapacity(x),
      avail = pool.get(x.owner + x.r) ?? 0,
      m = Math.min(cap, avail);
    pool.set(x.owner + x.r, avail - m);
    const share = STORE_MARKET_SHARE + EXEC_EFFECTS.trade.storeShare * execPower(g.players[x.owner], 'trade');
    res.set(x.id, { ownMwh: m, own: m * g.spread, market: (cap - m) * g.spread * share });
  }
  return res;
}

export function usedGrid(g: GameState, r: RegionKey, pid?: PlayerId): number {
  return g.sites
    .filter((x) => x.r === r && x.grid && x.type && (pid == null || x.owner === pid))
    .reduce((s, x) => s + siteMw(x), 0);
}
export const reserved = (g: GameState, r: RegionKey, exceptPid?: PlayerId): number =>
  g.res.filter((o) => o.r === r && o.pid !== exceptPid).reduce((s, o) => s + o.mw, 0);
export const myReserve = (g: GameState, r: RegionKey, pid: PlayerId): number =>
  g.res.filter((o) => o.r === r && o.pid === pid).reduce((s, o) => s + o.mw, 0);
export const freeGrid = (g: GameState, r: RegionKey, pid: PlayerId): number =>
  g.grid[r] - usedGrid(g, r) - reserved(g, r, pid);
/** Capacity that is neither used nor reserved by anybody. */
export const unreservedGrid = (g: GameState, r: RegionKey): number => g.grid[r] - usedGrid(g, r) - reserved(g, r);

/**
 * Other players that could race player `pid` for the grid connection of `x` in a cable duel: only when the free
 * capacity is scarce and the player's own reservations do not cover the plant; only those with a project of
 * their own waiting for the grid in the region (a mere site there is no reason for a duel).
 */
export function duelRivals(g: GameState, pid: PlayerId, x: Site): PlayerId[] {
  const mw = siteMw(x);
  if (freeGrid(g, x.r, pid) >= DUEL_SCARCITY * mw || myReserve(g, x.r, pid) >= mw) return [];
  const waiting = g.sites.filter(
    (y) => y.r === x.r && y.owner >= 0 && y.owner !== pid && !g.players[y.owner]!.out && waitingForGrid(y),
  );
  return [...new Set(waiting.map((y) => y.owner))].sort((a, b) => a - b);
}

export function consumeReserve(g: GameState, r: RegionKey, pid: PlayerId, mw: number): void {
  for (const o of g.res) {
    if (o.r === r && o.pid === pid && mw > 0) {
      const t = Math.min(o.mw, mw);
      o.mw -= t;
      mw -= t;
    }
  }
  g.res = g.res.filter((o) => o.mw > 0);
}

export type ValuedSite = Pick<
  Site,
  'lease' | 'type' | 'permit' | 'built' | 'invested' | 'permitPaid' | 'gridPaid' | 'age' | 'grid'
>;

/** Book value of a site from what was paid for it: lease, permit, plant (depreciated) and grid connection. */
export function siteValue(x: ValuedSite): number {
  let v = x.lease * 0.6;
  if (x.type && (x.permit === 'approved' || x.built)) v += x.permitPaid;
  if (x.built) v += x.invested * Math.max(0.35, 1 - x.age / 100);
  if (x.grid && x.type) v += x.gridPaid * 0.8;
  return v;
}
export const sellValue = (x: ValuedSite): number => Math.round(siteValue(x) * 0.85);

export function worth(g: GameState, p: Player): number {
  let v = p.cash - p.loan + p.hqPaid * HQ_BOOK;
  for (const x of g.sites) if (x.owner === p.id) v += siteValue(x);
  return Math.round(v);
}
export const creditLimit = (g: GameState, p: Player): number =>
  Math.max(MIN_CREDIT, Math.floor(((worth(g, p) + p.loan) * 0.6) / 1e6) * 1e6);
export function rankOf(g: GameState, p: Player): number {
  return (
    g.players
      .filter((q) => !q.out)
      .sort((a, b) => worth(g, b) - worth(g, a))
      .indexOf(p) + 1
  );
}
export const mwOf = (g: GameState, pid: PlayerId): number =>
  g.sites.filter((x) => x.owner === pid && operating(x)).reduce((s, x) => s + siteMw(x), 0);

export function resetSite(x: Site): void {
  Object.assign(x, {
    owner: -1,
    type: null,
    permit: null,
    permitLeft: 0,
    built: false,
    fail: false,
    grid: false,
    eff: 1,
    fault: false,
    curtail: 0,
    invested: 0,
    permitPaid: 0,
    gridPaid: 0,
    age: 0,
    killed: false,
    alt: null,
    size: 'std',
    offline: 0,
    rejectMod: 0,
  });
}

/** Storage spread from the turn, the operating renewable capacity (MW) and the permanent additions. */
export const spreadFor = (turn: number, renewableMw: number, add: number): number =>
  35 + 70 * Math.min(1, (800 + turn * 25 + renewableMw) / 3000) + add;

export function updateSpread(g: GameState): void {
  const mw = g.sites.filter((x) => operating(x) && x.type && !isStore(x.type)).reduce((s, x) => s + siteMw(x), 0);
  g.spread = Math.round(spreadFor(g.turn, mw, g.spreadAdd + (g.fx ? g.fx.spread || 0 : 0)));
}

export function genOffers(g: GameState): void {
  const r = randomOf(g);
  g.offers = g.offers.filter((o) => o.expires > g.turn);
  while (g.offers.length < 3) {
    const vol = Math.round(pick(r, [5, 8, 10, 15, 20, 30, 40]) * g.ppaBoost) * 1000;
    g.offers.push({
      id: g.nextId++,
      buyer: pick(r, BUYERS),
      vol,
      quarters: randint(r, 4, 16),
      price: Math.round(g.base * rand(r, 0.95, 1.2)),
      expires: g.turn + randint(r, 1, 3),
    });
  }
}

export function trickTargets(g: GameState, type: TrickType, pid: PlayerId): Site[] {
  return g.sites.filter(
    (x) =>
      x.owner >= 0 &&
      x.owner !== pid &&
      !g.players[x.owner]!.out &&
      (type === 'klage'
        ? x.permit === 'pending' || (x.permit === 'approved' && !x.built)
        : type === 'bi'
          ? operating(x) && (x.type === 'wind' || x.type === 'solar') && x.curtail <= 0 && !x.fault
          : operating(x) && !x.fault),
  );
}

export const siteById = (g: GameState, id: string): Site | undefined => g.sites.find((s) => s.id === id);

/**
 * First turn of a term that protects against the other players: the current one, or the next if the term
 * begins at the quarter end, where the human has already acted.
 */
export const termStart = (g: GameState): number => g.turn + (g.phase === 'quarterEnd' ? 1 : 0);

/** Does player `pid` hold a valid spy report on player `target`? */
export const hasIntel = (g: GameState, pid: PlayerId, target: PlayerId): boolean =>
  (g.players[pid]?.intel[target] ?? -1) >= g.turn;

/**
 * Odds of a lobby trick against a target with the given detective agency (null = none): success, and the chance
 * that the actor is caught after a failure or after a success.
 */
export function trickOdds(
  trick: TrickType,
  detectives: DetectiveLevel | null | undefined,
  actorLaw = 0,
): { success: number; caughtIfFailed: number; caughtIfSucceeded: number } {
  const T = TRICKS[trick],
    D = detectives ? DETECTIVES[detectives] : null;
  // a lawsuit is legal: nobody is caught; the actor's legal department covers tracks
  const catchable = T.fine > 0 ? 1 - EXEC_EFFECTS.law.caught * actorLaw : 0;
  return {
    success: T.chance * (D?.shield ?? 1),
    caughtIfFailed: catchable * (D?.catchFailed ?? TRICK_CAUGHT),
    caughtIfSucceeded: catchable * (D?.catchSucceeded ?? 0),
  };
}

export const regionOk = (r: unknown): r is RegionKey => typeof r === 'string' && r in REGIONS;
