import { describe, expect, it } from 'vitest';
import { CREDIT_SALES_QUARTERS, endQuarter, MIN_CREDIT, type OpponentStrategy } from '../src/index.js';
import { creditParts, worth } from '../src/rules.js';
import { newGame, setupSite } from './helpers.js';

const idle: OpponentStrategy = { decide: async () => [] };

describe('credit limit', () => {
  it('counts half the assets but not the cash', () => {
    const g = newGame();
    const p = g.players[0]!;
    expect(creditParts(g, p)).toEqual({ assets: 0, sales: 0, boost: 0, limit: MIN_CREDIT });
    for (const id of ['nd0', 'nd1', 'nd2', 'nd3', 'nd4']) setupSite(g, id, 0, 'operating', 'wind');
    // the same assets for every rival, so nobody is behind
    for (const pid of [1, 2, 3] as const)
      for (const i of [0, 1, 2, 3, 4]) setupSite(g, ['ns', 'ib', 'al'][pid - 1]! + i, pid, 'operating', 'wind');
    const assets = worth(g, p) - p.cash;
    expect(creditParts(g, p).assets).toBe(Math.round(assets * 0.5));
    p.cash += 100e6;
    expect(creditParts(g, p).assets).toBe(Math.round(assets * 0.5));
  });

  it('adds twice the average power sales of the last quarters', () => {
    const g = newGame();
    g.players[0]!.sales = [10e6, 20e6];
    expect(creditParts(g, g.players[0]!)).toMatchObject({ sales: 30e6, limit: 30e6 });
  });

  it('records the sales of each quarter', async () => {
    let g = newGame();
    for (let i = 0; i < CREDIT_SALES_QUARTERS + 2; i++) g = (await endQuarter(g, [idle, idle, idle])).state;
    expect(g.players[0]!.sales).toHaveLength(CREDIT_SALES_QUARTERS);
  });

  it('gives a development loan from 10 % behind the leader', () => {
    const g = newGame();
    const [me, rival] = [g.players[0]!, g.players[1]!];
    rival.cash += 3e6; // 9 % behind: nothing
    expect(creditParts(g, me).boost).toBe(0);
    rival.cash += 67e6; // 70 behind a leader worth 100
    expect(creditParts(g, me)).toMatchObject({ boost: 21e6, limit: 21e6 });
    expect(creditParts(g, rival).boost).toBe(0);
  });
});
