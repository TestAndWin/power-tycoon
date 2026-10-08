/**
 * The dominant strategy from the play-test feedback (October 2026): standard solar parks in Iberia only,
 * financed with as much credit as the bank gives. A yardstick for the simulation, not a rival.
 */
import type { Action, OpponentStrategy, PlayerView } from '../src/index.js';

export class SolarBot implements OpponentStrategy {
  async explore(v: PlayerView): Promise<Action[]> {
    if (v.quartersLeft < 3) return [];
    return v.sites
      .filter((x) => x.r === 'ib' && x.owner < 0 && !x.known)
      .slice(0, v.me.surveysLeft)
      .map((x) => ({ type: 'survey', siteId: x.id }));
  }
  async decide(v: PlayerView): Promise<Action[]> {
    const acts: Action[] = [];
    let cash = v.me.cash;
    const free = Math.floor((v.me.creditLimit - v.me.loan) / 1e6) * 1e6;
    if (free > 0) {
      acts.push({ type: 'borrow', amount: free });
      cash += free;
    }
    const pay = (a: Action, cost: number) => {
      if (cost > cash) return;
      acts.push(a);
      cash -= cost;
    };
    const mine = v.sites.filter((x) => x.owner === v.playerId);
    for (const x of mine) {
      if (x.built && !x.grid) pay({ type: 'connectGrid', siteId: x.id }, v.costs.solar.grid);
      else if (x.type && x.permit === 'approved' && !x.built)
        pay({ type: 'build', siteId: x.id }, x.fail ? v.costs.solar.retry : v.costs.solar.build);
      else if (!x.type || x.permit === 'rejected')
        pay({ type: 'applyPermit', siteId: x.id, plantType: 'solar' }, v.costs.solar.permit);
    }
    // two new parks per quarter while the money for building them is there
    let pending = mine.filter((x) => !x.grid).length;
    const best = v.sites
      .filter((x) => x.r === 'ib' && x.owner < 0 && x.known)
      .sort((a, b) => (b.sun ?? 0) - (a.sun ?? 0));
    for (const x of best.slice(0, 2)) {
      if (v.quartersLeft < 3 || pending >= 4 || cash < x.lease + v.costs.solar.permit + v.costs.solar.build / 2) break;
      pay({ type: 'lease', siteId: x.id }, x.lease);
      pay({ type: 'applyPermit', siteId: x.id, plantType: 'solar' }, v.costs.solar.permit);
      pending++;
    }
    return acts;
  }
}
