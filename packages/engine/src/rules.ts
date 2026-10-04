/** Rule helpers ported from legacy/src/core.js. All functions are pure or mutate only the given state. */
import {
  AUTO_MINIGAME,
  AUTO_MINIGAME_HARD,
  BUYERS,
  HOURS,
  MIN_CREDIT,
  PLANTS,
  REGIONS,
  REPOWER_FACTOR,
  SEASON,
  STORE_MARKET_SHARE,
  plantDef,
  type AutoMinigameDef,
  type PlantDef,
} from './data.js';
import { pick, rand, randint, randomOf } from './rng.js';
import type {
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
export const autoMinigame = (difficulty: Difficulty | 'easy' | undefined, human: boolean): AutoMinigameDef =>
  !human && difficulty === 'hard' ? AUTO_MINIGAME_HARD : AUTO_MINIGAME;

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const yearsIn = (g: GameState): number => g.year - g.startYear + g.q / 4;
export const learnF = (g: GameState, t: PlantType): number => Math.pow(1 - PLANTS[t].learn, yearsIn(g));
export const buildCost = (g: GameState, t: PlantType, size: PlantSize = 'std'): number =>
  Math.round((plantDef(t, size).build * learnF(g, t)) / 1e4) * 1e4;
export const retryCost = (g: GameState, t: PlantType, size: PlantSize = 'std'): number =>
  Math.round((buildCost(g, t, size) * 0.1) / 1e4) * 1e4;
export const serviceCost = (t: PlantType, size: PlantSize = 'std'): number =>
  Math.round((plantDef(t, size).build * 0.04) / 1e4) * 1e4;

/** Size of the (planned) plant on a site; games stored before phase 7 only know `std`. */
export const sizeOf = (x: { size?: PlantSize }): PlantSize => x.size ?? 'std';
/** Plant data of a site with a type, for its size. */
export const siteDef = (x: { type: PlantType | null; size?: PlantSize }): PlantDef => plantDef(x.type!, sizeOf(x));
/** Capacity of the (planned) plant on a site in MW (0 without type). */
export const siteMw = (x: { type: PlantType | null; size?: PlantSize }): number => (x.type ? siteDef(x).mw : 0);
/** Price of repowering a standard plant to large: extra build costs with a surcharge, plus the bigger grid connection. */
export const repowerCost = (g: GameState, t: PlantType): number =>
  Math.round(((buildCost(g, t, 'large') - buildCost(g, t)) * REPOWER_FACTOR) / 1e4) * 1e4 +
  plantDef(t, 'large').grid -
  PLANTS[t].grid;
export const surveyCost = (x: Site): number => (x.r === 'ns' ? 0.3e6 : 0.05e6);

/** Owned, built and connected (a fault only pauses production). Works on sites and site views. */
export const operating = (x: Pick<Site, 'owner' | 'built' | 'grid'>): boolean => x.owner >= 0 && x.built && x.grid;
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
    res.set(x.id, { ownMwh: m, own: m * g.spread, market: (cap - m) * g.spread * STORE_MARKET_SHARE });
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

export type ValuedSite = Pick<Site, 'lease' | 'type' | 'permit' | 'built' | 'invested' | 'age' | 'grid' | 'size'>;

export function siteValue(x: ValuedSite): number {
  let v = x.lease * 0.6;
  if (x.type && (x.permit === 'approved' || x.built)) v += siteDef(x).permit;
  if (x.built) v += x.invested * Math.max(0.35, 1 - x.age / 100);
  if (x.grid && x.type) v += siteDef(x).grid * 0.8;
  return v;
}
export const sellValue = (x: ValuedSite): number => Math.round(siteValue(x) * 0.85);

export function worth(g: GameState, p: Player): number {
  let v = p.cash - p.loan;
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
    age: 0,
    killed: false,
    alt: null,
    size: 'std',
    offline: 0,
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

/** Does player `pid` hold a valid spy report on player `target`? */
export const hasIntel = (g: GameState, pid: PlayerId, target: PlayerId): boolean =>
  (g.players[pid]?.intel?.[target] ?? -1) >= g.turn;

/** Active detective agency of a player, if any. */
export const detectivesOf = (p: Player): NonNullable<Player['detectives']> | null =>
  p.detectives && p.detectives.left > 0 ? p.detectives : null;

export const regionOk = (r: unknown): r is RegionKey => typeof r === 'string' && r in REGIONS;
