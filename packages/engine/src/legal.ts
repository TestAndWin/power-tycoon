import { validateAction } from './actions.js';
import { PLANT_TYPE_KEYS, REGION_KEYS, TRICK_KEYS } from './data.js';
import { creditLimit } from './rules.js';
import type { Action, GameState, PlayerId } from './types.js';

/**
 * All actions player `pid` could execute right now (minigame results excluded).
 * Money amounts are offered in the same steps as the legacy UI plus "as much as possible".
 */
export function legalActions(g: GameState, pid: PlayerId): Action[] {
  const p = g.players[pid];
  if (!p || g.over || p.out || g.challenge) return [];
  const c: Action[] = [];
  for (const x of g.sites) {
    const siteId = x.id;
    if (x.owner < 0) {
      c.push({ type: 'survey', siteId }, { type: 'lease', siteId });
      continue;
    }
    if (x.owner !== pid) {
      for (const trick of TRICK_KEYS) c.push({ type: 'lobby', trick, siteId });
      continue;
    }
    for (const plantType of PLANT_TYPE_KEYS) c.push({ type: 'applyPermit', siteId, plantType });
    c.push(
      { type: 'changePlantType', siteId },
      { type: 'build', siteId },
      { type: 'connectGrid', siteId },
      { type: 'repairSelf', siteId },
      { type: 'repairService', siteId },
      { type: 'sellSite', siteId },
    );
  }
  for (const region of REGION_KEYS) c.push({ type: 'reserveGrid', region });
  for (const o of g.offers) c.push({ type: 'acceptContract', offerId: o.id });
  const room = Math.floor((creditLimit(g, p) - p.loan) / 1e6) * 1e6;
  for (const amount of new Set([5e6, 20e6, 50e6, room])) if (amount > 0) c.push({ type: 'borrow', amount });
  for (const amount of [5e6, 20e6]) c.push({ type: 'repay', amount });
  c.push({ type: 'repay', amount: 'all' });
  return c.filter((a) => validateAction(g, pid, a) === null);
}
