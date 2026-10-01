import { describe, expect, it } from 'vitest';
import { createGame, createRng, ENGINE_VERSION, playerView } from '../src/index.js';
import { newGame } from './helpers.js';

describe('createGame', () => {
  it('creates 4 players, 64 sites and 3 offers', () => {
    const g = newGame(1);
    expect(ENGINE_VERSION).toBe(1);
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

  it('generates site values in the legacy ranges', () => {
    const g = newGame(7);
    for (const x of g.sites) {
      if (x.r === 'nd') expect(x.wind! >= 5.8 && x.wind! <= 7.8 && x.sun! >= 950 && x.sun! <= 1150).toBe(true);
      if (x.r === 'ns') expect(x.wind! >= 8.6 && x.wind! <= 10.4 && x.sun === null).toBe(true);
      if (x.r === 'al') expect(x.wind).toBeNull();
      expect(x.lease % 5e4).toBe(0);
    }
    expect(g.sites.filter((x) => x.hydro).every((x) => x.r === 'al')).toBe(true);
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
