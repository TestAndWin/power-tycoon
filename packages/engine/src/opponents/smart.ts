/**
 * Stronger rule-based rival (phase 6). Instead of the legacy fixed thresholds it values every
 * project by its expected contribution to net worth at the end of the game:
 * remaining operating quarters × (revenue − running costs) + book value at the end − investment.
 *
 * It only sees its PlayerView and only acts through actions (same rules as the player).
 * Difficulty is a set of parameters, see `SMART_PARAMS`. The `hard` level adds a market forecast
 * (price trend, announced milestones, this quarter's world event, storage spread, grid capacity),
 * end-of-game accounting, selling of dead projects, diversification and sharper lobby tricks.
 */
import {
  CAPTURE,
  historicFor,
  HOURS,
  PLANT_SIZE_KEYS,
  PLANTS,
  plantDef,
  PRICE_FOLLOW,
  PRICE_SEASON,
  REGIONS,
  SEASON,
  STORE_MARKET_SHARE,
  TARGET_DRIFT,
  TRICKS,
  WORLD_EVENTS,
  type AutoMinigameDef,
  type HistoricDef,
  type PlantDef,
} from '../data.js';
import { clamp, type Random } from '../rng.js';
import {
  autoMinigame,
  capFactor as siteCapFactor,
  plantTypesFor,
  repowerGridCost,
  repowerMw,
  siteValue,
  spreadFor,
  trickOdds,
} from '../rules.js';
import { costsFor, trickTargetIds } from '../view.js';
import type {
  Action,
  OpponentContext,
  OpponentStrategy,
  PlantSize,
  PlantType,
  PlayerId,
  PlayerSummary,
  PlayerView,
  RegionKey,
  SiteView,
  TrickType,
} from '../types.js';

export interface SmartParams {
  /** Max. own projects that are leased but not yet producing. */
  maxPending: number;
  /** New leases per quarter. */
  leasesPerTurn: number;
  /** Unknown sites surveyed per quarter. */
  surveysPerTurn: number;
  /** Share of the credit limit the rival is willing to use. */
  debtRatio: number;
  /** Cash kept for running costs, as a multiple of one quarter's costs (min. 2 M€). */
  bufferQuarters: number;
  /** Minimum expected net gain of a new project relative to its investment. */
  minRoi: number;
  /** Accept PPA contracts that are covered by own generation. */
  contracts: boolean;
  /** Reserve grid capacity for own projects that will need it soon. */
  reservations: boolean;
  /** Probability per quarter to consider lobby tricks at all. */
  trickRate: number;
  /** Required ratio of expected harm to the leader vs. expected own cost of a trick. */
  trickEdge: number;
  /** Extra weight on harming the human player (tricks). */
  humanBias: number;
  /** Planning noise (0 = perfect estimates); a fixed misjudgement per site and plant type. */
  noise: number;
  /**
   * Forecast price, storage spread and grid capacity per quarter from the price trend, the announced
   * milestones and this quarter's world event (instead of today's values for the whole game).
   */
  foresight: boolean;
  /** Survey the unknown sites with the best expected return first (offshore too), more with spare cash. */
  valueSurveys: boolean;
  /** Keep leasing while a project still pays off before the end; count unfinished projects correctly. */
  lateGame: boolean;
  /** Raise the project limits with the financing room that is not yet committed. */
  scaleWithCash: boolean;
  /** Sell sites that will not pay off any more (stuck in a full grid, no viable plant). */
  sellStuck: boolean;
  /** Prefer regions where the rival is not yet concentrated. */
  diversify: boolean;
  /** Value tricks by the target's real loss (season, timing, end of game) and use all tricks of a quarter. */
  trickTiming: boolean;
  /**
   * Strike back at a human player that was caught or suspected tricking this rival. Rivals keep no
   * grudges against each other: feuds between them would only help the human.
   */
  revenge: boolean;
  /** Detective agency hired after an attack (null = never). */
  detectives: 'basic' | 'pro' | null;
  /**
   * Go for big projects (offshore) as soon as they can be financed: count the operating cash flow until the
   * plant is built, and do not prefer small projects while the financing room covers the big one.
   */
  bigProjects: boolean;
}

export type SmartLevel = 'normal' | 'hard';

export const SMART_PARAMS: Record<SmartLevel, SmartParams> = {
  normal: {
    maxPending: 3,
    leasesPerTurn: 1,
    surveysPerTurn: 2,
    debtRatio: 0.7,
    bufferQuarters: 2,
    minRoi: 0.1,
    contracts: true,
    reservations: false,
    trickRate: 0.15,
    trickEdge: 3,
    humanBias: 1,
    noise: 0.15,
    foresight: false,
    valueSurveys: false,
    lateGame: false,
    scaleWithCash: false,
    sellStuck: false,
    diversify: false,
    trickTiming: false,
    revenge: false,
    detectives: 'basic',
    bigProjects: false,
  },
  hard: {
    maxPending: 5,
    leasesPerTurn: 2,
    surveysPerTurn: 3,
    debtRatio: 1,
    bufferQuarters: 1.5,
    minRoi: 0.05,
    contracts: true,
    reservations: true,
    trickRate: 0.5,
    trickEdge: 2,
    humanBias: 1.5,
    noise: 0.05,
    foresight: true,
    valueSurveys: true,
    lateGame: true,
    scaleWithCash: true,
    sellStuck: true,
    diversify: true,
    trickTiming: true,
    revenge: true,
    detectives: 'pro',
    bigProjects: true,
  },
};

type Cls = 'wind' | 'solar' | 'hydro';
type Stage = 'new' | 'leased' | 'approved' | 'built';
/** Generation and price factors of the current quarter (world event). */
type QuarterFx = { wind: number; solar: number; hydro: number; price: number; spread: number };

/** Quarters after which a past price step is assumed to be fully in the recent prices. */
const PRICE_MEMORY = 8;
/** Quarters a tricked player is remembered (revenge). */
const GRUDGE_QUARTERS = 8;
/** Quarters an attack on the rival makes it hire detectives. */
const ALERT_QUARTERS = 4;

/** Capacity factor from what the viewer knows; unknown sites use the regional average. */
function capFactor(x: SiteView, t: PlantType): number {
  const R = REGIONS[x.r];
  const wind = x.wind ?? (R.wind ? (R.wind[0] + R.wind[1]) / 2 : 0);
  const sun = x.sun ?? (R.sun ? (R.sun[0] + R.sun[1]) / 2 : 0);
  return siteCapFactor({ type: t, wind, sun });
}

const avgPermitQ = (P: PlantDef): number => (P.permitQ[0] + P.permitQ[1]) / 2;

export class SmartOpponent implements OpponentStrategy {
  readonly params: SmartParams;
  constructor(level: SmartLevel | SmartParams = 'normal') {
    this.params = typeof level === 'string' ? SMART_PARAMS[level] : level;
  }
  async explore(view: PlayerView, _legal: Action[], ctx: OpponentContext): Promise<Action[]> {
    return new Planner(view, ctx, this.params).explore();
  }
  async decide(view: PlayerView, _legal: Action[], ctx: OpponentContext): Promise<Action[]> {
    return new Planner(view, ctx, this.params).plan();
  }
}

class Planner {
  private readonly acts: Action[] = [];
  private cash: number;
  private loan: number;
  private readonly free: Record<RegionKey, number>;
  private readonly basePrice: number;
  private readonly me: PlayerView['me'];
  private readonly R: Random;
  /** Quarters until the end, including the current one (at least 1). */
  private readonly left: number;
  /** Expected spot price and storage spread per quarter from now (index 0 = this quarter). */
  private readonly price: number[] = [];
  private readonly spread: number[] = [];
  private readonly fxNow: QuarterFx = { wind: 1, solar: 1, hydro: 1, price: 1, spread: 0 };
  /** Grid capacity others will probably take before a new project of ours (MW). */
  private readonly othersClaim: Record<RegionKey, number> = { nd: 0, ns: 0, ib: 0, al: 0 };
  private readonly sold = new Set<string>();
  /** Memo of `storeShare` for this plan. */
  private readonly shares = new Map<string, number>();
  /** Ignore the other players' claims and reservations (selling decisions must not be too pessimistic). */
  private optimisticGrid = false;
  private readonly builtNow = new Set<string>();
  private readonly connectedNow = new Set<string>();
  /** Projects leased in this turn (not yet in the view). */
  private readonly leasedNow: { x: SiteView; t: PlantType; size: PlantSize }[] = [];
  /** Milestones of this game (squeezed into its length). */
  private readonly hist: HistoricDef[];
  /** Expected outcomes of the own (automatic) minigames. */
  private readonly mg: AutoMinigameDef;

  constructor(
    private readonly v: PlayerView,
    private readonly ctx: OpponentContext,
    private readonly p: SmartParams,
  ) {
    this.me = v.me;
    this.mg = autoMinigame(v.settings.difficulty, !!v.players[v.me.id]?.human);
    this.cash = v.me.cash;
    this.loan = v.me.loan;
    this.R = ctx.random;
    this.left = Math.max(1, v.quartersLeft);
    this.free = Object.fromEntries(Object.entries(v.grid).map(([k, g]) => [k, g.free])) as Record<RegionKey, number>;
    this.basePrice = v.market.price / PRICE_SEASON[v.q]!;
    this.hist = historicFor(v.startYear, v.endYear);
    if (p.foresight) this.forecast();
  }

  /* ---------- market forecast ---------- */

  private qAt(k: number): number {
    return (this.v.q + k) % 4;
  }

  /** Quarters from now until a milestone (0 = applied in this quarter, negative = past). */
  private inQuarters(year: number, q: number): number {
    return (year - this.v.startYear) * 4 + q - this.v.turn;
  }

  private histIn(k: number): HistoricDef | undefined {
    return this.hist.find((h) => this.inQuarters(h.year, h.q) === k);
  }

  /**
   * Mirrors the engine's price model (`movePrice`): the base price follows a slowly rising target.
   * The target is estimated from the recent prices, plus milestones and this quarter's world event,
   * which are applied before the rivals act but are not yet part of the shown price.
   */
  private forecast(): void {
    const v = this.v;
    const now = v.news.flatMap((n) =>
      n.year === v.year && n.q === v.q && n.event.type === 'worldEvent' ? [WORLD_EVENTS[n.event.key]] : [],
    );
    for (const E of now)
      for (const f of ['wind', 'solar', 'hydro', 'price', 'spread'] as const)
        if (E[f] !== undefined) this.fxNow[f] = E[f];
    const hist = v.market.priceHist;
    const recent = hist.slice(-4).map((p, i, a) => p / PRICE_SEASON[(hist.length - a.length + i) % 4]!);
    let target = recent.length ? recent.reduce((s, p) => s + p, 0) / recent.length : this.basePrice;
    let base = this.basePrice;
    for (const h of this.hist) {
      const k = this.inQuarters(h.year, h.q);
      // past milestones: the part of the step the price has not followed yet
      if (h.target && k <= 0 && k > -PRICE_MEMORY) target *= 1 + (h.target - 1) * Math.pow(1 - PRICE_FOLLOW, -k);
    }
    for (const E of now) {
      base *= E.base ?? 1;
      target *= E.target ?? 1;
    }
    this.price.push(v.market.price * this.fxNow.price);
    for (let k = 1; k < this.left; k++) {
      target *= TARGET_DRIFT;
      base += (target - base) * PRICE_FOLLOW;
      this.price.push(base * PRICE_SEASON[this.qAt(k)]!);
      target *= this.histIn(k)?.target ?? 1;
    }
    // storage spread: grows with the renewable capacity (see `updateSpread`) and the milestones
    const mw = v.sites
      .filter((x) => x.owner >= 0 && x.built && x.grid && x.type && PLANTS[x.type].cls !== 'store')
      .reduce((s, x) => s + x.mw, 0);
    const growth = mw / Math.max(4, v.turn);
    let add = this.hist.filter((h) => this.inQuarters(h.year, h.q) <= 0).reduce((s, h) => s + (h.spread ?? 0), 0);
    for (let k = 0; k < this.left; k++) {
      if (k > 0) add += this.histIn(k)?.spread ?? 0;
      this.spread.push(spreadFor(v.turn + k, mw + growth * k, add + (k === 0 ? this.fxNow.spread : 0)));
    }
    // grid: projects of other players that will connect before ours
    for (const x of v.sites) {
      if (x.owner < 0 || x.owner === this.me.id || !x.type || x.grid) continue;
      if (x.built) this.othersClaim[x.r] += x.mw;
      else if (x.permit === 'approved') this.othersClaim[x.r] += x.mw * 0.5;
    }
  }

  /* ---------- economics ---------- */

  private mine(): SiteView[] {
    return this.v.sites.filter((x) => x.owner === this.me.id && !this.sold.has(x.id));
  }

  /** Expected revenue of one operating quarter, averaged over the seasons (without foresight). */
  private quarterRevenue(x: SiteView, t: PlantType, size: PlantSize, eff = 1): number {
    const P = plantDef(t, size);
    if (P.cls === 'store') {
      // spread grows with the share of renewables; assume a bit more than today on average
      const spread = this.v.market.spread * 1.1;
      return (P.mwh ?? 0) * (P.cycles ?? 0) * spread * (P.eta ?? 0) * eff * this.storeShare(x, t, size, eff);
    }
    const cls = P.cls as Cls;
    let s = 0;
    for (let q = 0; q < 4; q++) s += SEASON[cls][q]! * CAPTURE[cls][q]! * PRICE_SEASON[q]!;
    return P.mw * HOURS * capFactor(x, t) * (s / 4) * this.basePrice * eff;
  }

  /** Expected revenue in quarter `k` from now (0 = this quarter, incl. its world event). */
  private revenueAt(x: SiteView, t: PlantType, size: PlantSize, k: number, eff = 1): number {
    if (!this.p.foresight) return this.quarterRevenue(x, t, size, eff);
    if (k >= this.left) return 0;
    const P = plantDef(t, size);
    if (P.cls === 'store')
      return (P.mwh ?? 0) * (P.cycles ?? 0) * this.spread[k]! * (P.eta ?? 0) * eff * this.storeShare(x, t, size, eff);
    const cls = P.cls as Cls;
    const q = this.qAt(k);
    const fx = k === 0 ? this.fxNow[cls] : 1;
    return P.mw * HOURS * capFactor(x, t) * SEASON[cls][q]! * CAPTURE[cls][q]! * this.price[k]! * eff * fx;
  }

  /**
   * Share of the spread a storage of type `t` on `x` earns: full for the part it can fill from our own plants
   * in the region (planned ones included), `STORE_MARKET_SHARE` for the rest. Other own storages there take
   * their capacity first.
   */
  private storeShare(x: SiteView, t: PlantType, size: PlantSize, eff: number): number {
    // the same for every quarter of a valuation: computed once per plan (until a site is sold)
    const key = `${x.id}|${t}|${eff}|${size}`;
    let share = this.shares.get(key);
    if (share === undefined) this.shares.set(key, (share = this.computeStoreShare(x, t, eff, size)));
    return share;
  }

  private computeStoreShare(x: SiteView, t: PlantType, eff: number, size: PlantSize): number {
    const P = plantDef(t, size);
    const cap = (P.mwh ?? 0) * (P.cycles ?? 0) * (P.eta ?? 0) * eff;
    if (cap <= 0) return STORE_MARKET_SHARE;
    let avail = 0;
    for (const y of this.mine()) {
      if (y.r !== x.r || y.id === x.id || !y.type) continue;
      const Q = plantDef(y.type, y.size);
      if (Q.cls === 'store') avail -= (Q.mwh ?? 0) * (Q.cycles ?? 0) * (Q.eta ?? 0) * (y.own?.eff ?? 1);
      else {
        const cls = Q.cls as Cls;
        avail +=
          Q.mw * HOURS * capFactor(y, y.type) * ((SEASON[cls].reduce((a, b) => a + b, 0) / 4) * (y.own?.eff ?? 1));
      }
    }
    const own = clamp(avail / cap, 0, 1);
    return own + (1 - own) * STORE_MARKET_SHARE;
  }

  private runningCost(x: SiteView, t: PlantType, size: PlantSize): number {
    return plantDef(t, size).opex + x.lease * 0.02;
  }

  /** Fixed misjudgement in [-1, 1] per site and plant type (differs between rivals). */
  private noiseOf(id: string, t: PlantType): number {
    let h = 2166136261 ^ this.me.id;
    for (const ch of id + t) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return ((h >>> 0) / 4294967295) * 2 - 1;
  }

  /** Current book value of the site (0 for a site that is not ours yet). */
  private bookNow(x: SiteView): number {
    return x.owner === this.me.id ? (x.own?.value ?? 0) : 0;
  }

  /**
   * Expected change of net worth until the end of the game if the project is pursued from its
   * current stage; costs of earlier stages are sunk.
   */
  private projectValue(x: SiteView, t: PlantType, size: PlantSize, stage: Stage): number {
    return this.p.foresight ? this.forecastValue(x, t, stage, size) : this.simpleValue(x, t, stage, size);
  }

  private simpleValue(x: SiteView, t: PlantType, stage: Stage, size: PlantSize): number {
    const P = plantDef(t, size);
    const c = costsFor(this.v, size)[t];
    const left = this.v.quartersLeft;
    let wait = 0;
    let capex = 0;
    if (stage === 'new') capex += x.lease + (x.known ? 0 : x.surveyCost);
    if (stage === 'new' || stage === 'leased') {
      capex += P.permit * (1 + P.reject);
      wait += avgPermitQ(P) + P.reject * 2;
    }
    if (stage !== 'built') {
      const wind = P.cls === 'wind';
      capex += c.build + (wind ? (1 - this.mg.rotor) * c.retry : 0);
      wait += wind ? 1 - this.mg.rotor : 0;
    }
    capex += P.grid / this.mg.cable;
    wait += (1 - this.mg.cable) / this.mg.cable;
    const ops = Math.max(0, left - wait);
    const margin = this.quarterRevenue(x, t, size, 1) * 0.97 - this.runningCost(x, t, size); // ~3 % fault losses
    const invested = stage === 'built' ? (x.own?.invested ?? c.build) : c.build;
    const book = siteValue({
      lease: x.lease,
      type: t,
      permitPaid: P.permit,
      gridPaid: P.grid,
      permit: 'approved',
      built: true,
      invested,
      age: ops,
      grid: ops > 0,
    });
    const already = stage === 'new' ? 0 : x.lease * 0.6 + (stage === 'leased' ? 0 : P.permit);
    const interest = capex * this.v.constants.interest * Math.min(ops + wait, 12) * 0.5;
    const noise = 1 + this.noiseOf(x.id, t) * this.p.noise;
    return ops * margin * noise + book - already - capex - interest;
  }

  /**
   * Timeline version: permit → build → connect (waiting for grid capacity if needed), revenue per
   * quarter from the forecast, idle costs before production, and only what is finished counts
   * at the end of the game.
   */
  private forecastValue(x: SiteView, t: PlantType, stage: Stage, size: PlantSize): number {
    const P = plantDef(t, size);
    const c = costsFor(this.v, size)[t];
    const left = this.left;
    const wind = P.cls === 'wind';
    let spent = 0;
    let tp = 0;
    if (stage === 'new') spent += x.lease + (x.known ? 0 : x.surveyCost);
    if (stage === 'new' || stage === 'leased') {
      spent += P.permit * (1 + P.reject);
      tp = avgPermitQ(P) * (1 + P.reject);
    }
    // the permit would not be decided before the end: only the lease stays on the books
    if (tp >= left) return x.lease * 0.6 - this.bookNow(x) - spent;
    let tb = tp;
    let build = 0;
    let invested = x.own?.invested || c.build;
    if (stage !== 'built') {
      build = x.fail ? c.retry / this.mg.rotor : c.build + (wind ? (1 - this.mg.rotor) * c.retry : 0);
      if (!x.fail) invested = c.build;
      tb += x.fail || wind ? (1 - this.mg.rotor) / this.mg.rotor : 0;
    }
    const tc = tb + (1 - this.mg.cable) / this.mg.cable + this.gridDelay(x, P.mw, tb);
    const built = tb < left;
    const connected = tc < left;
    const ops = connected ? left - tc : 0;
    const running = this.runningCost(x, t, size);
    let rev = 0;
    for (let k = 0; k < left; k++) {
      const w = Math.min(1, Math.max(0, k + 1 - tc));
      if (w > 0) rev += w * (this.revenueAt(x, t, size, k, 1) * 0.97 - running); // ~3 % fault losses
    }
    const waiting = Math.min(left, tc);
    const idle = x.lease * 0.02 * waiting + (built ? P.opex * Math.max(0, waiting - tb) : 0);
    const capex = spent + (built ? build : 0) + (connected ? P.grid / this.mg.cable : 0);
    const end = siteValue({
      lease: x.lease,
      type: t,
      permitPaid: P.permit,
      gridPaid: P.grid,
      permit: 'approved',
      built,
      invested: built ? invested : 0,
      age: ops,
      grid: connected,
    });
    const interest = capex * this.v.constants.interest * Math.min(left, 12) * 0.5;
    const noise = 1 + this.noiseOf(x.id, t) * this.p.noise;
    return rev * noise + end - this.bookNow(x) - capex - idle - interest;
  }

  /**
   * Quarters a project that is built at `t` has to wait for grid capacity (Infinity = not before
   * the end). Built but unconnected plants (own and others') and half of the others' approved
   * projects are assumed to connect first;
   * announced grid expansions help, random ones are not counted on.
   */
  private gridDelay(x: SiteView, mw: number, t: number): number {
    const g = this.v.grid[x.r];
    let own = 0;
    for (const y of this.mine())
      if (y.id !== x.id && y.r === x.r && y.type && y.built && !y.grid && !this.connectedNow.has(y.id)) own += y.mw;
    // reservations of others expire after a few quarters
    const others = this.optimisticGrid ? 0 : this.othersClaim[x.r] + g.reserved - g.myReserved;
    let cap = g.capacity - g.used - others - own;
    const k0 = Math.floor(t);
    for (let k = 1; k <= k0; k++) cap += this.histIn(k)?.grid ?? 0;
    for (let k = k0; k < this.left; k++) {
      if (k > k0) cap += this.histIn(k)?.grid ?? 0;
      if (cap >= mw) return k - k0;
    }
    return Infinity;
  }

  private bestType(
    x: SiteView,
    stage: 'new' | 'leased',
  ): { t: PlantType; size: PlantSize; value: number; capex: number } | null {
    let best: { t: PlantType; size: PlantSize; value: number; capex: number } | null = null;
    const pref = this.ctx.profile.pref.includes(x.r) ? 1.05 : 1;
    const room = this.freeRoom();
    for (const t of plantTypesFor(x)) {
      // the size by return per invested euro (a large plant always promises more in total); a large one only
      // if it is clearly better and can be financed now: an approved plant waiting for money earns nothing
      let pick: { size: PlantSize; value: number; capex: number } | null = null;
      for (const size of PLANT_SIZE_KEYS) {
        const P = plantDef(t, size);
        // grid outlook: other players connect as well, keep a margin (with foresight: part of the value)
        if (!this.p.foresight && this.v.grid[x.r].capacity - this.v.grid[x.r].used < P.mw) continue;
        const capex = costsFor(this.v, size)[t].build + P.grid + P.permit + (stage === 'new' ? x.lease : 0);
        // cheap checks before the valuation
        if (size === 'large' && (!pick || capex > room)) continue;
        const value = this.projectValue(x, t, size, stage);
        if (size === 'large' && value / capex < (pick!.value / pick!.capex) * 1.1) continue;
        if (!pick || value / capex > pick.value / pick.capex) pick = { size, value, capex };
      }
      if (pick && (!best || pick.value * pref > best.value)) best = { t, ...pick, value: pick.value * pref };
    }
    return best;
  }

  /* ---------- money ---------- */

  private runningCostsPerQuarter(): number {
    let c = this.loan * this.v.constants.interest;
    for (const x of this.mine()) {
      c += x.lease * 0.02;
      if (x.built && x.type) c += plantDef(x.type, x.size).opex;
    }
    return c;
  }

  private buffer(): number {
    return Math.max(2e6, this.runningCostsPerQuarter() * this.p.bufferQuarters);
  }

  /** Makes sure `need` can be paid while keeping the buffer; borrows if allowed. */
  private afford(need: number): boolean {
    const want = need + this.buffer();
    if (this.cash >= want) return true;
    const room = Math.floor(this.me.creditLimit * this.p.debtRatio) - this.loan;
    const amount = Math.ceil((want - this.cash) / 1e6) * 1e6;
    if (amount > room || amount <= 0) return false;
    this.acts.push({ type: 'borrow', amount });
    this.loan += amount;
    this.cash += amount;
    return true;
  }

  private spend(a: Action, cost: number): void {
    this.acts.push(a);
    this.cash -= cost;
  }

  /** Money still needed to finish the own projects that are under way. */
  private committed(): number {
    let c = 0;
    for (const x of this.mine()) {
      if (!x.type || x.permit === 'rejected') continue;
      if (!x.built && !this.builtNow.has(x.id)) c += costsFor(this.v, x.size)[x.type].build;
      if (!x.grid && !this.connectedNow.has(x.id)) c += plantDef(x.type, x.size).grid;
    }
    for (const n of this.leasedNow) c += costsFor(this.v, n.size)[n.t].build + plantDef(n.t, n.size).grid;
    return c;
  }

  /** Expected operating cash flow per quarter of the own plants (after running costs and interest). */
  private cashFlow(): number {
    let c = -this.loan * this.v.constants.interest;
    for (const x of this.mine()) {
      c -= x.lease * 0.02;
      if (!x.type || !x.built) continue;
      c -= plantDef(x.type, x.size).opex;
      if (x.grid) c += this.quarterRevenue(x, x.type, x.size, x.own?.eff ?? 1);
    }
    return Math.max(0, c);
  }

  /**
   * Investment a project is ranked by. With `bigProjects` a large project (offshore) is not ranked below a
   * small one as long as half of the free financing room covers it: idle money earns nothing.
   */
  private rankCapex(capex: number): number {
    return this.p.bigProjects ? Math.max(capex, 0.5 * Math.max(0, this.freeRoom())) : capex;
  }

  /** Financing room that is neither spent nor needed for the projects under way. */
  private freeRoom(): number {
    return this.me.creditLimit * this.p.debtRatio - this.loan + this.cash - this.buffer() - this.committed();
  }

  /* ---------- plan ---------- */

  /** Information for the decision: surveys of free sites and a spy report on the rival to fight. */
  explore(): Action[] {
    const pending = this.mine().filter((x) => !(x.built && x.grid)).length;
    const free = this.v.sites.filter((x) => x.owner < 0);
    // no new projects near the end (same horizon as `newSites`)
    if (this.v.quartersLeft >= (this.p.lateGame ? 1 : 4)) this.surveys(free, pending);
    this.spy();
    return this.acts;
  }

  plan(): Action[] {
    if (this.p.sellStuck) this.sellDead();
    this.repairs();
    this.advanceProjects();
    this.repowers();
    this.newSites();
    if (this.p.contracts) this.contracts();
    if (this.p.reservations) this.reservations();
    this.detectives();
    this.tricks();
    this.repay();
    return this.acts;
  }

  /**
   * Sells sites whose best continuation is worse than selling now (stuck or without a viable plant),
   * even if the other players' projects left them the grid capacity.
   */
  private sellDead(): void {
    if (!this.p.foresight) return;
    this.optimisticGrid = true;
    for (const x of this.mine()) {
      if (!x.own || (x.built && x.grid) || x.permit === 'pending') continue;
      const stage: Stage = !x.type || x.permit === 'rejected' ? 'leased' : x.built ? 'built' : 'approved';
      const keep =
        stage === 'leased'
          ? (this.bestType(x, 'leased')?.value ?? -Infinity)
          : this.projectValue(x, x.type!, x.size, stage);
      const idle = -(x.lease * 0.02 + (x.built && x.type ? plantDef(x.type, x.size).opex : 0)) * this.left;
      const sell = x.own.sellValue - x.own.value;
      if (sell <= Math.max(keep, idle)) continue;
      this.acts.push({ type: 'sellSite', siteId: x.id });
      this.cash += x.own.sellValue;
      this.sold.add(x.id);
      this.shares.clear();
    }
    this.optimisticGrid = false;
  }

  private repairs(): void {
    for (const x of this.mine()) {
      if (!x.fault || !x.type || !x.grid) continue;
      const loss = this.revenueAt(x, x.type, x.size, 0, x.own?.eff ?? 1);
      if (loss < this.v.constants.selfRepairCost * 2) continue;
      // cheap self repair first; if it fails the service team is still sent (rejected if fixed)
      if (this.cash > this.v.constants.selfRepairCost + 1e6)
        this.spend({ type: 'repairSelf', siteId: x.id }, this.v.constants.selfRepairCost);
      const svc = costsFor(this.v, x.size)[x.type].service;
      // only paid if still broken; planned as spent to stay on the safe side
      if (loss * 0.8 > svc && this.cash > svc + this.buffer()) this.spend({ type: 'repairService', siteId: x.id }, svc);
    }
  }

  private advanceProjects(): void {
    const mine = this.mine();
    // most valuable first: connect, then build, then permits
    for (const x of mine) {
      if (!x.type || !x.built || x.grid) continue;
      const mw = x.mw;
      const c = costsFor(this.v, x.size)[x.type].grid;
      if (this.free[x.r] >= mw && this.afford(c)) {
        this.spend({ type: 'connectGrid', siteId: x.id }, c);
        this.free[x.r] -= mw;
        this.connectedNow.add(x.id);
      }
    }
    const approved = mine
      .filter((x) => x.type && x.permit === 'approved' && !x.built)
      .sort((a, b) => this.revenueAt(b, b.type!, b.size, 1, 1) - this.revenueAt(a, a.type!, a.size, 1, 1));
    for (const x of approved) {
      const t = x.type!;
      const c = x.fail ? costsFor(this.v, x.size)[t].retry : costsFor(this.v, x.size)[t].build;
      if ((!x.fail || this.p.lateGame) && this.projectValue(x, t, x.size, 'approved') < 0) continue;
      if (this.afford(c)) {
        this.spend({ type: 'build', siteId: x.id }, c);
        this.builtNow.add(x.id);
      }
    }
    for (const x of mine) {
      if (x.type && x.permit !== 'rejected') continue;
      const best = this.bestType(x, 'leased');
      if (!best || best.value < 0) continue;
      if (x.type && x.type !== best.t) this.acts.push({ type: 'changePlantType', siteId: x.id });
      const c = plantDef(best.t, best.size).permit;
      if (this.afford(c)) this.spend({ type: 'applyPermit', siteId: x.id, plantType: best.t, size: best.size }, c);
    }
  }

  /**
   * Repowers standard plants to large when the extra margin until the end (and the higher book value)
   * pays for the upgrade and the quarter offline.
   */
  private repowers(): void {
    // the engine's options tell which plants can be repowered now (missing cash is borrowed, see `afford`)
    for (const opt of this.v.options) {
      if (opt.action.type !== 'repower' || (opt.error !== null && opt.error !== 'insufficientFunds')) continue;
      const x = this.v.sites.find((s) => s.id === (opt.action as { siteId: string }).siteId)!;
      const t = x.type!;
      const extra = repowerMw(t);
      if (!x.own || this.free[x.r] < extra) continue;
      const eff = x.own.eff;
      const opexDiff = plantDef(t, 'large').opex - plantDef(t, 'std').opex;
      let gain = -this.revenueAt(x, t, 'std', 0, eff); // offline this quarter
      for (let k = 1; k < this.left; k++)
        gain += (this.revenueAt(x, t, 'large', k, eff) - this.revenueAt(x, t, 'std', k, eff)) * 0.97 - opexDiff;
      // book value at the end, as the engine books the repowering
      const S = plantDef(t, 'std');
      const end = {
        lease: x.lease,
        type: t,
        permit: 'approved' as const,
        built: true,
        grid: true,
        permitPaid: S.permit,
      };
      const age = x.own.age + this.left;
      const extraGrid = repowerGridCost(t);
      const book =
        siteValue({ ...end, age, invested: x.own.invested + opt.cost - extraGrid, gridPaid: S.grid + extraGrid }) -
        siteValue({ ...end, age, invested: x.own.invested, gridPaid: S.grid });
      const interest = opt.cost * this.v.constants.interest * Math.min(this.left, 12) * 0.5;
      const value = gain + book - opt.cost - interest;
      if (value < opt.cost * this.p.minRoi * 2) continue;
      if (!this.afford(opt.cost)) continue;
      this.spend({ type: 'repower', siteId: x.id }, opt.cost);
      this.free[x.r] -= extra;
    }
  }

  /** Project limits; with `scaleWithCash` they grow with the uncommitted financing room. */
  private limits(): { pending: number; leases: number } {
    const { maxPending, leasesPerTurn } = this.p;
    if (!this.p.scaleWithCash) return { pending: maxPending, leases: leasesPerTurn };
    const extra = Math.max(0, Math.floor(this.freeRoom() / 50e6));
    return { pending: Math.min(maxPending + extra, maxPending * 2), leases: Math.min(leasesPerTurn + extra, 4) };
  }

  /** Value factor < 1 for a region where the rival already has a large share of its capacity. */
  private spreadFactor(r: RegionKey, mw: number): number {
    if (!this.p.diversify) return 1;
    let total = mw;
    let here = mw;
    for (const x of this.mine()) {
      if (!x.type || x.permit === 'rejected') continue;
      total += x.mw;
      if (x.r === r) here += x.mw;
    }
    for (const n of this.leasedNow) {
      const mw = plantDef(n.t, n.size).mw;
      total += mw;
      if (n.x.r === r) here += mw;
    }
    if (total < 150) return 1;
    return 1 - 0.2 * Math.max(0, here / total - 0.5);
  }

  private newSites(): void {
    const mine = this.mine();
    let pending = mine.filter((x) => !(x.built && x.grid)).length;
    if (this.v.quartersLeft < (this.p.lateGame ? 1 : 4)) return;
    const free = this.v.sites.filter((x) => x.owner < 0);
    // lease the best known sites (offshore without survey unless surveys are valued)
    const scored = free
      .filter((x) => x.known || (x.r === 'ns' && !this.p.valueSurveys))
      .map((x) => ({ x, b: this.bestType(x, 'new') }))
      .filter((s): s is { x: SiteView; b: NonNullable<ReturnType<Planner['bestType']>> } => !!s.b)
      .filter((s) => s.b.value > s.b.capex * this.p.minRoi)
      .map((s) => ({
        ...s,
        score: (s.b.value / this.rankCapex(s.b.capex)) * this.spreadFactor(s.x.r, plantDef(s.b.t, s.b.size).mw),
      }))
      .sort((a, b) => b.score - a.score);
    let leases = 0;
    for (const { x, b } of scored) {
      const lim = this.limits();
      if (leases >= lim.leases || pending >= lim.pending) break;
      // the whole project should be financeable within the next quarters
      const room = this.me.creditLimit * this.p.debtRatio - this.loan + this.cash - this.buffer();
      const inflow = this.p.bigProjects ? this.cashFlow() * avgPermitQ(plantDef(b.t, b.size)) : 0;
      if (b.capex > room * 1.2 + inflow) continue;
      const permit = plantDef(b.t, b.size).permit;
      if (!this.afford(x.lease + permit)) continue;
      this.spend({ type: 'lease', siteId: x.id }, x.lease);
      this.spend({ type: 'applyPermit', siteId: x.id, plantType: b.t, size: b.size }, permit);
      this.leasedNow.push({ x, t: b.t, size: b.size });
      leases++;
      pending++;
    }
  }

  /** Surveys unknown sites for later quarters. */
  private surveys(free: SiteView[], pending: number): void {
    if (!this.p.valueSurveys) {
      if (pending >= this.p.maxPending) return;
      const unknown = free.filter((x) => !x.known && x.r !== 'ns');
      const prefer = (x: SiteView) => (this.ctx.profile.pref.includes(x.r) ? 1 : 0) + this.R();
      unknown.sort((a, b) => prefer(b) - prefer(a));
      for (const x of unknown.slice(0, Math.min(this.p.surveysPerTurn, this.me.surveysLeft))) {
        if (this.cash < x.surveyCost + this.buffer()) break;
        this.spend({ type: 'survey', siteId: x.id }, x.surveyCost);
      }
      return;
    }
    // expected return with regional averages: cheap leases in good regions first
    const unknown = free
      .filter((x) => !x.known)
      .map((x) => ({ x, b: this.bestType(x, 'new') }))
      .filter((s) => s.b && s.b.value > 0)
      .map((s) => ({ x: s.x, score: s.b!.value / s.b!.capex + (this.ctx.profile.pref.includes(s.x.r) ? 0.05 : 0) }))
      .sort((a, b) => b.score - a.score);
    const n = Math.min(this.p.surveysPerTurn + (this.freeRoom() > 40e6 ? 2 : 0), this.me.surveysLeft);
    for (const { x } of unknown.slice(0, n)) {
      if (this.cash < x.surveyCost + this.buffer()) break;
      this.spend({ type: 'survey', siteId: x.id }, x.surveyCost);
    }
  }

  /** Expected generation in the weakest of the next quarters (own operating plants). */
  private safeVolume(): number {
    let min = Infinity;
    for (let k = 0; k < 4; k++) {
      const q = (this.v.q + k) % 4;
      let s = 0;
      for (const x of this.mine()) {
        if (!x.type || !x.grid || !x.built) continue;
        const P = PLANTS[x.type];
        if (P.cls === 'store' || x.offline > 0) continue;
        s += x.mw * HOURS * capFactor(x, x.type) * SEASON[P.cls as Cls][q]! * (x.own?.eff ?? 1);
      }
      min = Math.min(min, s);
    }
    return min === Infinity ? 0 : min * 0.85;
  }

  /** Average capture rate of the own generation in quarter `k` from now. */
  private captureAt(k: number): number {
    const q = this.qAt(k);
    let gen = 0;
    let val = 0;
    for (const x of this.mine()) {
      if (!x.type || !x.grid || !x.built || PLANTS[x.type].cls === 'store' || x.offline > 0) continue;
      const cls = PLANTS[x.type].cls as Cls;
      const e = x.mw * capFactor(x, x.type) * SEASON[cls][q]!;
      gen += e;
      val += e * CAPTURE[cls][q]!;
    }
    return gen > 0 ? val / gen : 0.9;
  }

  private contracts(): void {
    let room = this.safeVolume() - this.me.contractVolume;
    let slots = this.v.constants.maxContracts - this.me.contracts.length;
    // fixed price vs. the expected spot price incl. capture rate over the contract's duration
    const gain = (o: PlayerView['offers'][number]): number => {
      if (!this.p.foresight) return o.price - this.basePrice * 0.98;
      let s = 0;
      for (let k = 0; k < Math.min(o.quarters, this.left); k++) s += o.price - this.price[k]! * this.captureAt(k);
      return s * o.vol;
    };
    const offers = this.v.offers.map((o) => ({ o, g: gain(o) })).sort((a, b) => b.g - a.g);
    for (const { o, g } of offers) {
      if (slots <= 0) break;
      if (o.vol > room || g < 0) continue;
      this.acts.push({ type: 'acceptContract', offerId: o.id });
      room -= o.vol;
      slots--;
    }
  }

  private reservations(): void {
    const need: Partial<Record<RegionKey, number>> = {};
    for (const x of this.mine()) {
      if (!x.type || x.grid || this.connectedNow.has(x.id)) continue;
      const soon = x.built || x.permit === 'approved' || (x.permit === 'pending' && (x.own?.permitLeft ?? 9) <= 1);
      if (soon) need[x.r] = (need[x.r] ?? 0) + x.mw;
    }
    for (const [r, mw] of Object.entries(need) as [RegionKey, number][]) {
      const g = this.v.grid[r];
      let have = g.myReserved;
      let free = this.free[r];
      // only worth it when capacity is getting scarce
      if (g.capacity - g.used - g.reserved > mw + 150) continue;
      // with foresight: as many blocks as needed (e.g. two for an offshore park)
      const blocks = this.p.foresight ? 3 : 1;
      for (let i = 0; i < blocks && have < mw; i++) {
        if (free < this.v.constants.reserveMw) break;
        if (this.cash < this.v.constants.reserveCost + this.buffer()) break;
        this.spend({ type: 'reserveGrid', region: r }, this.v.constants.reserveCost);
        have += this.v.constants.reserveMw;
        free -= this.v.constants.reserveMw;
      }
    }
  }

  /* ---------- lobby tricks ---------- */

  /** Expected damage to the owner of `x` if the trick works. */
  private harm(trick: TrickType, x: SiteView): number {
    if (!x.type) return 0;
    if (this.p.trickTiming) return this.timedHarm(trick, x);
    const rev = this.quarterRevenue(x, x.type, x.size, x.intel?.eff ?? 1);
    const c = costsFor(this.v, x.size)[x.type];
    if (trick === 'klage') return rev * 2 + plantDef(x.type, x.size).permit * 0.15 + c.build * 0.15 * 0.1;
    if (trick === 'bi') return rev * 0.5 * 2;
    return rev * 0.6 + c.service * 0.5; // hack: fault until repaired
  }

  /**
   * Damage from the actual effect of each trick on the quarters it hits: a lawsuit delays the
   * production start by two quarters (or kills the permit), a citizens' initiative halves two
   * quarters, a hack stops the plant until it is repaired. Lost quarters after the end do not count,
   * but a delay past the end costs the whole remaining production.
   */
  private timedHarm(trick: TrickType, x: SiteView): number {
    const t = x.type!;
    const rev = (k: number) => this.revenueAt(x, t, x.size, k, x.intel?.eff ?? 1);
    if (trick === 'klage') {
      // an approved but unbuilt plant would start next quarter; a pending one about a quarter later
      const start = x.permit === 'approved' ? 1 : 2;
      let delay = 0;
      for (let k = start; k < start + 2; k++) delay += rev(k);
      let kill = plantDef(t, x.size).permit;
      for (let k = start; k < start + 2 + avgPermitQ(plantDef(t, x.size)); k++) kill += rev(k);
      let h = 0.85 * delay + 0.15 * kill;
      // an approved permit drops out of the owner's net worth until it is granted again
      if (x.permit === 'approved') h += plantDef(t, x.size).permit * (start + 2 >= this.left ? 1 : 0.2);
      return h;
    }
    if (trick === 'bi') return 0.5 * (rev(0) + rev(1));
    return rev(0) + 0.3 * rev(1) + Math.min(costsFor(this.v, x.size)[t].service, this.v.constants.selfRepairCost * 3);
  }

  /** Human players caught or suspected tricking this rival recently, with the number of attacks. */
  private grudges(): Map<PlayerId, number> {
    const g = new Map<PlayerId, number>();
    if (!this.p.revenge) return g;
    for (const n of this.v.news) {
      if (-this.inQuarters(n.year, n.q) > GRUDGE_QUARTERS) continue;
      const e = n.event;
      if (e.type !== 'trickSucceeded' && !(e.type === 'trickFailed' && e.caught)) continue;
      if (e.targetId !== this.me.id || e.actorId === null || !this.v.players[e.actorId]?.human) continue;
      g.set(e.actorId, (g.get(e.actorId) ?? 0) + 1);
    }
    return g;
  }

  /**
   * The player this rival would fight: the strongest (human bias, grudges), if it is a real threat or struck
   * first. Null when there is nobody to fight or no trick left.
   */
  private rival(): { leader: PlayerSummary; grudge: Map<PlayerId, number> } | null {
    if (this.me.tricksLeft <= 0) return null;
    const grudge = this.grudges();
    const others = this.v.players.filter((p) => p.id !== this.me.id && !p.out);
    if (!others.length) return null;
    const score = (p: PlayerSummary) =>
      p.worth * (p.human ? this.p.humanBias : 1) * (1 + 0.5 * (grudge.get(p.id) ?? 0));
    const leader = others.reduce((a, b) => (score(b) > score(a) ? b : a));
    const threat =
      leader.worth >= this.me.worth * 0.9 ||
      (leader.human && leader.worth > this.me.worth * 0.75) ||
      grudge.has(leader.id);
    return threat ? { leader, grudge } : null;
  }

  /** Does the rival feel like fighting this quarter (more often against players it holds a grudge against)? */
  private fights(grudge: Map<PlayerId, number>): boolean {
    return this.R() <= this.p.trickRate * (grudge.size ? 2 : 1);
  }

  /** Tricks against the leader by their edge (expected harm per own cost), best first. */
  private trickOptions(leader: PlayerSummary): { trick: TrickType; siteId: string; edge: number }[] {
    // a known detective agency of the target (from the spy report) lowers the chances and raises the risk
    const det = leader.intel?.detectives?.level;
    // a report serves the tricks of several quarters: count about a third of it per trick
    const spyShare = leader.intel ? 0 : this.v.constants.spyCost / 3;
    const options: { trick: TrickType; siteId: string; edge: number }[] = [];
    for (const trick of ['klage', 'bi', 'hack'] as TrickType[]) {
      const T = this.v.tricks[trick];
      const odds = trickOdds(trick, det);
      const chance = odds.success;
      const caught = (1 - chance) * odds.caughtIfFailed + chance * odds.caughtIfSucceeded;
      const ownCost = T.cost + spyShare + caught * (T.fine + T.damages);
      for (const id of trickTargetIds(this.v, trick)) {
        const x = this.v.sites.find((s) => s.id === id);
        if (!x || x.owner !== leader.id) continue;
        options.push({ trick, siteId: id, edge: (chance * this.harm(trick, x)) / ownCost });
      }
    }
    return options.sort((a, b) => b.edge - a.edge);
  }

  /** Buys a spy report on the leader if the rival wants to fight it this quarter (tricks need one). */
  private spy(): void {
    const r = this.rival();
    if (!r || r.leader.intel || !this.fights(r.grudge)) return;
    const best = this.trickOptions(r.leader)[0];
    if (!best || best.edge < this.p.trickEdge) return;
    const spy = this.v.constants.spyCost;
    if (this.cash < TRICKS[best.trick].cost + spy + this.buffer()) return;
    this.spend({ type: 'spy', targetId: r.leader.id }, spy);
  }

  private tricks(): void {
    const r = this.rival();
    const intel = r?.leader.intel;
    if (!r || !intel) return;
    const { leader, grudge } = r;
    // a report bought this quarter means the decision to fight is already made
    const fresh = intel.until === this.v.turn + this.v.constants.spyQuarters - 1;
    if (!fresh && !this.fights(grudge)) return;
    // a detective agency deters: the better it is, the more often the rival backs off
    const det = intel.detectives?.level;
    if (det && this.R() < 1 - this.v.detectives[det].shield) return;
    const max = this.p.trickTiming ? this.me.tricksLeft : 1;
    const used = new Set<string>();
    for (const o of this.trickOptions(leader)) {
      if (used.size >= max || o.edge < this.p.trickEdge) break;
      if (used.has(o.siteId)) continue;
      const T = TRICKS[o.trick];
      if (this.cash < T.cost + this.buffer()) break;
      this.spend({ type: 'lobby', trick: o.trick, siteId: o.siteId }, T.cost);
      used.add(o.siteId);
    }
  }

  /** Hires detectives after recent attacks on own plants or a caught spy, if there is something to protect. */
  private detectives(): void {
    const level = this.p.detectives;
    if (!level || this.me.detectives) return;
    const attacked = this.v.news.some((n) => {
      if (-this.inQuarters(n.year, n.q) >= ALERT_QUARTERS) return false;
      const e = n.event;
      if (e.type === 'trickSucceeded' || e.type === 'trickFailed') return e.targetId === this.me.id;
      return e.type === 'spied' && e.targetId === this.me.id;
    });
    if (!attacked) return;
    const operatingRevenue = this.mine()
      .filter((x) => x.type && x.built && x.grid)
      .reduce((s, x) => s + this.quarterRevenue(x, x.type!, x.size, x.own?.eff ?? 1), 0);
    // the agency protects four quarters of revenue against a few more attacks
    const cost = this.v.detectives[level].cost;
    if (operatingRevenue * 2 < cost) return;
    if (this.cash < cost + this.buffer()) return;
    this.spend({ type: 'hireDetectives', level }, cost);
  }

  private repay(): void {
    if (this.loan <= 0) return;
    // keep money for projects that are about to need it
    let upcoming = 0;
    for (const x of this.mine()) {
      if (x.type && x.permit === 'pending' && !x.built) upcoming += costsFor(this.v, x.size)[x.type].build;
      if (x.type && x.built && !x.grid) upcoming += plantDef(x.type, x.size).grid;
    }
    const surplus = this.cash - this.buffer() - upcoming;
    if (surplus < 5e6) return;
    const amount = Math.min(this.loan, Math.floor(surplus / 1e6) * 1e6);
    if (amount >= this.loan) this.acts.push({ type: 'repay', amount: 'all' });
    else this.acts.push({ type: 'repay', amount });
    this.cash -= amount;
    this.loan -= amount;
  }
}
