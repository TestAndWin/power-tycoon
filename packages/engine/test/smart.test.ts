import { describe, expect, it } from 'vitest';
import {
  createGame,
  endQuarter,
  legalActions,
  MAX_SURVEYS,
  opponentFor,
  opponentsFor,
  playerView,
  playTurn,
  SmartOpponent,
  SMART_PARAMS,
  type GameState,
  type SmartParams,
} from '../src/index.js';
import { newGame, setupSite } from './helpers.js';

const ctx = (pid = 1) => ({ playerId: pid, profile: { name: 'X', pref: ['nd' as const] }, random: () => 0.5 });
const decide = (g: GameState, pid = 1, params: SmartParams = SMART_PARAMS) =>
  new SmartOpponent(params).decide(playerView(g, pid), legalActions(g, pid), ctx(pid));

async function play(seed: number, rivals = [SMART_PARAMS, SMART_PARAMS, SMART_PARAMS]): Promise<GameState> {
  let g = newGame(seed, true);
  const opp = rivals.map((p) => new SmartOpponent(p));
  while (!g.over) {
    g = (await endQuarter(g, opp)).state;
    for (const p of g.players) if (!p.out && !g.over) expect(p.cash).toBeGreaterThanOrEqual(0);
  }
  return g;
}

describe('SmartOpponent', () => {
  it('every rival plays the smart strategy with its own instance', () => {
    const params = (o: unknown) => (o as SmartOpponent).params;
    expect(params(opponentFor())).toBe(SMART_PARAMS);
    const opp = opponentsFor();
    expect(opp).toHaveLength(3);
    expect(new Set(opp).size).toBe(3);
    expect(createGame({ companyName: 'X', autoMinigames: false, seed: 1 }).settings).toEqual({ autoMinigames: false });
  });

  it('plans actions from the view without minigame results', async () => {
    const g = newGame(5, true);
    const c = { playerId: 1, profile: { name: 'X', pref: ['nd' as const] }, random: () => 0.5 };
    const smart = new SmartOpponent();
    const acts = [
      ...(await smart.explore(playerView(g, 1), legalActions(g, 1), c)),
      ...(await smart.decide(playerView(g, 1), legalActions(g, 1), c)),
    ];
    expect(acts.length).toBeGreaterThan(0);
    for (const a of acts) expect(a.type).not.toBe('minigameResult');
  });

  it('surveys and leases in the same quarter, already in the first one', async () => {
    {
      const { state, events } = await playTurn(newGame(42, true), 1, new SmartOpponent());
      const types = events.map((e) => e.type);
      expect(types).toContain('siteSurveyed');
      expect(types).toContain('siteLeased');
      // a leased site was surveyed first (offshore may be leased blind)
      const leased = events.flatMap((e) => (e.type === 'siteLeased' ? [e.siteId] : []));
      for (const id of leased)
        if (!id.startsWith('ns')) expect(state.sites.find((x) => x.id === id)!.surveyed).toContain(1);
      expect(state.players[1]!.surveyUsed).toBeLessThanOrEqual(MAX_SURVEYS);
    }
  });

  it('plays full games deterministically', async () => {
    const a = await play(31);
    const b = await play(31);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.year).toBe(2036);
  });

  it('the forecast makes the rivals clearly stronger than plain estimates', async () => {
    const plain: SmartParams = { ...SMART_PARAMS, foresight: false, lateGame: false, valueSurveys: false };
    const sum = new Map<SmartParams, number>([
      [SMART_PARAMS, 0],
      [plain, 0],
    ]);
    const order = [SMART_PARAMS, plain];
    const N = 12;
    for (let i = 0; i < N; i++) {
      const seats = [0, 1, 2].map((k) => order[(i + k) % 2]!);
      const v = playerView(await play(200 + i, seats), 0);
      seats.forEach((p, k) => sum.set(p, sum.get(p)! + (v.players[k + 1]!.out ? 0 : v.players[k + 1]!.worth)));
    }
    expect(sum.get(SMART_PARAMS)!).toBeGreaterThan(sum.get(plain)! * 1.1);
  });

  it('sells a leased site that can never be connected (unless selling is switched off)', async () => {
    const g = newGame(7, true);
    g.year = 2030;
    g.turn = 16;
    g.grid.al = 0;
    const x = setupSite(g, 'al3', 1, 'leased');
    const sells = (acts: { type: string }[]) => acts.filter((a) => a.type === 'sellSite');
    expect(sells(await decide(g))).toEqual([{ type: 'sellSite', siteId: x.id }]);
    expect(sells(await decide(g, 1, { ...SMART_PARAMS, sellStuck: false }))).toEqual([]);
  });

  it('strikes back at a human who tricked it, even if the human is no threat', async () => {
    const g = newGame(8, true);
    g.players[1]!.cash = 120e6;
    setupSite(g, 'ns2', 0, 'approved');
    const turn = async (params = SMART_PARAMS) => (await playTurn(g, 1, new SmartOpponent(params))).events;
    const lobby = async (params = SMART_PARAMS) =>
      (await turn(params)).flatMap((e) =>
        e.type === 'trickSucceeded' || e.type === 'trickFailed' ? [{ trick: e.trick, siteId: e.siteId }] : [],
      );
    expect(await lobby()).toEqual([]);
    g.news.unshift({
      year: g.year,
      q: g.q,
      event: { type: 'trickSucceeded', actorId: 0, targetId: 1, trick: 'hack', siteId: 'nd1', suspected: true },
    });
    expect(await lobby()).toEqual([{ trick: 'klage', siteId: 'ns2' }]);
    expect(await lobby({ ...SMART_PARAMS, revenge: false })).toEqual([]);
    // the trick needs a spy report on the human first (bought before the decision)
    const types = (await turn()).map((e) => e.type);
    expect(types.indexOf('spied')).toBeGreaterThanOrEqual(0);
    expect(types.indexOf('spied')).toBeLessThan(types.findIndex((t) => t.startsWith('trick')));
  });

  it('hires detectives after an attack, if it has plants to protect', async () => {
    const g = newGame(9, true);
    setupSite(g, 'nd4', 1, 'operating', 'wind').wind = 7.5;
    const hires = async (params = SMART_PARAMS) =>
      (await decide(g, 1, params)).filter((a) => a.type === 'hireDetectives');
    expect(await hires()).toEqual([]);
    g.news.unshift({
      year: g.year,
      q: g.q,
      event: { type: 'trickSucceeded', actorId: null, targetId: 1, trick: 'bi', siteId: 'nd4', suspected: false },
    });
    expect(await hires()).toEqual([{ type: 'hireDetectives', level: 'pro' }]);
    expect(await hires({ ...SMART_PARAMS, detectives: 'basic' })).toEqual([{ type: 'hireDetectives', level: 'basic' }]);
    g.players[1]!.detectives = { level: 'basic', until: 1 };
    expect(await hires()).toEqual([]);
  });

  it('repowers a good running plant early in the game', async () => {
    const g = newGame(10, true);
    const x = setupSite(g, 'ns3', 1, 'operating', 'off');
    x.wind = 10.4;
    g.players[1]!.cash = 150e6;
    const repowers = async () => (await decide(g)).filter((a) => a.type === 'repower');
    expect(await repowers()).toEqual([{ type: 'repower', siteId: 'ns3' }]);
    // not in the last quarters: the plant would be offline without paying off
    g.year = 2035;
    g.q = 3;
    g.turn = 39;
    expect(await repowers()).toEqual([]);
  });
});
