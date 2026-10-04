import { describe, expect, it } from 'vitest';
import { endQuarter, LARGE, PLANTS, plantDef, playerView, REPOWER_FACTOR, worth } from '../src/index.js';
import { fails, newGame, ok, setupSite, site } from './helpers.js';

describe('plant sizes', () => {
  it('large plants have more capacity for a bit less than proportional costs', () => {
    for (const t of Object.keys(PLANTS) as (keyof typeof PLANTS)[]) {
      const S = plantDef(t),
        L = plantDef(t, 'large');
      expect(L.mw).toBe(Math.round(S.mw * LARGE.mw));
      expect(L.build / L.mw).toBeLessThan(S.build / S.mw);
      expect(L.grid).toBeGreaterThan(S.grid);
      if (S.mwh) expect(L.mwh).toBe(Math.round(S.mwh * LARGE.mw));
    }
    expect(plantDef('wind')).toBe(PLANTS.wind);
  });
  it('the size is chosen with the permit and carried through build and grid connection', () => {
    let g = newGame(42, true);
    setupSite(g, 'nd0', 0, 'leased');
    const L = plantDef('wind', 'large');
    const r = ok(g, { type: 'applyPermit', siteId: 'nd0', plantType: 'wind', size: 'large' });
    expect(r.events[0]).toMatchObject({ type: 'permitApplied', size: 'large', cost: L.permit });
    expect(site(r.state, 'nd0').size).toBe('large');
    // a change of mind to the other size of the same type is a new application
    ok(r.state, { type: 'applyPermit', siteId: 'nd0', plantType: 'wind', size: 'std' });
    fails(r.state, { type: 'applyPermit', siteId: 'nd0', plantType: 'wind', size: 'large' }, 'invalidState');
    g = r.state;
    site(g, 'nd0').permit = 'approved';
    const v = playerView(g, 0);
    expect(v.sites.find((s) => s.id === 'nd0')).toMatchObject({ size: 'large', mw: L.mw });
    const b = ok(g, { type: 'build', siteId: 'nd0' });
    expect(b.events[0]).toMatchObject({ type: 'buildStarted', cost: v.costsLarge.wind.build });
    g = b.state;
    const x = site(g, 'nd0');
    x.built = true;
    x.fail = false;
    g.players[0]!.cash = 50e6;
    for (let seed = 1; seed < 40 && !site(g, 'nd0').grid; seed++) {
      g.rng = seed;
      const c = ok(g, { type: 'connectGrid', siteId: 'nd0' });
      if (c.events.some((e) => e.type === 'gridConnected')) {
        expect(c.events.find((e) => e.type === 'gridConnected')).toMatchObject({ mw: L.mw, cost: L.grid });
        expect(playerView(c.state, 0).grid.nd.used).toBe(L.mw);
        g = c.state;
      }
    }
    expect(site(g, 'nd0').grid).toBe(true);
  });
  it('the grid must have room for the large plant', () => {
    const g = newGame();
    const x = setupSite(g, 'nd0', 0, 'built', 'wind');
    x.size = 'large';
    g.grid.nd = plantDef('wind', 'large').mw - 1;
    fails(g, { type: 'connectGrid', siteId: 'nd0' }, 'noGridCapacity');
  });
});

describe('repowering', () => {
  it('upgrades a standard plant, needs grid room and takes it offline for a quarter', async () => {
    const g = newGame();
    const x = setupSite(g, 'nd0', 0, 'operating', 'wind');
    const extra = plantDef('wind', 'large').mw - PLANTS.wind.mw;
    const v = playerView(g, 0);
    const opt = v.options.find((o) => o.action.type === 'repower')!;
    expect(opt.error).toBeNull();
    expect(opt.cost).toBe(
      Math.round(((v.costsLarge.wind.build - v.costs.wind.build) * REPOWER_FACTOR) / 1e4) * 1e4 +
        v.costsLarge.wind.grid -
        v.costs.wind.grid,
    );
    // no room for the extra capacity
    const full = structuredClone(g);
    full.grid.nd = PLANTS.wind.mw + extra - 1;
    fails(full, { type: 'repower', siteId: 'nd0' }, 'noGridCapacity');

    const r = ok(g, { type: 'repower', siteId: 'nd0' });
    expect(r.events[0]).toMatchObject({ type: 'repowered', mw: PLANTS.wind.mw + extra, cost: opt.cost });
    const y = site(r.state, 'nd0');
    const L = plantDef('wind', 'large');
    // grid and permit of the large plant are booked by `siteValue`, not as investment
    const invested = x.invested + opt.cost - (L.grid - PLANTS.wind.grid) - (L.permit - PLANTS.wind.permit);
    expect(y).toMatchObject({ size: 'large', offline: 1, invested });
    // the net worth does not grow by more than the money spent
    expect(worth(r.state, r.state.players[0]!)).toBeLessThanOrEqual(worth(g, g.players[0]!));
    expect(playerView(r.state, 0).grid.nd.used).toBe(PLANTS.wind.mw + extra);
    fails(r.state, { type: 'repower', siteId: 'nd0' }, 'invalidState');

    // offline quarter: no generation, then back with more capacity
    const q1 = await endQuarter(r.state, []);
    expect(q1.report.gen).toBe(0);
    expect(site(q1.state, 'nd0').offline).toBe(0);
    let gen = 0;
    let s = q1.state;
    for (let i = 0; i < 4 && gen === 0; i++) {
      const q = await endQuarter(s, []);
      gen = q.report.gen;
      s = q.state;
    }
    expect(gen).toBeGreaterThan(0);
  });
  it('is not possible for plants that are not running', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'built', 'wind');
    fails(g, { type: 'repower', siteId: 'nd0' }, 'invalidState');
    const y = setupSite(g, 'nd1', 0, 'operating', 'wind');
    y.fault = true;
    fails(g, { type: 'repower', siteId: 'nd1' }, 'invalidState');
    setupSite(g, 'nd2', 1, 'operating', 'wind');
    fails(g, { type: 'repower', siteId: 'nd2' }, 'notOwner');
  });
});

describe('repowering – review fixes', () => {
  it('the forecast leaves out a plant that is offline for repowering', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'operating', 'wind');
    const before = playerView(g, 0);
    expect(before.me.nextGen).toBeGreaterThan(0);
    const r = ok(g, { type: 'repower', siteId: 'nd0' });
    const v = playerView(r.state, 0);
    expect(v.me.nextGen).toBe(0);
    expect(v.sites.find((s) => s.id === 'nd0')!.own!.genEstimate).toBe(0);
  });
});
