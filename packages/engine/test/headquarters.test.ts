import { describe, expect, it } from 'vitest';
import {
  DECISION_DATA,
  EXEC_EFFECTS,
  EXEC_GRADES,
  HQ_BOOK,
  HQ_LEVELS,
  MAX_SURVEYS,
  endQuarter,
  playerView,
  plantDef,
  worth,
  type DecisionCard,
  type GameState,
} from '../src/index.js';
import { fails, newGame, ok, setupSite, site } from './helpers.js';

const card = (g: GameState, c: Omit<DecisionCard, 'turn'>, pid = 0): GameState => {
  g.players[pid]!.decision = { ...c, turn: g.turn };
  return g;
};

describe('board', () => {
  it('hires one member per department up to the seats of the headquarters', () => {
    let g = newGame();
    const r = ok(g, { type: 'hireExecutive', dept: 'dev', grade: 'senior' });
    expect(r.events).toContainEqual({
      type: 'executiveHired',
      playerId: 0,
      dept: 'dev',
      grade: 'senior',
      cost: EXEC_GRADES.senior.fee,
    });
    g = r.state;
    expect(g.players[0]!.cash).toBe(30e6 - EXEC_GRADES.senior.fee);
    expect(g.players[0]!.board).toEqual([{ dept: 'dev', grade: 'senior', since: 0 }]);
    // the site container has one seat
    fails(g, { type: 'hireExecutive', dept: 'trade', grade: 'junior' }, 'boardFull');
    g = ok(g, { type: 'upgradeHq' }).state;
    fails(g, { type: 'hireExecutive', dept: 'dev', grade: 'junior' }, 'invalidState');
    g = ok(g, { type: 'hireExecutive', dept: 'trade', grade: 'junior' }).state;
    expect(playerView(g, 0).me.board.map((e) => e.dept)).toEqual(['dev', 'trade']);
  });

  it('dismisses a member against one quarterly salary', () => {
    let g = ok(newGame(), { type: 'hireExecutive', dept: 'law', grade: 'junior' }).state;
    fails(g, { type: 'fireExecutive', dept: 'dev' }, 'invalidTarget');
    const cash = g.players[0]!.cash;
    const r = ok(g, { type: 'fireExecutive', dept: 'law' });
    g = r.state;
    expect(g.players[0]!.board).toEqual([]);
    expect(g.players[0]!.cash).toBe(cash - EXEC_GRADES.junior.salary);
    expect(r.events[0]).toMatchObject({ type: 'executiveLeft', poached: false });
  });

  it('pays salaries and headquarters upkeep at the quarter end', async () => {
    let g = ok(newGame(), { type: 'hireExecutive', dept: 'dev', grade: 'junior' }).state;
    const { report } = await endQuarter(g, []);
    expect(report.lines).toContainEqual({ kind: 'board', amount: -EXEC_GRADES.junior.salary });
    expect(report.lines).toContainEqual({ kind: 'hq', amount: -HQ_LEVELS[0].upkeep });
    expect(playerView(g, 0).me.overhead).toBe(EXEC_GRADES.junior.salary + HQ_LEVELS[0].upkeep);
  });

  it('project development: more surveys and fewer rejections', async () => {
    let g = ok(newGame(), { type: 'hireExecutive', dept: 'dev', grade: 'senior' }).state;
    expect(playerView(g, 0).me.surveysLeft).toBe(MAX_SURVEYS + 2 * EXEC_EFFECTS.dev.surveys);
    expect(playerView(g, 0).me.surveyLimit).toBe(MAX_SURVEYS + 2 * EXEC_EFFECTS.dev.surveys);
    // a permit that would be rejected with 3 % chance is never rejected with a senior (−10 %, at least 1 %)
    let rejected = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = structuredClone(g);
      s.rng = seed;
      const x = setupSite(s, 'ib0', 0, 'leased');
      Object.assign(x, { type: 'batt', permit: 'pending', permitLeft: 1, permitPaid: 1 });
      if (site((await endQuarter(s, [])).state, 'ib0').permit === 'rejected') rejected++;
    }
    expect(rejected).toBeLessThanOrEqual(2);
  });

  it('trading: better price on new contracts', () => {
    let g = ok(newGame(), { type: 'hireExecutive', dept: 'trade', grade: 'senior' }).state;
    const o = g.offers[0]!;
    g = ok(g, { type: 'acceptContract', offerId: o.id }).state;
    expect(g.players[0]!.contracts[0]!.price).toBe(o.price + 2 * EXEC_EFFECTS.trade.ppa);
  });

  it('grid & engineering: cheaper repowering', () => {
    const g = newGame();
    setupSite(g, 'ib0', 0, 'operating', 'solar');
    const before = playerView(g, 0).options.find((o) => o.action.type === 'repower')!.cost;
    const h = ok(g, { type: 'hireExecutive', dept: 'grid', grade: 'junior' }).state;
    const after = playerView(h, 0).options.find((o) => o.action.type === 'repower')!.cost;
    expect(after).toBe(Math.round((before * (1 - EXEC_EFFECTS.grid.repower)) / 1e4) * 1e4);
  });
});

describe('headquarters', () => {
  it('moves up one level at a time and keeps a book value', () => {
    let g = newGame();
    const w0 = worth(g, g.players[0]!);
    const r = ok(g, { type: 'upgradeHq' });
    expect(r.events).toContainEqual({ type: 'hqUpgraded', playerId: 0, level: 1, cost: HQ_LEVELS[1].cost });
    g = r.state;
    expect(worth(g, g.players[0]!)).toBe(w0 - HQ_LEVELS[1].cost * (1 - HQ_BOOK));
    g.players[0]!.cash = 100e6;
    g = ok(ok(g, { type: 'upgradeHq' }).state, { type: 'upgradeHq' }).state;
    expect(playerView(g, 0).me).toMatchObject({ hq: 3, seats: 4 });
    fails(g, { type: 'upgradeHq' }, 'invalidState');
  });

  it('is visible to everybody, the board only with a spy report', () => {
    const g = ok(newGame(), { type: 'upgradeHq' }).state;
    const v = playerView(g, 1);
    expect(v.players[0]!.hq).toBe(1);
    expect(v.players[0]!.intel).toBeUndefined();
  });
});

describe('decision cards', () => {
  it('are dealt at the start of a quarter and closed with the default option', async () => {
    let g = newGame();
    let dealt = 0;
    let closed = 0;
    for (let i = 0; i < 12; i++) {
      const { state, report } = await endQuarter(g, []);
      // the human's open card from last quarter was closed by its default option
      closed += report.events.filter((e) => e.type === 'decisionTaken' && e.auto).length;
      dealt += state.players[0]!.decision ? 1 : 0;
      g = state;
    }
    expect(dealt).toBeGreaterThan(0);
    expect(closed).toBe(dealt - (g.players[0]!.decision ? 1 : 0));
  });

  it('cannot decide without a card, with an unknown or locked option', () => {
    const g = newGame();
    fails(g, { type: 'decide', option: 'apply' }, 'noDecision');
    card(g, { key: 'grant' });
    fails(g, { type: 'decide', option: 'nope' }, 'invalidOption');
    fails(g, { type: 'decide', option: 'lobbyist' }, 'hqLocked');
    const v = playerView(g, 0).me.decision!;
    expect(v.options.map((o) => [o.key, o.minHq, o.default])).toEqual([
      ['apply', 0, false],
      ['skip', 0, true],
      ['lobbyist', 1, false],
    ]);
  });

  it('grant: pays and maybe gets the money', () => {
    const g = card(newGame(), { key: 'grant' });
    const r = ok(g, { type: 'decide', option: 'apply' });
    const e = r.events.find((e) => e.type === 'decisionTaken')!;
    const D = DECISION_DATA.grant;
    expect(r.state.players[0]!.cash).toBe(
      30e6 - D.apply.cost + (e.type === 'decisionTaken' && e.success ? D.amount : 0),
    );
    expect(r.state.players[0]!.decision).toBeNull();
  });

  it('citizens: talking lowers the rejection chance of the project', () => {
    const g = newGame();
    const x = setupSite(g, 'nd0', 0, 'leased');
    Object.assign(x, { type: 'wind', permit: 'pending', permitLeft: 3 });
    card(g, { key: 'citizens', siteId: 'nd0' });
    const s = ok(g, { type: 'decide', option: 'talk' }).state;
    expect(site(s, 'nd0').rejectMod).toBe(-DECISION_DATA.citizens.talk.reject);
    expect(s.players[0]!.cash).toBe(30e6 - DECISION_DATA.citizens.talk.cost);
  });

  it('supplier: a discount on build costs for some quarters', () => {
    const g = newGame();
    setupSite(g, 'ib0', 0, 'approved', 'solar');
    card(g, { key: 'supplier' });
    const before = playerView(g, 0).costs.solar.build;
    const s = ok(g, { type: 'decide', option: 'order' }).state;
    const v = playerView(s, 0);
    expect(v.me.discount).toEqual({
      pct: DECISION_DATA.supplier.order.pct,
      left: DECISION_DATA.supplier.order.quarters,
    });
    expect(v.costs.solar.build).toBe(Math.round((before * (1 - DECISION_DATA.supplier.order.pct)) / 1e4) * 1e4);
  });

  it('heat wave: the grid operator pays, the storage is offline this quarter', () => {
    const g = newGame();
    g.q = 1;
    setupSite(g, 'ib0', 0, 'operating', 'batt');
    card(g, { key: 'heatwave' });
    const gain = playerView(g, 0).me.decision!.options.find((o) => o.key === 'join')!.gain;
    expect(gain).toBeGreaterThan(0);
    const s = ok(g, { type: 'decide', option: 'join' }).state;
    expect(s.players[0]!.cash).toBe(30e6 + gain);
    expect(site(s, 'ib0').offline).toBe(1);
  });

  it('poach: the board member leaves unless the player pays', () => {
    let g = ok(newGame(), { type: 'hireExecutive', dept: 'dev', grade: 'junior' }).state;
    card(g, { key: 'poach', dept: 'dev' });
    const cost = playerView(g, 0).me.decision!.options.find((o) => o.key === 'raise')!.cost;
    expect(cost).toBe(DECISION_DATA.poach.raise * EXEC_GRADES.junior.salary);
    const kept = ok(g, { type: 'decide', option: 'raise' }).state;
    expect(kept.players[0]!.board).toHaveLength(1);
    const r = ok(g, { type: 'decide', option: 'release' });
    expect(r.state.players[0]!.board).toHaveLength(0);
    expect(r.events[0]).toMatchObject({ type: 'executiveLeft', poached: true });
  });

  it('mayor: leases the offered site at a discount', () => {
    const g = newGame();
    setupSite(g, 'ib0', 0, 'leased');
    card(g, { key: 'mayor', siteId: 'ib1' });
    const price = Math.round((site(g, 'ib1').lease * DECISION_DATA.mayor.lease) / 5e4) * 5e4;
    const s = ok(g, { type: 'decide', option: 'lease' }).state;
    expect(site(s, 'ib1').owner).toBe(0);
    expect(s.players[0]!.cash).toBe(30e6 - price);
    // taken by somebody else in the meantime
    site(g, 'ib1').owner = 2;
    fails(g, { type: 'decide', option: 'lease' }, 'invalidState');
  });
});

describe('awards', () => {
  it('gold for the first, silver for later companies', async () => {
    let g = newGame();
    setupSite(g, 'ib0', 0, 'operating', 'solar');
    g = (await endQuarter(g, [])).state;
    expect(g.players[0]!.awards).toEqual([{ key: 'firstPlant', turn: 1, gold: true }]);
    expect(g.news.some((n) => n.event.type === 'awardWon')).toBe(true);
    setupSite(g, 'ib1', 2, 'operating', 'solar');
    g = (await endQuarter(g, [])).state;
    expect(g.players[2]!.awards).toEqual([{ key: 'firstPlant', turn: 2, gold: false }]);
    expect(g.players[0]!.awards).toHaveLength(1);
  });

  it('the annual cup goes to the largest growth in net worth of the year', async () => {
    let g = newGame();
    for (let i = 0; i < 3; i++) g = (await endQuarter(g, [])).state;
    g.players[3]!.cash += 50e6;
    g = (await endQuarter(g, [])).state;
    expect([g.year, g.q]).toEqual([2027, 0]);
    expect(g.players[3]!.awards).toContainEqual({ key: 'cup', turn: 4, gold: true, year: 2026 });
    expect(g.players.filter((p) => p.awards.some((a) => a.key === 'cup'))).toHaveLength(1);
  });

  it('counts offshore, regions, capacity, CO₂ and storage', async () => {
    let g = newGame();
    setupSite(g, 'ns0', 0, 'operating', 'off');
    setupSite(g, 'nd0', 0, 'leased');
    setupSite(g, 'al0', 0, 'leased');
    const x = setupSite(g, 'ib0', 0, 'operating', 'pump');
    x.size = 'large';
    g.players[0]!.co2 = 1e6;
    g = (await endQuarter(g, [])).state;
    expect(g.players[0]!.awards.map((a) => a.key).sort()).toEqual([
      'co2',
      'europe',
      'firstPlant',
      'offshore',
      'storage',
    ]);
    expect(plantDef('pump', 'large').mwh).toBeGreaterThanOrEqual(1000);
  });
});
