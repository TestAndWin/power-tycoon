import { describe, expect, it } from 'vitest';
import {
  applyAction,
  endQuarter,
  legalActions,
  optionsOf,
  plantTypesFor,
  playerView,
  PLANTS,
  trickTargetIds,
  validateAction,
  type GameState,
  type OpponentStrategy,
} from '../src/index.js';
import { fails, newGame, ok, setupSite, site } from './helpers.js';

const idle: OpponentStrategy = { decide: async () => [] };
const idleRivals = [idle, idle, idle];

describe('survey', () => {
  it('reveals site data to the player only', () => {
    const g = newGame();
    expect(playerView(g, 0).sites.find((s) => s.id === 'nd3')!.wind).toBeNull();
    const r = ok(g, { type: 'survey', siteId: 'nd3' });
    expect(r.state.players[0]!.cash).toBe(30e6 - 0.05e6);
    const v = playerView(r.state, 0).sites.find((s) => s.id === 'nd3')!;
    expect(v.known).toBe(true);
    expect(v.wind).toBe(site(g, 'nd3').wind);
    expect(playerView(r.state, 1).sites.find((s) => s.id === 'nd3')!.wind).toBeNull();
    expect(r.events[0]).toMatchObject({ type: 'siteSurveyed', playerId: 0, siteId: 'nd3', cost: 50000 });
  });
  it('costs 0.3 M€ offshore and rejects violations', () => {
    const g = newGame();
    expect(ok(g, { type: 'survey', siteId: 'ns0' }).state.players[0]!.cash).toBe(29.7e6);
    const s2 = ok(g, { type: 'survey', siteId: 'nd0' }).state;
    fails(s2, { type: 'survey', siteId: 'nd0' }, 'alreadySurveyed');
    fails(g, { type: 'survey', siteId: 'xx9' }, 'unknownSite');
    setupSite(g, 'nd1', 1, 'leased');
    fails(g, { type: 'survey', siteId: 'nd1' }, 'siteTaken');
    g.players[0]!.cash = 1000;
    fails(g, { type: 'survey', siteId: 'nd2' }, 'insufficientFunds');
  });
});

describe('lease', () => {
  it('leases a free site', () => {
    const g = newGame();
    const lease = site(g, 'ib2').lease;
    const r = ok(g, { type: 'lease', siteId: 'ib2' });
    expect(site(r.state, 'ib2').owner).toBe(0);
    expect(r.state.players[0]!.cash).toBe(30e6 - lease);
    expect(r.events).toEqual([{ type: 'siteLeased', playerId: 0, siteId: 'ib2', amount: lease }]);
    expect(r.state.news[0]!.event.type).toBe('siteLeased');
    // original state untouched
    expect(site(g, 'ib2').owner).toBe(-1);
    fails(r.state, { type: 'lease', siteId: 'ib2' }, 'siteTaken', 1);
  });
  it('needs enough cash', () => {
    const g = newGame();
    g.players[0]!.cash = 0;
    fails(g, { type: 'lease', siteId: 'ib2' }, 'insufficientFunds');
  });
});

describe('permits', () => {
  it('applies for an allowed plant type', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'leased');
    const r = ok(g, { type: 'applyPermit', siteId: 'nd0', plantType: 'wind' });
    const x = site(r.state, 'nd0');
    expect(x.type).toBe('wind');
    expect(x.permit).toBe('pending');
    expect(x.permitLeft).toBeGreaterThanOrEqual(2);
    expect(x.permitLeft).toBeLessThanOrEqual(4);
    expect(r.state.players[0]!.cash).toBe(30e6 - 0.3e6);
    expect(r.events[0]).toMatchObject({ type: 'permitApplied', quarters: x.permitLeft });
  });
  it('rejects wrong types, foreign sites and wrong stages', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'leased');
    fails(g, { type: 'applyPermit', siteId: 'nd0', plantType: 'off' }, 'invalidPlantType');
    fails(g, { type: 'applyPermit', siteId: 'nd1', plantType: 'wind' }, 'notOwner');
    const al = g.sites.find((x) => x.r === 'al' && !x.hydro)!;
    al.owner = 0;
    fails(g, { type: 'applyPermit', siteId: al.id, plantType: 'hydro' }, 'invalidPlantType');
    const pending = ok(g, { type: 'applyPermit', siteId: 'nd0', plantType: 'wind' }).state;
    fails(pending, { type: 'applyPermit', siteId: 'nd0', plantType: 'wind' }, 'invalidState');
    fails(pending, { type: 'changePlantType', siteId: 'nd0' }, 'invalidState');
  });
  it('allows re-applying or changing the type after a rejection', () => {
    const g = newGame();
    const x = setupSite(g, 'nd0', 0, 'approved', 'wind');
    x.permit = 'rejected';
    fails(g, { type: 'applyPermit', siteId: 'nd0', plantType: 'solar' }, 'invalidPlantType');
    expect(site(ok(g, { type: 'applyPermit', siteId: 'nd0', plantType: 'wind' }).state, 'nd0').permit).toBe('pending');
    const c = ok(g, { type: 'changePlantType', siteId: 'nd0' }).state;
    expect(site(c, 'nd0')).toMatchObject({ type: null, permit: null });
    expect(site(ok(c, { type: 'applyPermit', siteId: 'nd0', plantType: 'solar' }).state, 'nd0').type).toBe('solar');
  });
  it('replaces a running application with another plant type', () => {
    const g = newGame();
    const x = setupSite(g, 'nd0', 0, 'approved', 'wind');
    x.permit = 'pending';
    x.permitLeft = 3;
    const s = site(ok(g, { type: 'applyPermit', siteId: 'nd0', plantType: 'solar' }).state, 'nd0');
    expect(s).toMatchObject({ type: 'solar', permit: 'pending', permitLeft: 1 });
    expect(s.alt ?? null).toBeNull();
  });
  it('keeps an approved permit while applying for another type, until the decision', async () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'approved', 'wind');
    const r = ok(g, { type: 'applyPermit', siteId: 'nd0', plantType: 'solar' });
    expect(site(r.state, 'nd0')).toMatchObject({ type: 'wind', permit: 'approved', alt: { type: 'solar', left: 1 } });
    expect(r.state.players[0]!.cash).toBe(30e6 - 0.15e6);
    fails(r.state, { type: 'applyPermit', siteId: 'nd0', plantType: 'solar' }, 'invalidState');
    fails(r.state, { type: 'applyPermit', siteId: 'nd0', plantType: 'wind' }, 'invalidState');
    // granted (solar is rejected in 5 %; seed 42 grants it): the new type replaces the old permit
    const granted = (await endQuarter(r.state, idleRivals)).state;
    expect(site(granted, 'nd0')).toMatchObject({ type: 'solar', permit: 'approved', alt: null });
    // building drops a running alternative application
    const alt = ok(g, { type: 'applyPermit', siteId: 'nd0', plantType: 'solar' }).state;
    expect(site(ok(alt, { type: 'build', siteId: 'nd0' }).state, 'nd0').alt).toBeNull();
  });
  it('a rejected alternative keeps the approved permit', async () => {
    const g = newGame();
    const x = setupSite(g, 'nd0', 0, 'approved', 'wind');
    x.alt = { type: 'solar', left: 1 };
    // force the rejection
    const reject = PLANTS.solar.reject;
    PLANTS.solar.reject = 1;
    try {
      const { state, report } = await endQuarter(g, idleRivals);
      expect(site(state, 'nd0')).toMatchObject({ type: 'wind', permit: 'approved', alt: null });
      expect(report.events).toContainEqual(
        expect.objectContaining({
          type: 'permitDecided',
          siteId: 'nd0',
          plantType: 'solar',
          approved: false,
          previous: 'wind',
        }),
      );
    } finally {
      PLANTS.solar.reject = reject;
    }
  });
});

describe('build with minigame challenges', () => {
  it('wind: layout then rotor', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'approved', 'wind');
    const r1 = ok(g, { type: 'build', siteId: 'nd0' });
    const cost = PLANTS.wind.build; // year 0: no learning yet
    expect(r1.state.players[0]!.cash).toBe(30e6 - cost);
    expect(r1.challenge).toMatchObject({ kind: 'layout', siteId: 'nd0' });
    expect(typeof r1.challenge!.seed).toBe('number');
    expect(playerView(r1.state, 0).challenge).toEqual(r1.challenge);
    // only the minigame result is accepted now
    fails(r1.state, { type: 'lease', siteId: 'nd5' }, 'challengeOpen');
    fails(r1.state, { type: 'minigameResult', challengeId: 999, outcome: 1 }, 'challengeMismatch');
    fails(r1.state, { type: 'minigameResult', challengeId: r1.challenge!.id, outcome: true }, 'invalidOutcome');
    const r2 = ok(r1.state, { type: 'minigameResult', challengeId: r1.challenge!.id, outcome: 5 });
    expect(site(r2.state, 'nd0').eff).toBe(1.15); // clamped
    expect(r2.challenge).toMatchObject({ kind: 'rotor' });
    const r3 = ok(r2.state, { type: 'minigameResult', challengeId: r2.challenge!.id, outcome: true });
    expect(r3.challenge).toBeNull();
    expect(site(r3.state, 'nd0')).toMatchObject({ built: true, fail: false, invested: cost });
    expect(r3.events.map((e) => e.type)).toEqual(['plantBuilt']);
    expect(legalActions(r3.state, 0).length).toBeGreaterThan(0);
  });
  it('a failed rotor assembly can be retried for 10 % of the cost', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'approved', 'wind');
    let s = ok(g, { type: 'build', siteId: 'nd0' });
    s = ok(s.state, { type: 'minigameResult', challengeId: s.challenge!.id, outcome: 0.95 });
    s = ok(s.state, { type: 'minigameResult', challengeId: s.challenge!.id, outcome: false });
    expect(site(s.state, 'nd0')).toMatchObject({ built: false, fail: true, eff: 0.95 });
    expect(s.events[0]!.type).toBe('assemblyFailed');
    const cash = s.state.players[0]!.cash;
    s = ok(s.state, { type: 'build', siteId: 'nd0' });
    expect(s.state.players[0]!.cash).toBe(cash - 2e6);
    expect(s.challenge!.kind).toBe('rotor');
    s = ok(s.state, { type: 'minigameResult', challengeId: s.challenge!.id, outcome: true });
    expect(site(s.state, 'nd0')).toMatchObject({ built: true, fail: false, invested: 20e6 });
  });
  it('solar only has a layout, batteries build without minigame', () => {
    const g = newGame();
    setupSite(g, 'ib0', 0, 'approved', 'solar');
    setupSite(g, 'ib1', 0, 'approved', 'batt');
    g.players[0]!.cash = 60e6;
    const s = ok(g, { type: 'build', siteId: 'ib0' });
    expect(s.challenge!.kind).toBe('layout');
    const s2 = ok(s.state, { type: 'minigameResult', challengeId: s.challenge!.id, outcome: 0.5 });
    expect(site(s2.state, 'ib0')).toMatchObject({ built: true, eff: 0.8 });
    const b = ok(s2.state, { type: 'build', siteId: 'ib1' });
    expect(b.challenge).toBeNull();
    expect(site(b.state, 'ib1')).toMatchObject({ built: true, eff: 1 });
  });
  it('autoMinigames resolves challenges in the engine', () => {
    const g = newGame(42, true);
    setupSite(g, 'nd0', 0, 'approved', 'wind');
    const r = ok(g, { type: 'build', siteId: 'nd0' });
    expect(r.challenge).toBeNull();
    expect(r.state.challenge).toBeNull();
    const eff = site(r.state, 'nd0').eff;
    expect(eff).toBeGreaterThanOrEqual(0.9);
    expect(eff).toBeLessThanOrEqual(1.08);
    expect(r.events.some((e) => e.type === 'layoutRated')).toBe(true);
  });
  it('rejects building before approval and without money', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'leased');
    fails(g, { type: 'build', siteId: 'nd0' }, 'invalidState');
    setupSite(g, 'ns0', 0, 'approved', 'off');
    fails(g, { type: 'build', siteId: 'ns0' }, 'insufficientFunds');
  });
  it('learning curve lowers build costs over time', () => {
    const g = newGame();
    g.year = 2031;
    expect(playerView(g, 0).costs.solar.build).toBe(Math.round((15e6 * Math.pow(0.96, 5)) / 1e4) * 1e4);
  });
});

describe('grid', () => {
  it('connects with the cable minigame and consumes reservations', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'built', 'wind');
    let r = ok(g, { type: 'reserveGrid', region: 'nd' });
    expect(r.state.res).toEqual([{ pid: 0, r: 'nd', mw: 50, left: 4 }]);
    expect(r.state.players[0]!.cash).toBe(30e6 - 0.8e6);
    r = ok(r.state, { type: 'connectGrid', siteId: 'nd0' });
    expect(r.challenge!.kind).toBe('cable');
    r = ok(r.state, { type: 'minigameResult', challengeId: r.challenge!.id, outcome: true });
    expect(site(r.state, 'nd0').grid).toBe(true);
    expect(r.state.res).toEqual([{ pid: 0, r: 'nd', mw: 26, left: 4 }]);
    expect(playerView(r.state, 0).grid.nd).toMatchObject({ used: 24, capacity: 300, myReserved: 26 });
  });
  it('a failed connection keeps the money spent', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'built', 'wind');
    let r = ok(g, { type: 'connectGrid', siteId: 'nd0' });
    r = ok(r.state, { type: 'minigameResult', challengeId: r.challenge!.id, outcome: false });
    expect(site(r.state, 'nd0').grid).toBe(false);
    expect(r.state.players[0]!.cash).toBe(30e6 - 1.2e6);
  });
  it('rejects connections without free capacity (rival reservations count)', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'built', 'wind');
    g.res.push({ pid: 1, r: 'nd', mw: 290, left: 3 });
    fails(g, { type: 'connectGrid', siteId: 'nd0' }, 'noGridCapacity');
    fails(g, { type: 'reserveGrid', region: 'nd' }, 'noGridCapacity');
    fails(g, { type: 'reserveGrid', region: 'xx' as 'nd' }, 'unknownRegion');
  });
});

describe('repairs and selling', () => {
  it('repairs by service or by the frequency minigame', () => {
    const g = newGame();
    const x = setupSite(g, 'nd0', 0, 'operating', 'wind');
    fails(g, { type: 'repairService', siteId: 'nd0' }, 'invalidState');
    x.fault = true;
    const s = ok(g, { type: 'repairService', siteId: 'nd0' });
    expect(site(s.state, 'nd0').fault).toBe(false);
    expect(s.state.players[0]!.cash).toBe(30e6 - 0.8e6);
    let f = ok(g, { type: 'repairSelf', siteId: 'nd0' });
    expect(f.challenge!.kind).toBe('frequency');
    f = ok(f.state, { type: 'minigameResult', challengeId: f.challenge!.id, outcome: false });
    expect(site(f.state, 'nd0').fault).toBe(true);
    expect(f.state.players[0]!.cash).toBe(30e6 - 0.1e6);
  });
  it('sells a site for 85 % of its value', () => {
    const g = newGame();
    const x = setupSite(g, 'nd0', 0, 'operating', 'wind');
    const value = x.lease * 0.6 + 0.3e6 + 10e6 + 1.2e6 * 0.8;
    const r = ok(g, { type: 'sellSite', siteId: 'nd0' });
    expect(r.state.players[0]!.cash).toBe(30e6 + Math.round(value * 0.85));
    expect(site(r.state, 'nd0')).toMatchObject({ owner: -1, type: null, built: false, grid: false });
    fails(r.state, { type: 'sellSite', siteId: 'nd0' }, 'notOwner');
  });
});

describe('contracts and bank', () => {
  it('accepts up to three contracts', () => {
    let g = newGame();
    for (let i = 0; i < 3; i++) {
      g.offers.push({ id: 900 + i, buyer: 'X', vol: 5000, quarters: 4, price: 90, expires: 5 });
      g = ok(g, { type: 'acceptContract', offerId: 900 + i }).state;
    }
    expect(g.players[0]!.contracts).toHaveLength(3);
    expect(g.players[0]!.contracts[0]).toMatchObject({ left: 4 });
    fails(g, { type: 'acceptContract', offerId: g.offers[0]!.id }, 'contractLimit');
    fails(newGame(), { type: 'acceptContract', offerId: 12345 }, 'unknownOffer');
  });
  it('borrows within the credit limit and repays', () => {
    const g = newGame();
    expect(playerView(g, 0).me.creditLimit).toBe(20e6);
    let s = ok(g, { type: 'borrow', amount: 20e6 }).state;
    expect(s.players[0]).toMatchObject({ cash: 50e6, loan: 20e6 });
    expect(playerView(s, 0).me.creditLimit).toBe(30e6);
    fails(s, { type: 'borrow', amount: 11e6 }, 'creditLimit');
    fails(g, { type: 'borrow', amount: -5 }, 'invalidAmount');
    fails(g, { type: 'repay', amount: 'all' }, 'invalidAmount');
    s = ok(s, { type: 'repay', amount: 5e6 }).state;
    expect(s.players[0]).toMatchObject({ cash: 45e6, loan: 15e6 });
    s = ok(s, { type: 'repay', amount: 'all' }).state;
    expect(s.players[0]).toMatchObject({ cash: 30e6, loan: 0 });
  });
});

describe('lobby tricks', () => {
  const target = () => {
    const g = newGame();
    setupSite(g, 'nd0', 1, 'operating', 'wind');
    setupSite(g, 'nd1', 2, 'approved', 'wind');
    return g;
  };
  it('validates targets and the per-quarter limit for every player', () => {
    const g = target();
    fails(g, { type: 'lobby', trick: 'klage', siteId: 'nd0' }, 'invalidTarget');
    fails(g, { type: 'lobby', trick: 'bi', siteId: 'nd1' }, 'invalidTarget');
    fails(g, { type: 'lobby', trick: 'nope' as 'bi', siteId: 'nd1' }, 'unknownTrick');
    let s = ok(g, { type: 'lobby', trick: 'klage', siteId: 'nd1' }).state;
    s = ok(s, { type: 'lobby', trick: 'hack', siteId: 'nd0' }).state;
    expect(playerView(s, 0).me.tricksLeft).toBe(0);
    fails(s, { type: 'lobby', trick: 'klage', siteId: 'nd1' }, 'trickLimit');
    // rivals have the same limit
    setupSite(s, 'nd2', 0, 'approved', 'wind');
    let r = ok(s, { type: 'lobby', trick: 'klage', siteId: 'nd2' }, 3).state;
    r = ok(r, { type: 'lobby', trick: 'klage', siteId: 'nd1' }, 3).state;
    fails(r, { type: 'lobby', trick: 'klage', siteId: 'nd2' }, 'trickLimit', 3);
  });
  it('has the legacy effects and hides the actor unless suspected', () => {
    let succeeded = 0;
    let failed = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const g = newGame(seed);
      setupSite(g, 'nd0', 1, 'operating', 'wind');
      const r = ok(g, { type: 'lobby', trick: 'bi', siteId: 'nd0' });
      const e = r.events[0]!;
      if (e.type === 'trickSucceeded') {
        succeeded++;
        expect(site(r.state, 'nd0').curtail).toBe(2);
        const seen = playerView(r.state, 1).news.find((n) => n.event.type === 'trickSucceeded')!.event;
        expect(seen).toMatchObject({ actorId: e.suspected ? 0 : null, targetId: 1 });
      } else if (e.type === 'trickFailed') {
        failed++;
        expect(r.state.players[0]!.cash).toBe(30e6 - 0.4e6 - (e.caught ? 1.5e6 : 0));
        const seen = playerView(r.state, 1).news.find((n) => n.event.type === 'trickFailed');
        expect(!!seen).toBe(e.caught);
      }
    }
    expect(succeeded).toBeGreaterThan(20);
    expect(failed).toBeGreaterThan(5);
  });
  it('hack takes a plant off the grid, klage delays a permit', () => {
    const g = target();
    for (let seed = 1; seed < 40; seed++) {
      g.rng = seed;
      const h = applyAction(g, 0, { type: 'lobby', trick: 'hack', siteId: 'nd0' });
      if (h.ok && h.events[0]!.type === 'trickSucceeded') {
        expect(site(h.state, 'nd0').fault).toBe(true);
        break;
      }
    }
    for (let seed = 1; seed < 40; seed++) {
      g.rng = seed;
      const k = applyAction(g, 0, { type: 'lobby', trick: 'klage', siteId: 'nd1' });
      if (k.ok && k.events[0]!.type === 'trickSucceeded') {
        const x = site(k.state, 'nd1');
        expect(x.permit).toBe('pending');
        expect(x.killed ? x.permitLeft === 0 : x.permitLeft === 2).toBe(true);
        expect(JSON.stringify(playerView(k.state, 2))).not.toContain('killed');
        break;
      }
    }
  });
});

describe('general validation', () => {
  it('rejects actions after game over and for unknown players', () => {
    const g = newGame();
    expect(validateAction(g, 7, { type: 'borrow', amount: 1e6 })).toBe('unknownPlayer');
    g.over = 'time';
    fails(g, { type: 'borrow', amount: 1e6 }, 'gameOver');
    expect(legalActions(g, 0)).toEqual([]);
    expect(validateAction(newGame(), 0, { type: 'fly' } as never)).toBe('unknownAction');
  });
  it('legalActions only contains valid actions', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'leased');
    setupSite(g, 'nd1', 1, 'operating');
    const legal = legalActions(g, 0);
    expect(legal.every((a) => validateAction(g, 0, a) === null)).toBe(true);
    expect(legal).toContainEqual({ type: 'applyPermit', siteId: 'nd0', plantType: 'wind' });
    expect(legal).toContainEqual({ type: 'lobby', trick: 'hack', siteId: 'nd1' });
    expect(legal).toContainEqual({ type: 'borrow', amount: 20e6 });
    expect(legal).not.toContainEqual({ type: 'applyPermit', siteId: 'nd0', plantType: 'off' });
  });
  it('a lobby trick on a non-target is invalidTarget even after the quarterly limit', () => {
    const g = newGame();
    setupSite(g, 'nd1', 2, 'approved', 'wind');
    g.players[0]!.trickUsed = 2;
    fails(g, { type: 'lobby', trick: 'bi', siteId: 'nd1' }, 'invalidTarget');
    fails(g, { type: 'lobby', trick: 'klage', siteId: 'nd1' }, 'trickLimit');
  });
});

describe('action options in the player view', () => {
  const opts = (g: GameState) => playerView(g, 0).options;
  it('lists allowed and blocked actions with their price, but not inapplicable ones', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'built', 'wind');
    setupSite(g, 'nd1', 1, 'approved', 'wind');
    g.grid.nd = 0;
    const o = opts(g);
    // blocked by grid capacity, price still known
    expect(o).toContainEqual({
      action: { type: 'connectGrid', siteId: 'nd0' },
      cost: PLANTS.wind.grid,
      error: 'noGridCapacity',
    });
    expect(o).toContainEqual({ action: { type: 'sellSite', siteId: 'nd0' }, cost: 0, error: null });
    // already built: no permit or build options
    expect(o.some((x) => x.action.type === 'build' && x.action.siteId === 'nd0')).toBe(false);
    expect(o).toContainEqual({ action: { type: 'lobby', trick: 'klage', siteId: 'nd1' }, cost: 0.5e6, error: null });
    expect(o.some((x) => x.action.type === 'lobby' && x.action.trick === 'bi' && x.action.siteId === 'nd1')).toBe(
      false,
    );
    expect(trickTargetIds(playerView(g, 0), 'klage')).toEqual(['nd1']);
    // money blocks, but the option stays visible
    g.players[0]!.cash = 0;
    expect(opts(g)).toContainEqual({
      action: { type: 'lease', siteId: 'nd2' },
      cost: site(g, 'nd2').lease,
      error: 'insufficientFunds',
    });
  });
  it('offers only the plant types allowed on the site', () => {
    const g = newGame();
    const flat = g.sites.find((x) => x.r === 'al' && !x.hydro)!;
    const slope = g.sites.find((x) => x.r === 'al' && x.hydro)!;
    setupSite(g, flat.id, 0, 'leased');
    setupSite(g, slope.id, 0, 'leased');
    const types = (id: string) =>
      optionsOf(playerView(g, 0), 'applyPermit')
        .filter((o) => o.action.siteId === id)
        .map((o) => o.action.plantType);
    expect(types(flat.id)).toEqual(['solar', 'batt']);
    expect(types(slope.id)).toEqual(['solar', 'batt', 'hydro', 'pump']);
    expect(plantTypesFor({ r: 'al', hydro: null })).toEqual(['solar', 'batt']);
  });
  it('allowed options are exactly the legal actions; partial repayment is allowed', () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'leased');
    setupSite(g, 'nd1', 1, 'operating');
    g.players[0]!.loan = 3e6;
    const allowed = opts(g)
      .filter((o) => o.error === null)
      .map((o) => o.action);
    expect(allowed).toEqual(legalActions(g, 0));
    expect(allowed).toContainEqual({ type: 'repay', amount: 5e6 });
    g.challenge = { id: 1, kind: 'cable', siteId: 'nd0', seed: 1, playerId: 0, step: 'connect' };
    expect(opts(g)).toEqual([]);
  });
});
