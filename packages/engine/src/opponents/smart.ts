/**
 * Stronger rule-based rival (phase 6). Instead of the legacy fixed thresholds it values every
 * project by its expected contribution to net worth at the end of the game:
 * remaining operating quarters × (revenue − running costs) + book value at the end − investment.
 *
 * It only sees its PlayerView and only acts through actions (same rules as the player).
 * Difficulty is a set of parameters, see `SMART_PARAMS`.
 */
import { CAPTURE, HOURS, PLANTS, PRICE_SEASON, REGIONS, SEASON, TRICKS } from '../data.js';
import type { Random } from '../rng.js';
import type {
  Action,
  OpponentContext,
  OpponentStrategy,
  PlantType,
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
  /** Planning noise (0 = perfect estimates). */
  noise: number;
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
  },
  hard: {
    maxPending: 5,
    leasesPerTurn: 2,
    surveysPerTurn: 3,
    debtRatio: 0.85,
    bufferQuarters: 1.5,
    minRoi: 0.05,
    contracts: true,
    reservations: true,
    trickRate: 0.5,
    trickEdge: 2,
    humanBias: 1.5,
    noise: 0.05,
  },
};

/** Success probabilities of the automatic minigames for rivals (see AUTO_MINIGAME). */
const P_ROTOR = 0.8;
const P_CABLE = 0.85;

type Cls = 'wind' | 'solar' | 'hydro';

/** Capacity factor from what the viewer knows; unknown sites use the regional average. */
function capFactor(x: SiteView, t: PlantType): number {
  const R = REGIONS[x.r];
  if (t === 'wind' || t === 'off') {
    const w = x.wind ?? (R.wind ? (R.wind[0] + R.wind[1]) / 2 : 0);
    return Math.max(0, 0.08 + (w - 4.5) * 0.075);
  }
  if (t === 'solar') return (x.sun ?? (R.sun ? (R.sun[0] + R.sun[1]) / 2 : 0)) / 8760;
  if (t === 'hydro') return 0.5;
  return 0;
}

/** Plant types that are possible on a site (hydro/pump need a known slope). */
function typesFor(x: SiteView): PlantType[] {
  return REGIONS[x.r].types.filter((t) => !((t === 'hydro' || t === 'pump') && x.hydro !== true));
}

export class SmartOpponent implements OpponentStrategy {
  readonly params: SmartParams;
  constructor(level: SmartLevel | SmartParams = 'normal') {
    this.params = typeof level === 'string' ? SMART_PARAMS[level] : level;
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

  constructor(
    private readonly v: PlayerView,
    private readonly ctx: OpponentContext,
    private readonly p: SmartParams,
  ) {
    this.me = v.me;
    this.cash = v.me.cash;
    this.loan = v.me.loan;
    this.R = ctx.random;
    this.free = Object.fromEntries(Object.entries(v.grid).map(([k, g]) => [k, g.free])) as Record<RegionKey, number>;
    this.basePrice = v.market.price / PRICE_SEASON[v.q]!;
  }

  /* ---------- economics ---------- */

  private mine(): SiteView[] {
    return this.v.sites.filter((x) => x.owner === this.me.id);
  }

  /** Expected revenue of one operating quarter, averaged over the seasons. */
  private quarterRevenue(x: SiteView, t: PlantType, eff = 1): number {
    const P = PLANTS[t];
    if (P.cls === 'store') {
      // spread grows with the share of renewables; assume a bit more than today on average
      const spread = this.v.market.spread * 1.1;
      return (P.mwh ?? 0) * (P.cycles ?? 0) * spread * (P.eta ?? 0) * eff;
    }
    const cls = P.cls as Cls;
    let s = 0;
    for (let q = 0; q < 4; q++) s += SEASON[cls][q]! * CAPTURE[cls][q]! * PRICE_SEASON[q]!;
    return P.mw * HOURS * capFactor(x, t) * (s / 4) * this.basePrice * eff;
  }

  private runningCost(x: SiteView, t: PlantType): number {
    return PLANTS[t].opex + x.lease * 0.02;
  }

  /** Book value at the end of the game (see siteValue in rules.ts). */
  private bookValue(x: SiteView, t: PlantType, invested: number, age: number, grid: boolean): number {
    return (
      x.lease * 0.6 + PLANTS[t].permit + invested * Math.max(0.35, 1 - age / 100) + (grid ? PLANTS[t].grid * 0.8 : 0)
    );
  }

  /**
   * Expected change of net worth until the end of the game if the project is pursued from its
   * current stage; costs of earlier stages are sunk.
   */
  private projectValue(x: SiteView, t: PlantType, stage: 'new' | 'leased' | 'approved' | 'built'): number {
    const P = PLANTS[t];
    const c = this.v.costs[t];
    const left = this.v.quartersLeft;
    let wait = 0;
    let capex = 0;
    if (stage === 'new') capex += x.lease + (x.known ? 0 : x.surveyCost);
    if (stage === 'new' || stage === 'leased') {
      capex += P.permit * (1 + P.reject);
      wait += (P.permitQ[0] + P.permitQ[1]) / 2 + P.reject * 2;
    }
    if (stage !== 'built') {
      const wind = P.cls === 'wind';
      capex += c.build + (wind ? (1 - P_ROTOR) * c.retry : 0);
      wait += wind ? 1 - P_ROTOR : 0;
    }
    capex += P.grid / P_CABLE;
    wait += (1 - P_CABLE) / P_CABLE;
    const ops = Math.max(0, left - wait);
    const margin = this.quarterRevenue(x, t) * 0.97 - this.runningCost(x, t); // ~3 % fault losses
    const book = this.bookValue(x, t, stage === 'built' ? (x.own?.invested ?? c.build) : c.build, ops, ops > 0);
    const already = stage === 'new' ? 0 : x.lease * 0.6 + (stage === 'leased' ? 0 : P.permit);
    const interest = capex * this.v.constants.interest * Math.min(ops + wait, 12) * 0.5;
    const noise = 1 + (this.R() * 2 - 1) * this.p.noise;
    return ops * margin * noise + book - already - capex - interest;
  }

  private bestType(x: SiteView, stage: 'new' | 'leased'): { t: PlantType; value: number; capex: number } | null {
    let best: { t: PlantType; value: number; capex: number } | null = null;
    for (const t of typesFor(x)) {
      // grid outlook: other players connect as well, keep a margin
      if (this.v.grid[x.r].capacity - this.v.grid[x.r].used < PLANTS[t].mw) continue;
      const value = this.projectValue(x, t, stage);
      const capex = this.v.costs[t].build + PLANTS[t].grid + PLANTS[t].permit + (stage === 'new' ? x.lease : 0);
      const pref = this.ctx.profile.pref.includes(x.r) ? 1.05 : 1;
      if (!best || value * pref > best.value) best = { t, value: value * pref, capex };
    }
    return best;
  }

  /* ---------- money ---------- */

  private runningCostsPerQuarter(): number {
    let c = this.loan * this.v.constants.interest;
    for (const x of this.mine()) {
      c += x.lease * 0.02;
      if (x.built && x.type) c += PLANTS[x.type].opex;
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

  /* ---------- plan ---------- */

  plan(): Action[] {
    this.repairs();
    this.advanceProjects();
    this.newSites();
    if (this.p.contracts) this.contracts();
    if (this.p.reservations) this.reservations();
    this.tricks();
    this.repay();
    return this.acts;
  }

  private repairs(): void {
    for (const x of this.mine()) {
      if (!x.fault || !x.type || !x.grid) continue;
      const loss = this.quarterRevenue(x, x.type, x.own?.eff ?? 1);
      if (loss < this.v.constants.selfRepairCost * 2) continue;
      // cheap self repair first; if it fails the service team is still sent (rejected if fixed)
      if (this.cash > this.v.constants.selfRepairCost + 1e6)
        this.spend({ type: 'repairSelf', siteId: x.id }, this.v.constants.selfRepairCost);
      const svc = this.v.costs[x.type].service;
      if (loss * 0.8 > svc && this.cash > svc + this.buffer()) this.acts.push({ type: 'repairService', siteId: x.id }); // only paid if still broken
    }
  }

  private advanceProjects(): void {
    const mine = this.mine();
    // most valuable first: connect, then build, then permits
    for (const x of mine) {
      if (!x.type || !x.built || x.grid) continue;
      const mw = PLANTS[x.type].mw;
      const c = this.v.costs[x.type].grid;
      if (this.free[x.r] >= mw && this.afford(c)) {
        this.spend({ type: 'connectGrid', siteId: x.id }, c);
        this.free[x.r] -= mw;
      }
    }
    const approved = mine
      .filter((x) => x.type && x.permit === 'approved' && !x.built)
      .sort((a, b) => this.quarterRevenue(b, b.type!) - this.quarterRevenue(a, a.type!));
    for (const x of approved) {
      const t = x.type!;
      const c = x.fail ? this.v.costs[t].retry : this.v.costs[t].build;
      if (!x.fail && this.projectValue(x, t, 'approved') < 0) continue;
      if (this.afford(c)) this.spend({ type: 'build', siteId: x.id }, c);
    }
    for (const x of mine) {
      if (x.type && x.permit !== 'rejected') continue;
      const best = this.bestType(x, 'leased');
      if (!best || best.value < 0) continue;
      if (x.type && x.type !== best.t) this.acts.push({ type: 'changePlantType', siteId: x.id });
      const c = PLANTS[best.t].permit;
      if (this.afford(c)) this.spend({ type: 'applyPermit', siteId: x.id, plantType: best.t }, c);
    }
  }

  private newSites(): void {
    const mine = this.mine();
    let pending = mine.filter((x) => !(x.built && x.grid)).length;
    if (this.v.quartersLeft < 4) return;
    const free = this.v.sites.filter((x) => x.owner < 0);
    // lease the best known sites
    const scored = free
      .filter((x) => x.known || x.r === 'ns')
      .map((x) => ({ x, b: this.bestType(x, 'new') }))
      .filter((s): s is { x: SiteView; b: NonNullable<ReturnType<Planner['bestType']>> } => !!s.b)
      .filter((s) => s.b.value > s.b.capex * this.p.minRoi)
      .sort((a, b) => b.b.value / b.b.capex - a.b.value / a.b.capex);
    let leases = 0;
    for (const { x, b } of scored) {
      if (leases >= this.p.leasesPerTurn || pending >= this.p.maxPending) break;
      // the whole project should be financeable within the next quarters
      const room = this.me.creditLimit * this.p.debtRatio - this.loan + this.cash - this.buffer();
      if (b.capex > room * 1.2) continue;
      if (!this.afford(x.lease + PLANTS[b.t].permit)) continue;
      this.spend({ type: 'lease', siteId: x.id }, x.lease);
      this.spend({ type: 'applyPermit', siteId: x.id, plantType: b.t }, PLANTS[b.t].permit);
      leases++;
      pending++;
    }
    // survey promising unknown sites for later quarters
    if (pending >= this.p.maxPending) return;
    const unknown = free.filter((x) => !x.known && x.r !== 'ns');
    const prefer = (x: SiteView) => (this.ctx.profile.pref.includes(x.r) ? 1 : 0) + this.R();
    unknown.sort((a, b) => prefer(b) - prefer(a));
    for (const x of unknown.slice(0, this.p.surveysPerTurn)) {
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
        if (P.cls === 'store') continue;
        s += P.mw * HOURS * capFactor(x, x.type) * SEASON[P.cls as Cls][q]! * (x.own?.eff ?? 1);
      }
      min = Math.min(min, s);
    }
    return min === Infinity ? 0 : min * 0.85;
  }

  private contracts(): void {
    let room = this.safeVolume() - this.me.contractVolume;
    let slots = this.v.constants.maxContracts - this.me.contracts.length;
    const offers = [...this.v.offers].sort((a, b) => b.price - a.price);
    for (const o of offers) {
      if (slots <= 0) break;
      if (o.vol > room) continue;
      // fixed price vs. expected spot price incl. capture rate
      if (o.price < this.basePrice * 0.98) continue;
      this.acts.push({ type: 'acceptContract', offerId: o.id });
      room -= o.vol;
      slots--;
    }
  }

  private reservations(): void {
    const need: Partial<Record<RegionKey, number>> = {};
    for (const x of this.mine()) {
      if (!x.type || x.grid) continue;
      const soon = x.built || x.permit === 'approved' || (x.permit === 'pending' && (x.own?.permitLeft ?? 9) <= 1);
      if (soon) need[x.r] = (need[x.r] ?? 0) + PLANTS[x.type].mw;
    }
    for (const [r, mw] of Object.entries(need) as [RegionKey, number][]) {
      const g = this.v.grid[r];
      if (g.myReserved >= mw || this.free[r] < this.v.constants.reserveMw) continue;
      // only worth it when capacity is getting scarce
      if (g.capacity - g.used - g.reserved > mw + 150) continue;
      if (this.cash < this.v.constants.reserveCost + this.buffer()) continue;
      this.spend({ type: 'reserveGrid', region: r }, this.v.constants.reserveCost);
    }
  }

  /** Expected damage to the owner of `x` if the trick works. */
  private harm(trick: TrickType, x: SiteView): number {
    if (!x.type) return 0;
    const rev = this.quarterRevenue(x, x.type);
    if (trick === 'klage') return rev * 2 + PLANTS[x.type].permit * 0.15 + this.v.costs[x.type].build * 0.15 * 0.1;
    if (trick === 'bi') return rev * 0.5 * 2;
    return rev * 0.6 + this.v.costs[x.type].service * 0.5; // hack: fault until repaired
  }

  private tricks(): void {
    if (this.me.tricksLeft <= 0 || this.R() > this.p.trickRate) return;
    const others = this.v.players.filter((p) => p.id !== this.me.id && !p.out);
    if (!others.length) return;
    const score = (p: PlayerSummary) => p.worth * (p.human ? this.p.humanBias : 1);
    const leader = others.reduce((a, b) => (score(b) > score(a) ? b : a));
    // only fight when the leader is a real threat
    if (leader.worth < this.me.worth * 0.9 && !(leader.human && leader.worth > this.me.worth * 0.75)) return;
    let best: { trick: TrickType; siteId: string; edge: number } | null = null;
    for (const trick of ['klage', 'bi', 'hack'] as TrickType[]) {
      const T = this.v.tricks[trick];
      const ownCost = T.cost + (1 - T.chance) * 0.4 * T.fine;
      for (const id of T.targets) {
        const x = this.v.sites.find((s) => s.id === id);
        if (!x || x.owner !== leader.id) continue;
        const edge = (T.chance * this.harm(trick, x)) / ownCost;
        if (!best || edge > best.edge) best = { trick, siteId: id, edge };
      }
    }
    if (!best || best.edge < this.p.trickEdge) return;
    const T = TRICKS[best.trick];
    if (this.cash < T.cost + this.buffer()) return;
    this.spend({ type: 'lobby', trick: best.trick, siteId: best.siteId }, T.cost);
  }

  private repay(): void {
    if (this.loan <= 0) return;
    // keep money for projects that are about to need it
    let upcoming = 0;
    for (const x of this.mine()) {
      if (x.type && x.permit === 'pending' && !x.built) upcoming += this.v.costs[x.type].build;
      if (x.type && x.built && !x.grid) upcoming += PLANTS[x.type].grid;
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
