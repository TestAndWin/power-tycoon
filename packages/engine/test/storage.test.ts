import { describe, expect, it } from 'vitest';
import { endQuarter, playerView, STORE_MARKET_SHARE, type OpponentStrategy } from '../src/index.js';
import { storeCapacity, storeIncome } from '../src/rules.js';
import { newGame, setupSite } from './helpers.js';

const idle: OpponentStrategy = { decide: async () => [] };

describe('storage income', () => {
  it('earns the full spread for own generation in the region and a discounted spread for the rest', () => {
    const g = newGame();
    const batt = setupSite(g, 'ib0', 0, 'operating', 'batt');
    const solar = setupSite(g, 'ib1', 0, 'operating', 'solar');
    const cap = storeCapacity(batt);
    const inc = storeIncome(g, new Map([[solar.id, cap / 4]]), [batt]).get(batt.id)!;
    expect(inc.ownMwh).toBeCloseTo(cap / 4);
    expect(inc.own).toBeCloseTo((cap / 4) * g.spread);
    expect(inc.market).toBeCloseTo(((cap * 3) / 4) * g.spread * STORE_MARKET_SHARE);
  });

  it('ignores generation of other players and other regions; own storages share the pool in order', () => {
    const g = newGame();
    const a = setupSite(g, 'ib0', 0, 'operating', 'batt');
    const b = setupSite(g, 'ib2', 0, 'operating', 'batt');
    const cap = storeCapacity(a);
    const gen = new Map([
      [setupSite(g, 'ib1', 0, 'operating', 'solar').id, cap * 1.5],
      [setupSite(g, 'ib3', 1, 'operating', 'solar').id, cap * 5],
      [setupSite(g, 'nd0', 0, 'operating', 'wind').id, cap * 5],
    ]);
    const inc = storeIncome(g, gen, [a, b]);
    expect(inc.get(a.id)!.ownMwh).toBeCloseTo(cap);
    expect(inc.get(b.id)!.ownMwh).toBeCloseTo(cap / 2);
  });

  it('books own and market storage lines in the quarter report and shows the estimate in the view', async () => {
    const g = newGame();
    setupSite(g, 'ib0', 0, 'operating', 'batt');
    setupSite(g, 'ib1', 0, 'operating', 'solar');
    const est = playerView(g, 0).sites.find((x) => x.id === 'ib0')!.own!;
    expect(est.storeOwnMwh).toBeGreaterThan(0);
    expect(est.storeRevenue).toBeGreaterThan(0);
    const { report } = await endQuarter(g, [idle, idle, idle]);
    const lines = report.lines.filter((l) => l.kind === 'storage');
    expect(lines.map((l) => l.kind === 'storage' && l.source)).toEqual(['own', 'market']);
  });

  it('a storage without own plants in the region only trades on the market', async () => {
    const g = newGame();
    setupSite(g, 'ib0', 0, 'operating', 'batt');
    const { report } = await endQuarter(g, [idle, idle, idle]);
    expect(report.lines.filter((l) => l.kind === 'storage').map((l) => l.kind === 'storage' && l.source)).toEqual([
      'market',
    ]);
  });
});
