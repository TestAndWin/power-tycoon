/**
 * Awards (phase 8): recognition without effect on the rules. Each company can win each award once – gold for
 * the first to reach it, silver later. The annual cup goes to the largest growth in net worth of a game year.
 */
import { AWARDS } from './data.js';
import { emit } from './events.js';
import { isStore, mwOf, operating, siteDef } from './rules.js';
import type { AwardKey, GameEvent, GameState, Player } from './types.js';

type Goal = Exclude<AwardKey, 'cup'>;

/** Progress of player `p` towards an award (compared with `AWARDS[k].goal`; the first two need 1). */
export function awardProgress(g: GameState, p: Player, k: Goal): number {
  const own = g.sites.filter((x) => x.owner === p.id);
  switch (k) {
    case 'firstPlant':
      return own.some(operating) ? 1 : 0;
    case 'offshore':
      return own.some((x) => operating(x) && x.type === 'off') ? 1 : 0;
    case 'europe':
      return new Set(own.map((x) => x.r)).size;
    case 'mw500':
      return mwOf(g, p.id);
    case 'co2':
      return Math.round(p.co2);
    case 'storage':
      return own
        .filter((x) => operating(x) && x.type && isStore(x.type))
        .reduce((s, x) => s + (siteDef(x).mwh ?? 0), 0);
  }
}
const goalOf = (k: Goal): number => Math.max(1, AWARDS[k].goal);

/**
 * Hands out the awards reached by the end of this quarter, and at the start of a new year the annual cup of the
 * year before. Runs after the history step of `nextQuarter`.
 */
export function checkAwards(g: GameState, out: GameEvent[]): void {
  const active = g.players.filter((p) => !p.out);
  for (const k of Object.keys(AWARDS) as Goal[]) {
    const had = g.players.some((p) => p.awards.some((a) => a.key === k));
    for (const p of active) {
      if (p.awards.some((a) => a.key === k) || awardProgress(g, p, k) < goalOf(k)) continue;
      p.awards.push({ key: k, turn: g.turn, gold: !had });
      emit(g, out, { type: 'awardWon', playerId: p.id, award: k, gold: !had });
    }
  }
  // a new year has begun: the cup for the largest growth in net worth over the year before
  if (g.q !== 0 || g.turn < 4) return;
  const growth = (p: Player) => (p.hist[g.turn] ?? 0) - (p.hist[g.turn - 4] ?? 0);
  const best = active.reduce<Player | null>(
    (a, p) =>
      !a || growth(p) > growth(a) || (growth(p) === growth(a) && (p.hist[g.turn] ?? 0) > (a.hist[g.turn] ?? 0)) ? p : a,
    null,
  );
  if (!best) return;
  const year = g.year - 1;
  best.awards.push({ key: 'cup', turn: g.turn, gold: true, year });
  emit(g, out, { type: 'awardWon', playerId: best.id, award: 'cup', gold: true, year });
}
