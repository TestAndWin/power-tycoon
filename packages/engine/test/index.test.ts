import { describe, expect, it } from 'vitest';
import { createGame, createRng, playerView, REGIONS, SITE_YIELD } from '../src/index.js';
import { newGame } from './helpers.js';

describe('createGame', () => {
  it('creates 4 players, 64 sites and 3 offers', () => {
    const g = newGame(1);
    expect(g.players.map((p) => p.cash)).toEqual([30e6, 30e6, 30e6, 30e6]);
    expect(g.players[0]!.name).toBe('Testwatt AG');
    expect(g.players.slice(1).map((p) => p.name)).toEqual(['Möwenkraft AG', 'Siestasol S.A.', 'Gletscherwerk Holding']);
    expect(g.sites).toHaveLength(64);
    expect(g.sites[0]!.id).toBe('nd0');
    expect(g.sites[63]!.id).toBe('al15');
    expect(g.offers).toHaveLength(3);
    expect(g.grid).toEqual({ nd: 300, ns: 600, ib: 400, al: 300 });
    expect(g.price).toBeCloseTo(95.2);
    expect(g.news[0]!.event.type).toBe('gameStarted');
  });

  it('generates site values around the ranges of their region, with duds and lucky finds', () => {
    const g = newGame(7);
    const values: { v: number; range: [number, number] }[] = [];
    for (const x of g.sites) {
      const R = REGIONS[x.r];
      expect(x.wind === null).toBe(!R.wind);
      expect(x.sun === null).toBe(!R.sun);
      if (R.wind) values.push({ v: x.wind!, range: R.wind });
      if (R.sun) values.push({ v: x.sun!, range: R.sun });
      expect(x.lease % 5e4).toBe(0);
      expect(x.lease).toBeGreaterThanOrEqual(R.lease[0] * 1e6 - 5e4);
      expect(x.lease).toBeLessThanOrEqual(R.lease[1] * 1e6 + 5e4);
    }
    for (const { v, range } of values) {
      expect(v).toBeGreaterThanOrEqual(range[0] * SITE_YIELD.dudFactor[0] - 10);
      expect(v).toBeLessThanOrEqual(range[1] * SITE_YIELD.luckyFactor[1] + 10);
    }
    expect(values.some(({ v, range }) => v < range[0])).toBe(true);
    expect(values.some(({ v, range }) => v > range[1])).toBe(true);
    expect(g.sites.filter((x) => x.hydro).every((x) => x.r === 'al')).toBe(true);
  });

  it('does not reveal the yield through the lease', () => {
    // across many games, the lease of a dud is no lower than that of a normal or lucky site on average
    const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
    const byKind: Record<'dud' | 'normal' | 'lucky', number[]> = { dud: [], normal: [], lucky: [] };
    for (let seed = 1; seed <= 40; seed++) {
      for (const x of newGame(seed).sites.filter((y) => y.r === 'ib')) {
        const [lo, hi] = REGIONS.ib.sun!;
        const span = REGIONS.ib.lease[1] - REGIONS.ib.lease[0];
        const rel = (x.lease / 1e6 - REGIONS.ib.lease[0]) / span;
        byKind[x.sun! < lo ? 'dud' : x.sun! > hi ? 'lucky' : 'normal'].push(rel);
      }
    }
    expect(Math.abs(avg(byKind.dud) - avg(byKind.lucky))).toBeLessThan(0.15);
    expect(Math.abs(avg(byKind.dud) - 0.5)).toBeLessThan(0.1);
  });

  it('is deterministic per seed', () => {
    expect(JSON.stringify(newGame(5))).toBe(JSON.stringify(newGame(5)));
    expect(JSON.stringify(newGame(5))).not.toBe(JSON.stringify(newGame(6)));
  });

  it('falls back to a default company name', () => {
    expect(createGame({ companyName: '   ', autoMinigames: false, seed: 1 }).players[0]!.name).toBe('Mein Konzern');
  });

  it('createRng is reproducible', () => {
    const a = createRng(9);
    const b = createRng(9);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('state is JSON-serializable', () => {
    const g = newGame(3);
    expect(JSON.parse(JSON.stringify(g))).toEqual(g);
    expect(JSON.parse(JSON.stringify(playerView(g, 0)))).toEqual(playerView(g, 0));
  });
});
