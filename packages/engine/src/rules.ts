/** Rule helpers ported from legacy/src/core.js. All functions are pure or mutate only the given state. */
import { BUYERS, HOURS, MIN_CREDIT, NEWS_LIMIT, PLANTS, REGIONS, SEASON } from './data.js';
import { pick, rand, randint, randomOf } from './rng.js';
import type { GameEvent, GameState, Player, PlantType, PlayerId, RegionKey, Site, TrickType } from './types.js';

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const yearsIn = (g: GameState): number => g.year - g.startYear + g.q / 4;
export const learnF = (g: GameState, t: PlantType): number => Math.pow(1 - PLANTS[t].learn, yearsIn(g));
export const buildCost = (g: GameState, t: PlantType): number =>
  Math.round((PLANTS[t].build * learnF(g, t)) / 1e4) * 1e4;
export const retryCost = (g: GameState, t: PlantType): number => Math.round((buildCost(g, t) * 0.1) / 1e4) * 1e4;
export const serviceCost = (t: PlantType): number => Math.round((PLANTS[t].build * 0.04) / 1e4) * 1e4;
export const surveyCost = (x: Site): number => (x.r === 'ns' ? 0.3e6 : 0.05e6);

export const operating = (x: Site): boolean => x.owner >= 0 && x.built && x.grid;
export const isStore = (t: PlantType): boolean => PLANTS[t].cls === 'store';

export function capFactor(x: Site): number {
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
    PLANTS[x.type].mw *
    HOURS *
    capFactor(x) *
    SEASON[cls][q ?? g.q]! *
    x.eff *
    (x.curtail > 0 ? 0.5 : 1) *
    (q == null ? fx : 1)
  );
}

export function storeRevenue(g: GameState, x: Site): number {
  if (!x.type) return 0;
  const P = PLANTS[x.type];
  return (P.mwh ?? 0) * (P.cycles ?? 0) * g.spread * (P.eta ?? 0) * x.eff;
}

export function usedGrid(g: GameState, r: RegionKey, pid?: PlayerId): number {
  return g.sites
    .filter((x) => x.r === r && x.grid && x.type && (pid == null || x.owner === pid))
    .reduce((s, x) => s + PLANTS[x.type as PlantType].mw, 0);
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

export function siteValue(x: Site): number {
  let v = x.lease * 0.6;
  if (x.type && (x.permit === 'approved' || x.built)) v += PLANTS[x.type].permit;
  if (x.built) v += x.invested * Math.max(0.35, 1 - x.age / 100);
  if (x.grid && x.type) v += PLANTS[x.type].grid * 0.8;
  return v;
}
export const sellValue = (x: Site): number => Math.round(siteValue(x) * 0.85);

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
  g.sites.filter((x) => x.owner === pid && operating(x)).reduce((s, x) => s + PLANTS[x.type as PlantType].mw, 0);

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
  });
}

export function updateSpread(g: GameState): void {
  const re =
    800 +
    g.turn * 25 +
    g.sites
      .filter((x) => operating(x) && x.type && !isStore(x.type))
      .reduce((s, x) => s + PLANTS[x.type as PlantType].mw, 0);
  g.spread = Math.round(35 + 70 * Math.min(1, re / 3000) + g.spreadAdd + (g.fx ? g.fx.spread || 0 : 0));
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

/* ---------------- News ---------------- */

function isNews(g: GameState, e: GameEvent): boolean {
  const human = (pid: PlayerId) => !!g.players[pid]?.human;
  switch (e.type) {
    case 'gameStarted':
    case 'historicEvent':
    case 'worldEvent':
    case 'playerBankrupt':
    case 'trickSucceeded':
    case 'gridReserved':
      return true;
    case 'trickFailed':
      return e.caught;
    case 'siteLeased':
      return human(e.playerId) || e.amount >= 1.5e6;
    case 'plantBuilt':
    case 'gridConnected':
    case 'siteSold':
    case 'contractAccepted':
      return human(e.playerId);
    default:
      return false;
  }
}

/** Records an event and, if newsworthy, adds it to the news feed. */
export function emit(g: GameState, out: GameEvent[], e: GameEvent): void {
  out.push(e);
  if (isNews(g, e)) {
    g.news.unshift({ year: g.year, q: g.q, event: e });
    if (g.news.length > NEWS_LIMIT) g.news.pop();
  }
}

/** What a player may see of an event (null = hidden). */
export function eventForViewer(e: GameEvent, viewer: PlayerId): GameEvent | null {
  switch (e.type) {
    case 'siteSurveyed':
    case 'loanTaken':
    case 'loanRepaid':
    case 'actionRejected':
      return e.playerId === viewer ? e : null;
    case 'permitApplied':
      if (e.playerId === viewer) return e;
      return { ...e, quarters: undefined };
    case 'trickFailed':
      return e.actorId === viewer || e.caught ? e : null;
    case 'trickSucceeded':
      return e.actorId === viewer || e.suspected ? e : { ...e, actorId: null };
    default:
      return e;
  }
}

export const eventsForViewer = (events: GameEvent[], viewer: PlayerId): GameEvent[] =>
  events.map((e) => eventForViewer(e, viewer)).filter((e): e is GameEvent => e !== null);

export const regionOk = (r: unknown): r is RegionKey => typeof r === 'string' && r in REGIONS;
