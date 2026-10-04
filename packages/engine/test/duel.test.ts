import { describe, expect, it } from 'vitest';
import {
  applyAction,
  DUEL_PACE,
  DUEL_REFUND,
  DUEL_RESERVE_QUARTERS,
  PLANTS,
  playerView,
  type GameState,
} from '../src/index.js';
import { newGame, ok, setupSite, site } from './helpers.js';

/** Human with a built wind park in Norddeutschland, rival 2 with one waiting for the grid there. */
function scarce(free: number, seed = 42): GameState {
  const g = newGame(seed);
  setupSite(g, 'nd0', 0, 'built', 'wind');
  setupSite(g, 'nd1', 2, 'built', 'wind');
  g.grid.nd = free;
  return g;
}

describe('cable duel', () => {
  it('a plain cable puzzle while there is enough capacity', () => {
    const r = ok(scarce(PLANTS.wind.mw * 2), { type: 'connectGrid', siteId: 'nd0' });
    expect(r.challenge).toMatchObject({ kind: 'cable' });
    expect(r.challenge!.rival).toBeUndefined();
  });
  it('a duel against a rival of the region when capacity is scarce', () => {
    const g = scarce(PLANTS.wind.mw * 2 - 1);
    g.settings.difficulty = 'hard';
    const r = ok(g, { type: 'connectGrid', siteId: 'nd0' });
    expect(r.challenge).toMatchObject({ kind: 'cableDuel', rival: { playerId: 2, pace: DUEL_PACE.hard } });
    expect(playerView(r.state, 0).challenge).toEqual(r.challenge);
  });
  it('no duel without a rival in the region', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'built', 'wind');
    g.grid.nd = PLANTS.wind.mw;
    expect(ok(g, { type: 'connectGrid', siteId: 'nd0' }).challenge).toMatchObject({ kind: 'cable' });
  });
  it('winning connects the plant', () => {
    const r = ok(scarce(PLANTS.wind.mw), { type: 'connectGrid', siteId: 'nd0' });
    const w = ok(r.state, { type: 'minigameResult', challengeId: r.challenge!.id, outcome: true });
    expect(w.events[0]).toMatchObject({ type: 'gridDuel', rivalId: 2, won: true, refund: 0 });
    expect(w.events[1]).toMatchObject({ type: 'gridConnected' });
    expect(site(w.state, 'nd0').grid).toBe(true);
  });
  it('losing refunds half the costs and the rival grabs the capacity for its project', () => {
    const g = scarce(PLANTS.wind.mw);
    const r = ok(g, { type: 'connectGrid', siteId: 'nd0' });
    const l = ok(r.state, { type: 'minigameResult', challengeId: r.challenge!.id, outcome: false });
    const refund = Math.round(PLANTS.wind.grid * DUEL_REFUND);
    expect(l.events).toEqual([
      {
        type: 'gridDuel',
        playerId: 0,
        rivalId: 2,
        siteId: 'nd0',
        won: false,
        refund,
        reservedMw: PLANTS.wind.mw,
      },
    ]);
    expect(l.state.players[0]!.cash).toBe(30e6 - PLANTS.wind.grid + refund);
    expect(l.state.res).toEqual([{ pid: 2, r: 'nd', mw: PLANTS.wind.mw, left: DUEL_RESERVE_QUARTERS }]);
    expect(playerView(l.state, 0).grid.nd.free).toBe(0);
    // the rival may connect into its reservation
    expect(playerView(l.state, 2).grid.nd.free).toBe(PLANTS.wind.mw);
    // the duel is news for everybody
    expect(playerView(l.state, 1).news.some((n) => n.event.type === 'gridDuel')).toBe(true);
  });
  it('rivals and automatic minigames resolve the duel by a seeded roll', () => {
    let won = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const g = scarce(PLANTS.wind.mw, seed);
      g.settings.autoMinigames = true;
      const r = applyAction(g, 0, { type: 'connectGrid', siteId: 'nd0' });
      if (!r.ok) throw new Error(r.error);
      expect(r.challenge).toBeNull();
      const d = r.events.find((e) => e.type === 'gridDuel')!;
      if (d.type === 'gridDuel' && d.won) won++;
    }
    expect(won).toBeGreaterThan(40);
    expect(won).toBeLessThan(72);
  });
});
