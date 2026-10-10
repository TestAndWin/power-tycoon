/** Balance rules from the October 2026 play-test: depreciation, solar cannibalisation, permit risk, board costs, climate bonus. */
import { describe, expect, it } from 'vitest';
import {
  CAPTURE,
  CO2_BONUS,
  createGame,
  EXEC_GRADES,
  endQuarter,
  PLANT_BOOK,
  PLANT_BOOK_MIN,
  PLANTS,
  playerView,
  REGIONS,
  SOLAR_CANNIBAL_MAX,
  type OpponentStrategy,
} from '../src/index.js';
import { captureRate, crowding, plantBook, rejectChance, siteValue, solarLoad } from '../src/rules.js';
import { newGame, ok, setupSite, site } from './helpers.js';

const idle: OpponentStrategy = { decide: async () => [] };
const idleRivals = [idle, idle, idle];

describe('depreciation', () => {
  it('a new plant is worth less than it cost and loses value while it runs', () => {
    expect(plantBook(0)).toBe(PLANT_BOOK);
    expect(PLANT_BOOK).toBeLessThan(1);
    expect(plantBook(10)).toBeLessThan(plantBook(1));
    expect(plantBook(1000)).toBe(PLANT_BOOK_MIN);
  });

  it('building costs net worth at once', () => {
    const g = newGame(42, true);
    const x = setupSite(g, 'ib0', 0, 'approved', 'solar');
    const before = playerView(g, 0).me.worth;
    const r = ok(g, { type: 'build', siteId: x.id });
    const after = playerView(r.state, 0).me.worth;
    expect(before - after).toBe(Math.round(site(r.state, 'ib0').invested * (1 - PLANT_BOOK)));
  });

  it('a failed assembly keeps the plant on the books until the retry', () => {
    const g = newGame();
    const x = setupSite(g, 'nd0', 0, 'approved', 'wind');
    const before = playerView(g, 0).me.worth;
    let s = ok(g, { type: 'build', siteId: x.id });
    s = ok(s.state, { type: 'minigameResult', challengeId: s.challenge!.id, outcome: 1 });
    s = ok(s.state, { type: 'minigameResult', challengeId: s.challenge!.id, outcome: false });
    expect(site(s.state, 'nd0')).toMatchObject({ built: false, fail: true });
    expect(before - playerView(s.state, 0).me.worth).toBe(Math.round(site(s.state, 'nd0').invested * (1 - PLANT_BOOK)));
    // the permit is lost after all and the type changed: the half-built plant is gone
    const y = site(s.state, 'nd0');
    y.permit = 'rejected';
    s = ok(s.state, { type: 'changePlantType', siteId: 'nd0' });
    expect(site(s.state, 'nd0')).toMatchObject({ fail: false, invested: 0 });
  });

  it('operating quarters lower the book value', async () => {
    const g = newGame();
    const x = setupSite(g, 'ib0', 0, 'operating', 'solar');
    const v0 = siteValue(x);
    const { state } = await endQuarter(g, idleRivals);
    expect(siteValue(site(state, 'ib0'))).toBeLessThan(v0);
  });
});

describe('solar cannibalisation', () => {
  it('more solar in a region lowers the capture rate, most in summer; storage relieves it', () => {
    const g = newGame();
    expect(solarLoad(g.sites, 'ib')).toBe(0);
    expect(captureRate('solar', 2, 0)).toBe(CAPTURE.solar[2]);
    for (const id of ['ib0', 'ib1', 'ib2', 'ib3', 'ib4']) setupSite(g, id, 1, 'operating', 'solar');
    const load = solarLoad(g.sites, 'ib');
    expect(load).toBe(5 * PLANTS.solar.mw);
    const summer = captureRate('solar', 2, load) / CAPTURE.solar[2]!;
    const winter = captureRate('solar', 0, load) / CAPTURE.solar[0]!;
    expect(summer).toBeLessThan(winter);
    expect(winter).toBeLessThan(1);
    expect(captureRate('wind', 2, load)).toBe(CAPTURE.wind[2]);
    expect(captureRate('solar', 2, 1e6)).toBeCloseTo(CAPTURE.solar[2]! * (1 - SOLAR_CANNIBAL_MAX));
    setupSite(g, 'ib5', 2, 'operating', 'batt');
    expect(solarLoad(g.sites, 'ib')).toBeLessThan(load);
    // other regions are not affected
    expect(solarLoad(g.sites, 'nd')).toBe(0);
  });

  it('a solar park earns less per MWh next to many others', async () => {
    const perMwh = async (others: number) => {
      const g = newGame(5);
      const x = setupSite(g, 'ib0', 0, 'operating', 'solar');
      x.sun = 1800;
      for (let i = 1; i <= others; i++) setupSite(g, 'ib' + i, 1, 'operating', 'solar');
      const { report } = await endQuarter(g, idleRivals);
      const spot = report.lines.find((l) => l.kind === 'spot')!;
      return spot.kind === 'spot' ? spot.amount / spot.mwh : 0;
    };
    expect(await perMwh(8)).toBeLessThan((await perMwh(0)) * 0.95);
  });

  it('the view shows the solar load and the yearly loss per region', () => {
    const g = newGame();
    for (const id of ['ib0', 'ib1', 'ib2']) setupSite(g, id, 1, 'operating', 'solar');
    const v = playerView(g, 0);
    expect(v.grid.ib.solarMw).toBe(3 * PLANTS.solar.mw);
    expect(v.grid.ib.solarLoss).toBeGreaterThan(0);
    expect(v.grid.nd.solarLoss).toBe(0);
  });
});

describe('permit risk', () => {
  it('depends on the region and grows with the plants built there', () => {
    const g = newGame();
    const x = setupSite(g, 'ib0', 0, 'leased');
    const r0 = rejectChance(g, x, PLANTS.solar.reject);
    expect(r0).toBeCloseTo(PLANTS.solar.reject + REGIONS.ib.reject);
    for (const id of ['ib1', 'ib2', 'ib3', 'ib4']) setupSite(g, id, 1, 'operating', 'solar');
    expect(crowding(g, 'ib')).toBeGreaterThan(0);
    expect(rejectChance(g, x, PLANTS.solar.reject)).toBeGreaterThan(r0);
  });

  it('is shown before applying (free and own sites) and while the application runs', () => {
    const g = newGame();
    setupSite(g, 'ib0', 0, 'leased');
    const v = playerView(g, 0);
    const own = v.sites.find((s) => s.id === 'ib0')!;
    expect(own.permitRisk?.solar?.std).toBeCloseTo(PLANTS.solar.reject + REGIONS.ib.reject);
    expect(own.permitRisk?.solar?.large).toBeGreaterThan(own.permitRisk!.solar!.std);
    expect(v.sites.find((s) => s.id === 'ib1')!.permitRisk?.solar).toBeDefined();
    // not on a rival's site
    setupSite(g, 'ib2', 1, 'leased');
    expect(playerView(g, 0).sites.find((s) => s.id === 'ib2')!.permitRisk).toBeUndefined();
    g.players[0]!.cash = 100e6;
    const r = ok(g, { type: 'applyPermit', siteId: 'ib0', plantType: 'solar' });
    expect(playerView(r.state, 0).sites.find((s) => s.id === 'ib0')!.own!.permitRisk).toBeCloseTo(
      PLANTS.solar.reject + REGIONS.ib.reject,
    );
  });
});

describe('lawsuit against a granted permit', () => {
  it('delays the plant, but the review confirms the permit unless the lawsuit wins', () => {
    const g = newGame(11);
    const x = setupSite(g, 'ib0', 1, 'approved', 'solar');
    for (const id of ['ib1', 'ib2', 'ib3', 'ib4']) setupSite(g, id, 2, 'operating', 'solar');
    g.players[0]!.intel[1] = g.turn + 3;
    let reviewed = 0;
    for (let seed = 0; seed < 20; seed++) {
      const h = structuredClone(g);
      h.rng = seed;
      const r = ok(h, { type: 'lobby', trick: 'klage', siteId: x.id });
      const y = site(r.state, 'ib0');
      if (y.permit !== 'pending' || y.killed) continue;
      expect(rejectChance(r.state, y, PLANTS.solar.reject)).toBe(0.01);
      reviewed++;
    }
    expect(reviewed).toBeGreaterThan(0);
  });
});

describe('board costs', () => {
  it('scale with the game length', () => {
    const fee = (years: number) =>
      playerView(createGame({ companyName: 'X', autoMinigames: true, seed: 1, years }), 0).execCosts.junior.fee;
    expect(fee(10)).toBe(EXEC_GRADES.junior.fee);
    expect(fee(5)).toBeLessThan(fee(10));
    const g = createGame({ companyName: 'X', autoMinigames: true, seed: 1, years: 5 });
    const r = ok(g, { type: 'hireExecutive', dept: 'dev', grade: 'junior' });
    expect(g.players[0]!.cash - r.state.players[0]!.cash).toBe(fee(5));
  });
});

describe('climate bonus', () => {
  it('pays every company for the CO₂ it avoided at the end of the game', async () => {
    let g = createGame({ companyName: 'X', autoMinigames: true, seed: 3, years: 5 });
    g.players[0]!.co2 = 100_000;
    g.players[1]!.co2 = 50_000;
    let last;
    while (!g.over) {
      last = await endQuarter(g, idleRivals);
      g = last.state;
    }
    expect(last!.report.events).toContainEqual({
      type: 'climateBonus',
      playerId: 0,
      co2: 100_000,
      amount: 100_000 * CO2_BONUS,
    });
    expect(g.news.some((n) => n.event.type === 'climateBonus' && n.event.playerId === 1)).toBe(true);
    // the bonus is in the final net worth
    expect(g.players[0]!.hist.at(-1)).toBe(playerView(g, 0).me.worth);
  });
});

describe('automatic minigame odds', () => {
  it('are shown to a player without minigames', () => {
    expect(playerView(newGame(1, true), 0).autoOdds).toMatchObject({ cable: expect.any(Number) });
    expect(playerView(newGame(1, false), 0).autoOdds).toBeNull();
  });
});
