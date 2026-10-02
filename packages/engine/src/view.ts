import {
  INTEREST,
  MAX_CONTRACTS,
  MAX_TRICKS,
  MIN_CREDIT,
  PLANT_TYPE_KEYS,
  PLANTS,
  REGION_KEYS,
  RESERVE_COST,
  RESERVE_MW,
  RESERVE_QUARTERS,
  SELF_REPAIR_COST,
  TRICK_KEYS,
  TRICKS,
} from './data.js';
import { publicChallenge } from './challenges.js';
import { eventForViewer } from './events.js';
import { actionOptions } from './legal.js';
import {
  buildCost,
  clone,
  creditLimit,
  freeGrid,
  genEstimate,
  isStore,
  mwOf,
  myReserve,
  operating,
  rankOf,
  reserved,
  retryCost,
  sellValue,
  serviceCost,
  siteValue,
  storeRevenue,
  surveyCost,
  usedGrid,
  worth,
} from './rules.js';
import type {
  Action,
  ActionOption,
  ActionType,
  GameState,
  GridView,
  NewsItem,
  PlayerId,
  PlayerView,
  RegionKey,
  SiteView,
  TrickType,
} from './types.js';

/** The viewer's options for one action type (see `PlayerView.options`). */
export const optionsOf = <K extends ActionType>(
  v: PlayerView,
  type: K,
): (ActionOption & { action: Extract<Action, { type: K }> })[] =>
  v.options.filter((o) => o.action.type === type) as (ActionOption & { action: Extract<Action, { type: K }> })[];

/** Sites the viewer can target with a lobby trick (even if blocked by money or the quarterly limit). */
export const trickTargetIds = (v: PlayerView, trick: TrickType): string[] =>
  optionsOf(v, 'lobby')
    .filter((o) => o.action.trick === trick)
    .map((o) => o.action.siteId);

/** Everything player `pid` may know about the game (hidden information removed). */
export function playerView(g: GameState, pid: PlayerId): PlayerView {
  const me = g.players[pid];
  if (!me) throw new Error('unknown player');
  const sites: SiteView[] = g.sites.map((x) => {
    const mine = x.owner === pid;
    const surveyed = x.surveyed.includes(pid);
    const known = mine || surveyed;
    const v: SiteView = {
      id: x.id,
      r: x.r,
      i: x.i,
      owner: x.owner,
      type: x.type,
      permit: x.permit,
      built: x.built,
      fail: x.fail,
      grid: x.grid,
      fault: x.fault,
      curtail: x.curtail,
      lease: x.lease,
      surveyCost: surveyCost(x),
      surveyed,
      known,
      wind: known ? x.wind : null,
      sun: known ? x.sun : null,
      hydro: known ? x.hydro : null,
    };
    if (mine)
      v.own = {
        permitLeft: x.permitLeft,
        eff: x.eff,
        invested: x.invested,
        age: x.age,
        value: Math.round(siteValue(x)),
        sellValue: sellValue(x),
        genEstimate: operating(x) && !x.fault ? genEstimate(g, x) : 0,
        storeRevenue: x.type && isStore(x.type) && operating(x) ? Math.round(storeRevenue(g, x)) : 0,
      };
    return v;
  });
  const grid = {} as Record<RegionKey, GridView>;
  for (const r of REGION_KEYS) {
    const usedBy: Record<string, number> = {};
    for (const p of g.players) {
      const u = usedGrid(g, r, p.id);
      if (u) usedBy[p.id] = u;
    }
    grid[r] = {
      capacity: g.grid[r],
      used: usedGrid(g, r),
      usedBy,
      reserved: reserved(g, r),
      myReserved: myReserve(g, r, pid),
      free: Math.max(0, freeGrid(g, r, pid)),
    };
  }
  const costs = {} as PlayerView['costs'];
  for (const t of PLANT_TYPE_KEYS)
    costs[t] = {
      build: buildCost(g, t),
      retry: retryCost(g, t),
      permit: PLANTS[t].permit,
      grid: PLANTS[t].grid,
      service: serviceCost(t),
    };
  const tricks = {} as PlayerView['tricks'];
  for (const k of TRICK_KEYS) tricks[k] = { ...TRICKS[k] };
  const news: NewsItem[] = [];
  for (const n of g.news) {
    const e = eventForViewer(n.event, pid);
    if (e) news.push({ year: n.year, q: n.q, event: e });
  }
  const own = g.sites.filter((x) => x.owner === pid);
  return {
    playerId: pid,
    year: g.year,
    q: g.q,
    turn: g.turn,
    startYear: g.startYear,
    endYear: g.endYear,
    quartersLeft: Math.max(0, (g.endYear - g.year) * 4 - g.q),
    over: g.over,
    settings: { ...g.settings },
    me: {
      id: pid,
      name: me.name,
      cash: me.cash,
      loan: me.loan,
      worth: worth(g, me),
      rank: rankOf(g, me),
      creditLimit: creditLimit(g, me),
      mw: mwOf(g, pid),
      co2: me.co2,
      genLast: me.genLast,
      contracts: clone(me.contracts),
      tricksLeft: Math.max(0, MAX_TRICKS - me.trickUsed),
      nextGen: own
        .filter((x) => operating(x) && !x.fault && x.type && !isStore(x.type))
        .reduce((s, x) => s + genEstimate(g, x), 0),
      contractVolume: me.contracts.reduce((s, c) => s + c.vol, 0),
    },
    players: g.players.map((p) => ({
      id: p.id,
      name: p.name,
      human: p.human,
      cash: p.cash,
      loan: p.loan,
      out: p.out,
      worth: worth(g, p),
      sites: g.sites.filter((x) => x.owner === p.id).length,
      mw: mwOf(g, p.id),
      genLast: p.genLast,
      co2: p.co2,
      hist: [...p.hist],
    })),
    sites,
    grid,
    market: { price: g.price, spread: g.spread, priceHist: [...g.priceHist], spreadHist: [...g.spreadHist] },
    offers: clone(g.offers),
    costs,
    tricks,
    options: actionOptions(g, pid),
    constants: {
      maxContracts: MAX_CONTRACTS,
      interest: INTEREST,
      reserveMw: RESERVE_MW,
      reserveCost: RESERVE_COST,
      reserveQuarters: RESERVE_QUARTERS,
      selfRepairCost: SELF_REPAIR_COST,
      maxTricks: MAX_TRICKS,
      minCredit: MIN_CREDIT,
    },
    challenge: g.challenge && g.challenge.playerId === pid ? publicChallenge(g.challenge) : null,
    news,
  };
}
