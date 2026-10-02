/**
 * Port of the legacy rival AI (`aiTurn` / `aiTrick` / `aiType` / `aiBorrow` in legacy/src/core.js),
 * expressed as actions on a PlayerView.
 *
 * Differences to legacy (the AI now decides once per quarter and cannot peek at results):
 * - A survey's result is only used in a later quarter; known good surveyed sites are preferred.
 * - Cash is tracked as a projection while planning; the engine validates every action.
 */
import { PLANTS, REGIONS } from '../data.js';
import { pick, type Random } from '../rng.js';
import type {
  Action,
  OpponentContext,
  OpponentStrategy,
  PlantType,
  PlayerView,
  RegionKey,
  SiteView,
  TrickType,
} from '../types.js';

/** Legacy check after a survey: is the site worse than average? */
export function legacyBadSite(x: SiteView, r: Random): boolean {
  const R = REGIONS[x.r];
  if (x.r === 'ns' || x.r === 'nd') return (x.wind ?? 0) < (R.wind![0] + R.wind![1]) / 2 - 0.4;
  if (x.r === 'ib') return (x.sun ?? 0) < 1650;
  return !x.hydro && r() < 0.5;
}

export class RuleBasedOpponent implements OpponentStrategy {
  async decide(view: PlayerView, legal: Action[], ctx: OpponentContext): Promise<Action[]> {
    return legacyTurn(view, legal, ctx);
  }
}

function legacyTurn(view: PlayerView, legal: Action[], ctx: OpponentContext): Action[] {
  const R = ctx.random;
  const me = view.playerId;
  const acts: Action[] = [];
  let cash = view.me.cash;
  let loan = view.me.loan;
  const limit = view.me.creditLimit;
  const free = Object.fromEntries(Object.entries(view.grid).map(([k, v]) => [k, v.free])) as Record<RegionKey, number>;

  const borrowFor = (need: number): boolean => {
    if (cash < need && loan + (need - cash) + 3e6 <= limit * 0.9) {
      const a = Math.ceil((need - cash + 3e6) / 1e6) * 1e6;
      acts.push({ type: 'borrow', amount: a });
      loan += a;
      cash += a;
    }
    return cash >= need;
  };
  const aiType = (x: SiteView): PlantType => {
    if (x.r === 'ns') return 'off';
    if (x.r === 'al') {
      if (x.hydro) return cash > 60e6 ? 'pump' : 'hydro';
      return view.year > 2031 && R() < 0.4 ? 'batt' : 'solar';
    }
    if (view.year > 2031 && R() < 0.3) return 'batt';
    if (x.r === 'ib') return R() < 0.75 ? 'solar' : 'wind';
    return R() < 0.65 ? 'wind' : 'solar';
  };

  const mine = view.sites.filter((x) => x.owner === me);
  for (const x of mine) {
    const siteId = x.id;
    if (x.fault) {
      const c = view.costs[x.type!].service;
      if (x.grid && cash > c + 5e6) {
        acts.push({ type: 'repairService', siteId });
        cash -= c;
      }
      continue;
    }
    if (!x.type) {
      const t = aiType(x);
      if (cash > PLANTS[t].permit) {
        acts.push({ type: 'applyPermit', siteId, plantType: t });
        cash -= PLANTS[t].permit;
      }
      continue;
    }
    if (x.permit === 'rejected') {
      if (R() < 0.5) acts.push({ type: 'changePlantType', siteId });
      else if (cash > PLANTS[x.type].permit) {
        acts.push({ type: 'applyPermit', siteId, plantType: x.type });
        cash -= PLANTS[x.type].permit;
      }
      continue;
    }
    if (x.permit === 'approved' && !x.built) {
      const c = x.fail ? view.costs[x.type].retry : view.costs[x.type].build;
      if (borrowFor(c + 3e6)) {
        acts.push({ type: 'build', siteId });
        cash -= c;
      }
      continue;
    }
    if (x.built && !x.grid) {
      const c = PLANTS[x.type].grid;
      const mw = PLANTS[x.type].mw;
      if (free[x.r] >= mw && cash > c) {
        acts.push({ type: 'connectGrid', siteId });
        cash -= c;
        free[x.r] -= mw;
      }
    }
  }

  // new sites
  const pref = ctx.profile.pref;
  let pendingCount = mine.filter((x) => !(x.built && x.grid)).length;
  const touched = new Set<string>();
  const tries = cash > 40e6 ? 3 : 2;
  for (let t = 0; t < tries; t++) {
    if (R() > 0.55 || pendingCount >= 3) continue;
    const r = pick(R, pref);
    const freeSites = view.sites.filter((x) => x.r === r && x.owner < 0 && !touched.has(x.id));
    if (!freeSites.length) continue;
    const good = freeSites.filter((x) => x.surveyed && !legacyBadSite(x, R));
    const x = good.length ? pick(R, good) : pick(R, freeSites);
    if (cash < x.lease + (r === 'ns' ? 30e6 : 8e6)) continue;
    touched.add(x.id);
    if (!x.surveyed && R() < 0.6) {
      acts.push({ type: 'survey', siteId: x.id });
      cash -= x.surveyCost;
      continue;
    }
    if (x.surveyed && !good.includes(x)) continue;
    acts.push({ type: 'lease', siteId: x.id });
    cash -= x.lease;
    pendingCount++;
  }
  if (R() < 0.06) {
    const r = pick(R, pref);
    if (free[r] >= view.constants.reserveMw && cash > 5e6) {
      acts.push({ type: 'reserveGrid', region: r });
      cash -= view.constants.reserveCost;
    }
  }
  if (loan > 0 && cash > loan + 20e6) {
    acts.push({ type: 'repay', amount: 'all' });
    cash -= loan;
    loan = 0;
  }
  if (R() < 0.06) {
    const a = legacyTrick(view, legal, R);
    if (a) acts.push(a);
  }
  return acts;
}

/** Port of `aiTrick`: prefers the leader (60 %), otherwise a random rival. */
export function legacyTrick(view: PlayerView, legal: Action[], R: Random): Action | null {
  const type = pick<TrickType>(R, ['klage', 'klage', 'bi', 'bi', 'hack']);
  const others = view.players.filter((p) => p.id !== view.playerId && !p.out).sort((a, b) => b.worth - a.worth);
  if (!others.length) return null;
  const lead = R() < 0.6 ? others[0]! : pick(R, others);
  const all = legal.flatMap((a) => (a.type === 'lobby' && a.trick === type ? [a.siteId] : []));
  let ts = all.filter((id) => view.sites.find((s) => s.id === id)?.owner === lead.id);
  if (!ts.length) ts = all;
  if (!ts.length) return null;
  return { type: 'lobby', trick: type, siteId: pick(R, ts) };
}
