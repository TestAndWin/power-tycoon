import { checkAction, isBlocking } from './actions.js';
import { PLANT_TYPE_KEYS, REGION_KEYS, TRICK_KEYS } from './data.js';
import { creditLimit } from './rules.js';
import type { Action, ActionOption, GameState, PlayerId } from './types.js';

/**
 * Actions worth checking for player `pid` (minigame results excluded). Money amounts are offered
 * in the steps of the UI plus "as much as possible".
 */
function candidates(g: GameState, pid: PlayerId): Action[] {
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
  return c;
}

/** All actions player `pid` could execute right now (minigame results excluded). */
export function legalActions(g: GameState, pid: PlayerId): Action[] {
  return candidates(g, pid).filter((a) => checkAction(g, pid, a).error === null);
}

/**
 * Actions that apply to the current state of player `pid`, including those that are only blocked
 * for now (e.g. not enough money). The client renders its buttons from these.
 */
export function actionOptions(g: GameState, pid: PlayerId): ActionOption[] {
  const out: ActionOption[] = [];
  for (const action of candidates(g, pid)) {
    const { error, cost } = checkAction(g, pid, action);
    if (error === null || isBlocking(error)) out.push({ action, cost: cost ?? 0, error });
  }
  return out;
}
