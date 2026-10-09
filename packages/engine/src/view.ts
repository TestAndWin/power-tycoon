import {
  DETECTIVE_KEYS,
  DETECTIVE_QUARTERS,
  DETECTIVES,
  historicFor,
  CO2_BONUS,
  EXEC_EFFECTS,
  EXEC_GRADE_KEYS,
  HQ_LEVELS,
  INTEREST,
  INTEREST_RISK,
  MAX_CONTRACTS,
  PLANT_SIZE_KEYS,
  MAX_TRICKS,
  CREDIT_ASSETS,
  CREDIT_BOOST,
  CREDIT_BOOST_FROM,
  CREDIT_SALES,
  CREDIT_SALES_QUARTERS,
  MIN_CREDIT,
  PLANT_TYPE_KEYS,
  plantDef,
  REGION_KEYS,
  RESERVE_COST,
  RESERVE_MW,
  RESERVE_QUARTERS,
  SELF_REPAIR_COST,
  SPY_COST,
  SPY_QUARTERS,
  TRICK_KEYS,
  TRICKS,
} from './data.js';
import { awardProgress } from './awards.js';
import { publicChallenge } from './challenges.js';
import { decisionView } from './decisions.js';
import { eventForViewer } from './events.js';
import { actionOptions } from './legal.js';
import {
  autoMinigame,
  buildPrice,
  clone,
  creditLimit,
  creditParts,
  crowding,
  duelRivals,
  execCost,
  execPower,
  freeGrid,
  genEstimate,
  hasIntel,
  interestRate,
  isStore,
  lawsuitPeace,
  mwOf,
  myReserve,
  overhead,
  plantTypesFor,
  producing,
  rankOf,
  rejectChance,
  reserved,
  sellValue,
  serviceCost,
  siteMw,
  siteDef,
  siteValue,
  solarCannibal,
  solarLoad,
  storeCapacity,
  storeIncome,
  surveyCost,
  surveyLimit,
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
  PlantSize,
  Player,
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

/** The viewer's current costs per plant type for a plant size. */
export const costsFor = (v: PlayerView, size: PlantSize): PlayerView['costs'] =>
  size === 'large' ? v.costsLarge : v.costs;

/** Sites the viewer can target with a lobby trick (even if blocked by money or the quarterly limit). */
export const trickTargetIds = (v: PlayerView, trick: TrickType): string[] =>
  optionsOf(v, 'lobby')
    .filter((o) => o.action.trick === trick)
    .map((o) => o.action.siteId);

/** A player's detective agency with the quarters it still protects (the current one included). */
const detectivesView = (g: GameState, p: Player): PlayerView['me']['detectives'] =>
  p.detectives ? { level: p.detectives.level, left: p.detectives.until - g.turn + 1 } : null;

/** Odds of the automatic minigames of a human player without minigames (see `autoOutcome`). */
function autoOdds(p: Player): NonNullable<PlayerView['autoOdds']> {
  const M = autoMinigame(true);
  const duel = M.cableDuel + EXEC_EFFECTS.grid.duelChance * execPower(p, 'grid');
  return { rotor: M.rotor, cable: M.cable, cableDuel: duel, frequency: M.frequency };
}

/** Everything player `pid` may know about the game (hidden information removed). */
export function playerView(g: GameState, pid: PlayerId): PlayerView {
  const me = g.players[pid];
  if (!me) throw new Error('unknown player');
  // expected storage income of the viewer's own storages (same split as in the quarter, without faults)
  const myGen = new Map<string, number>();
  const myStores = g.sites.filter((x) => x.owner === pid && producing(x) && x.type && isStore(x.type));
  for (const x of g.sites)
    if (x.owner === pid && producing(x) && x.type && !isStore(x.type)) myGen.set(x.id, genEstimate(g, x));
  const myStore = storeIncome(g, myGen, myStores);
  // the rejection chance of a new application, wherever the viewer could apply (or lease and apply)
  const crowd = Object.fromEntries(REGION_KEYS.map((r) => [r, crowding(g, r)])) as Record<RegionKey, number>;
  const applyRisk = (x: GameState['sites'][number]): SiteView['permitRisk'] => {
    const types = plantTypesFor({ r: x.r, hydro: x.surveyed.includes(pid) || x.owner === pid ? x.hydro : null });
    const risk: NonNullable<SiteView['permitRisk']> = {};
    for (const t of types) {
      const r = {} as Record<PlantSize, number>;
      // a new application starts without the modifiers of the running one
      for (const size of PLANT_SIZE_KEYS)
        r[size] = rejectChance(g, { ...x, rejectMod: 0 }, plantDef(t, size).reject, pid, crowd[x.r]);
      risk[t] = r;
    }
    return risk;
  };
  const sites: SiteView[] = g.sites.map((x) => {
    const mine = x.owner === pid;
    const surveyed = x.surveyed.includes(pid);
    const spied = x.owner >= 0 && !mine && hasIntel(g, pid, x.owner);
    const known = mine || surveyed || spied;
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
      size: x.size,
      mw: siteMw(x),
      offline: x.offline,
      peace: lawsuitPeace(g, x),
    };
    if (spied) v.intel = { eff: x.eff, permitLeft: x.permitLeft };
    if (mine)
      v.own = {
        permitLeft: x.permitLeft,
        alt: x.alt ?? null,
        eff: x.eff,
        invested: x.invested,
        age: x.age,
        value: Math.round(siteValue(x)),
        sellValue: sellValue(x),
        genEstimate: producing(x) ? genEstimate(g, x) : 0,
        storeRevenue: Math.round((myStore.get(x.id)?.own ?? 0) + (myStore.get(x.id)?.market ?? 0)),
        storeOwnMwh: Math.round(myStore.get(x.id)?.ownMwh ?? 0),
        storeCapacity: x.type && isStore(x.type) ? Math.round(storeCapacity(x)) : 0,
        duelRisk: x.built && !x.grid && duelRivals(g, pid, x).length > 0,
        permitRisk: x.permit === 'pending' && x.type ? rejectChance(g, x, siteDef(x).reject) : null,
      };
    if (x.owner < 0 || (mine && !x.built)) v.permitRisk = applyRisk(x);
    return v;
  });
  const grid = {} as Record<RegionKey, GridView>;
  for (const r of REGION_KEYS) {
    const usedBy: Record<string, number> = {};
    for (const p of g.players) {
      const u = usedGrid(g, r, p.id);
      if (u) usedBy[p.id] = u;
    }
    const solar = solarLoad(g.sites, r);
    grid[r] = {
      capacity: g.grid[r],
      used: usedGrid(g, r),
      usedBy,
      reserved: reserved(g, r),
      myReserved: myReserve(g, r, pid),
      myReservations: g.res.filter((o) => o.r === r && o.pid === pid).map((o) => ({ mw: o.mw, left: o.left })),
      free: Math.max(0, freeGrid(g, r, pid)),
      solarMw: solar,
      solarLoss: 1 - [0, 1, 2, 3].reduce((s, q) => s + solarCannibal(solar, q), 0) / 4,
      crowding: crowd[r],
    };
  }
  const costs = {} as PlayerView['costs'];
  const costsLarge = {} as PlayerView['costsLarge'];
  for (const t of PLANT_TYPE_KEYS)
    for (const [size, into] of [
      ['std', costs],
      ['large', costsLarge],
    ] as const)
      into[t] = {
        build: buildPrice(g, me, t, size),
        retry: buildPrice(g, me, t, size, true),
        permit: plantDef(t, size).permit,
        grid: plantDef(t, size).grid,
        service: serviceCost(t, size),
      };
  const tricks = {} as PlayerView['tricks'];
  for (const k of TRICK_KEYS) tricks[k] = { ...TRICKS[k] };
  const detectives = {} as PlayerView['detectives'];
  for (const k of DETECTIVE_KEYS) {
    const { cost, shield, catchFailed, catchSucceeded } = DETECTIVES[k];
    detectives[k] = { cost, shield, catchFailed, catchSucceeded };
  }
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
    settings: { autoMinigames: g.settings.autoMinigames },
    me: {
      id: pid,
      name: me.name,
      cash: me.cash,
      loan: me.loan,
      worth: worth(g, me),
      rank: rankOf(g, me),
      creditLimit: creditLimit(g, me),
      credit: creditParts(g, me),
      mw: mwOf(g, pid),
      co2: me.co2,
      genLast: me.genLast,
      contracts: clone(me.contracts),
      tricksLeft: Math.max(0, MAX_TRICKS - me.trickUsed),
      surveysLeft: Math.max(0, surveyLimit(me) - me.surveyUsed),
      surveyLimit: surveyLimit(me),
      nextGen: own.filter((x) => producing(x) && x.type && !isStore(x.type)).reduce((s, x) => s + genEstimate(g, x), 0),
      contractVolume: me.contracts.reduce((s, c) => s + c.vol, 0),
      detectives: detectivesView(g, me),
      board: clone(me.board),
      gone: clone(me.gone ?? []),
      hq: me.hq,
      seats: HQ_LEVELS[me.hq].seats,
      overhead: overhead(g, me),
      interest: interestRate(g, me),
      discount:
        me.discount && me.discount.until >= g.turn
          ? { pct: me.discount.pct, left: me.discount.until - g.turn + 1 }
          : null,
      decision: decisionView(g, me),
      awards: clone(me.awards),
      awardProgress: {
        firstPlant: awardProgress(g, me, 'firstPlant'),
        offshore: awardProgress(g, me, 'offshore'),
        europe: awardProgress(g, me, 'europe'),
        mw500: awardProgress(g, me, 'mw500'),
        co2: awardProgress(g, me, 'co2'),
        storage: awardProgress(g, me, 'storage'),
      },
    },
    players: g.players.map((p) => ({
      ...(p.id !== pid && hasIntel(g, pid, p.id)
        ? {
            intel: {
              until: me.intel![p.id]!,
              contracts: clone(p.contracts),
              detectives: detectivesView(g, p),
              tricksLeft: Math.max(0, MAX_TRICKS - p.trickUsed),
              board: clone(p.board),
            },
          }
        : {}),
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
      hq: p.hq,
      awards: clone(p.awards),
    })),
    sites,
    grid,
    market: { price: g.price, spread: g.spread, priceHist: [...g.priceHist], spreadHist: [...g.spreadHist] },
    offers: clone(g.offers),
    costs,
    costsLarge,
    tricks,
    detectives,
    options: actionOptions(g, pid),
    execCosts: Object.fromEntries(EXEC_GRADE_KEYS.map((k) => [k, execCost(g, k)])) as PlayerView['execCosts'],
    autoOdds: g.settings.autoMinigames ? autoOdds(me) : null,
    constants: {
      maxContracts: MAX_CONTRACTS,
      interest: INTEREST,
      interestRisk: INTEREST_RISK,
      co2Bonus: CO2_BONUS,
      reserveMw: RESERVE_MW,
      reserveCost: RESERVE_COST,
      reserveQuarters: RESERVE_QUARTERS,
      selfRepairCost: SELF_REPAIR_COST,
      maxTricks: MAX_TRICKS,
      minCredit: MIN_CREDIT,
      creditAssets: CREDIT_ASSETS,
      creditSales: CREDIT_SALES,
      creditSalesQuarters: CREDIT_SALES_QUARTERS,
      creditBoost: CREDIT_BOOST,
      creditBoostFrom: CREDIT_BOOST_FROM,
      spyCost: SPY_COST,
      spyQuarters: SPY_QUARTERS,
      detectiveQuarters: DETECTIVE_QUARTERS,
    },
    challenge: g.challenge && g.challenge.playerId === pid ? publicChallenge(g.challenge) : null,
    news,
    milestones: historicFor(g.startYear, g.endYear)
      .filter((h) => (h.year - g.startYear) * 4 + h.q >= g.turn)
      .map((h) => ({ ...h })),
  };
}
