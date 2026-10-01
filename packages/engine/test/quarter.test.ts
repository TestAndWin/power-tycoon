import { describe, expect, it } from 'vitest';
import {
  endQuarter,
  EngineError,
  playerView,
  playTurn,
  RuleBasedOpponent,
  type Action,
  type OpponentStrategy,
} from '../src/index.js';
import { newGame, ok, setupSite, site } from './helpers.js';

const idle: OpponentStrategy = { decide: async () => [] };
const idleRivals = [idle, idle, idle];

describe('endQuarter', () => {
  it('advances the quarter and records history', async () => {
    const g = newGame();
    const { state, report, rivalActions } = await endQuarter(g, idleRivals);
    expect(state).not.toBe(g);
    expect(g.turn).toBe(0);
    expect([state.year, state.q, state.turn]).toEqual([2026, 1, 1]);
    expect(state.priceHist).toHaveLength(2);
    expect(state.players[0]!.hist).toHaveLength(2);
    expect(report).toMatchObject({ year: 2026, q: 0, startCash: 30e6 });
    expect(rivalActions.map((r) => r.playerId)).toEqual([1, 2, 3]);
    expect(state.fx).toBeNull();
    expect(state.offers.length).toBe(3);
  });

  it('decides permits when the countdown runs out', async () => {
    let g = newGame();
    setupSite(g, 'ib0', 0, 'leased');
    g = ok(g, { type: 'applyPermit', siteId: 'ib0', plantType: 'solar' }).state; // 1 quarter
    const { state, report } = await endQuarter(g, idleRivals);
    const x = site(state, 'ib0');
    expect(['approved', 'rejected']).toContain(x.permit);
    expect(report.events).toContainEqual({
      type: 'permitDecided',
      playerId: 0,
      siteId: 'ib0',
      plantType: 'solar',
      approved: x.permit === 'approved',
    });
  });

  it('a successful lawsuit can kill a permit', async () => {
    const g = newGame();
    const x = setupSite(g, 'nd0', 0, 'leased');
    Object.assign(x, { type: 'wind', permit: 'pending', permitLeft: 0, killed: true });
    const { state } = await endQuarter(g, idleRivals);
    expect(site(state, 'nd0')).toMatchObject({ permit: 'rejected', killed: false });
  });

  it('counts down and expires reservations', async () => {
    let g = newGame();
    g.res.push({ pid: 0, r: 'nd', mw: 50, left: 1 }, { pid: 1, r: 'ib', mw: 50, left: 3 });
    g = (await endQuarter(g, idleRivals)).state;
    expect(g.res).toEqual([{ pid: 1, r: 'ib', mw: 50, left: 2 }]);
  });

  it('books generation, opex, lease and interest; report lines add up', async () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = newGame(seed);
      setupSite(g, 'nd0', 0, 'operating', 'wind');
      setupSite(g, 'al0', 0, 'operating', 'batt');
      g.players[0]!.loan = 10e6;
      g.players[0]!.contracts.push({
        id: 99,
        buyer: 'Stahlwerk Qualmstedt',
        vol: 30000,
        quarters: 4,
        price: 100,
        left: 1,
      });
      const { state, report } = await endQuarter(g, idleRivals);
      const sum = report.lines.reduce((s, l) => s + l.amount, 0);
      const emergency = report.events
        .filter((e) => e.type === 'loanTaken')
        .reduce((s, e) => s + (e.type === 'loanTaken' ? e.amount : 0), 0);
      expect(report.endCash).toBe(state.players[0]!.cash);
      expect(report.endCash - report.startCash).toBe(sum + emergency);
      expect(report.lines.find((l) => l.kind === 'interest')!.amount).toBe(-120000);
      expect(report.lines.some((l) => l.kind === 'ppa')).toBe(true);
      expect(state.players[0]!.contracts).toHaveLength(0);
      expect(report.events).toContainEqual({ type: 'contractExpired', playerId: 0, buyer: 'Stahlwerk Qualmstedt' });
    }
  });

  it('PPA shortfalls are bought at the exchange price + 15 %', async () => {
    const g = newGame(3);
    g.players[0]!.contracts.push({ id: 1, buyer: 'B', vol: 1000, quarters: 4, price: 100, left: 4 });
    const { report } = await endQuarter(g, idleRivals);
    const ppa = report.lines.find((l) => l.kind === 'ppa')!;
    expect(ppa).toMatchObject({ shortfall: 1000 });
    expect(ppa.amount).toBe(Math.round(1000 * (100 - report.price * 1.15)));
  });

  it('grants an emergency loan or ends the game by bankruptcy', async () => {
    const g = newGame();
    g.players[0]!.cash = -5.5e6;
    const r1 = await endQuarter(g, idleRivals);
    expect(r1.state.players[0]!.loan).toBe(6e6);
    expect(r1.report.events.some((e) => e.type === 'loanTaken' && e.emergency)).toBe(true);
    const g2 = newGame();
    g2.players[0]!.cash = -100e6;
    expect((await endQuarter(g2, idleRivals)).state.over).toBe('bankrupt');
  });

  it('insolvent rivals drop out and free their sites', async () => {
    const g = newGame();
    setupSite(g, 'nd0', 2, 'operating', 'wind');
    g.res.push({ pid: 2, r: 'nd', mw: 50, left: 3 });
    g.players[2]!.cash = -500e6;
    const { state, report } = await endQuarter(g, idleRivals);
    expect(state.players[2]!.out).toBe(true);
    expect(site(state, 'nd0').owner).toBe(-1);
    expect(state.res).toEqual([]);
    expect(state.players[2]!.hist.at(-1)).toBeNull();
    expect(report.events).toContainEqual({ type: 'playerBankrupt', playerId: 2 });
  });

  it('is blocked while a challenge is open and after the game is over', async () => {
    const g = newGame();
    setupSite(g, 'nd0', 0, 'approved', 'wind');
    const open = ok(g, { type: 'build', siteId: 'nd0' }).state;
    await expect(endQuarter(open, idleRivals)).rejects.toMatchObject({ code: 'challengeOpen' });
    const over = newGame();
    over.over = 'time';
    await expect(endQuarter(over, idleRivals)).rejects.toBeInstanceOf(EngineError);
  });

  it('ends after 40 quarters with reason "time" and applies historic events', async () => {
    let g = newGame(11);
    let n = 0;
    const keys: string[] = [];
    while (!g.over) {
      const r = await endQuarter(g, idleRivals);
      keys.push(...r.report.events.filter((e) => e.type === 'historicEvent').map((e) => (e as { key: string }).key));
      g = r.state;
      n++;
    }
    expect(n).toBe(40);
    expect(g.over).toBe('time');
    expect([g.year, g.q]).toEqual([2036, 0]);
    expect(keys).toEqual(['ets2', 'grid2030', 'hydrogen', 'coalExit', 'eu2040']);
    expect(g.ppaBoost).toBe(1.6);
    expect(g.spreadAdd).toBe(20);
  });

  it('resets the trick limit each quarter', async () => {
    const g = newGame();
    g.players[0]!.trickUsed = 2;
    g.players[1]!.trickUsed = 1;
    const { state } = await endQuarter(g, idleRivals);
    expect(state.players.map((p) => p.trickUsed)).toEqual([0, 0, 0, 0]);
  });
});

describe('rival turns', () => {
  it('applies strategy actions through the normal validation and logs rejected ones', async () => {
    const g = newGame();
    const actions: Action[] = [
      { type: 'lease', siteId: 'ib3' },
      { type: 'lease', siteId: 'ib3' }, // taken by itself now
      { type: 'borrow', amount: 999e6 },
    ];
    const seen: { legal: number; cash: number }[] = [];
    const s: OpponentStrategy = {
      decide: async (view, legal) => {
        seen.push({ legal: legal.length, cash: view.me.cash });
        return actions;
      },
    };
    const { state, rivalActions } = await endQuarter(g, [s, idle, idle]);
    expect(site(state, 'ib3').owner).toBe(1);
    expect(seen[0]!.cash).toBe(30e6);
    expect(seen[0]!.legal).toBeGreaterThan(50);
    const ev = rivalActions[0]!.events;
    expect(ev[0]).toMatchObject({ type: 'siteLeased', playerId: 1, siteId: 'ib3' });
    // rejected actions are private to the rival
    expect(ev.some((e) => e.type === 'actionRejected')).toBe(false);
  });

  it('a throwing strategy does nothing', async () => {
    const bad: OpponentStrategy = {
      decide: async () => {
        throw new Error('boom');
      },
    };
    const { state } = await endQuarter(newGame(), [bad, bad, bad]);
    expect(state.players.slice(1).every((p) => p.cash <= 30e6)).toBe(true);
    expect(state.sites.every((x) => x.owner === -1)).toBe(true);
  });

  it('rival view hides other players’ survey data', async () => {
    const g = ok(newGame(), { type: 'survey', siteId: 'nd0' }).state;
    let rivalView: ReturnType<typeof playerView> | null = null;
    const spy: OpponentStrategy = {
      decide: async (v) => {
        rivalView = v;
        return [];
      },
    };
    await endQuarter(g, [spy, idle, idle]);
    const v = rivalView as unknown as ReturnType<typeof playerView>;
    expect(v.sites.find((s) => s.id === 'nd0')!.wind).toBeNull();
    expect(v.sites.find((s) => s.id === 'nd0')!.surveyed).toBe(false);
    expect(JSON.stringify(v)).not.toContain('"rng"');
  });

  it('the rule-based rivals expand over a few quarters', async () => {
    let g = newGame(21);
    const opp = [new RuleBasedOpponent(), new RuleBasedOpponent(), new RuleBasedOpponent()];
    for (let i = 0; i < 12; i++) g = (await endQuarter(g, opp)).state;
    for (const pid of [1, 2, 3]) expect(g.sites.filter((x) => x.owner === pid).length).toBeGreaterThan(0);
    expect(g.sites.some((x) => x.owner > 0 && x.grid)).toBe(true);
  });

  it('playTurn runs a strategy for any seat', async () => {
    const g = newGame(2, true);
    const { state } = await playTurn(g, 0, new RuleBasedOpponent());
    expect(state.turn).toBe(0);
    expect(JSON.stringify(state)).not.toBe(JSON.stringify(g));
  });
});
