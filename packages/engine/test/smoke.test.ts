import { describe, expect, it } from 'vitest';
import {
  endQuarter,
  playerView,
  playTurn,
  REGION_KEYS,
  RuleBasedOpponent,
  type GameState,
  type OpponentStrategy,
} from '../src/index.js';
import { newGame } from './helpers.js';

function checkInvariants(g: GameState): void {
  for (const r of REGION_KEYS) {
    const used = g.sites.filter((x) => x.r === r && x.grid).length;
    const view = playerView(g, 0).grid[r];
    expect(view.used).toBeLessThanOrEqual(view.capacity);
    if (used) expect(view.used).toBeGreaterThan(0);
  }
  for (const x of g.sites) {
    if (x.owner < 0) expect(x.type).toBeNull();
    if (x.grid) expect(x.built).toBe(true);
    if (x.built) expect(x.permit).toBe('approved');
    if (x.owner >= 0) expect(g.players[x.owner]!.out).toBe(false);
  }
  for (const p of g.players) {
    expect(Number.isInteger(p.cash)).toBe(true);
    expect(Number.isInteger(p.loan)).toBe(true);
    expect(p.loan).toBeGreaterThanOrEqual(0);
    if (!p.out && !g.over) expect(p.cash).toBeGreaterThanOrEqual(0);
    expect(p.contracts.length).toBeLessThanOrEqual(3);
  }
  expect(g.challenge).toBeNull();
  expect(g.news.length).toBeLessThanOrEqual(80);
}

async function playFullGame(seed: number, seat0?: OpponentStrategy): Promise<GameState> {
  let g = newGame(seed, true);
  const opp = [new RuleBasedOpponent(), new RuleBasedOpponent(), new RuleBasedOpponent()];
  let quarters = 0;
  while (!g.over) {
    if (seat0) g = (await playTurn(g, 0, seat0)).state;
    g = (await endQuarter(g, opp)).state;
    checkInvariants(g);
    quarters++;
    expect(quarters).toBeLessThanOrEqual(40);
  }
  return g;
}

describe('bot-vs-bot smoke games 2026–2035', () => {
  it('plays full games without exceptions and keeps invariants', async () => {
    for (let seed = 1; seed <= 8; seed++) {
      const g = await playFullGame(seed, new RuleBasedOpponent());
      expect(['time', 'bankrupt', 'monopoly']).toContain(g.over);
      if (g.over === 'time') expect(g.year).toBe(2036);
    }
  });

  it('is deterministic: same seed and strategies give the same game', async () => {
    const a = await playFullGame(77, new RuleBasedOpponent());
    const b = await playFullGame(77, new RuleBasedOpponent());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = await playFullGame(78, new RuleBasedOpponent());
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('rival net worth after 10 years is in the legacy range', async () => {
    // Legacy core.js with an idle player (300 games): rivals end at about 120 / 169 / 130 M€.
    const sums = [0, 0, 0];
    const N = 20;
    for (let seed = 100; seed < 100 + N; seed++) {
      const g = await playFullGame(seed);
      const v = playerView(g, 0);
      for (let i = 0; i < 3; i++) sums[i]! += v.players[i + 1]!.out ? 0 : v.players[i + 1]!.worth;
    }
    for (const s of sums) {
      const avg = s / N;
      expect(avg).toBeGreaterThan(60e6);
      expect(avg).toBeLessThan(260e6);
    }
  });
});
