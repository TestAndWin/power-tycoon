import { describe, expect, it } from 'vitest';
import {
  createGame,
  endQuarter,
  legalActions,
  opponentFor,
  opponentsFor,
  playerView,
  RuleBasedOpponent,
  SmartOpponent,
  type Difficulty,
  type GameState,
} from '../src/index.js';
import { newGame, setupSite } from './helpers.js';

const ctx = (pid = 1) => ({ playerId: pid, profile: { name: 'X', pref: ['nd' as const] }, random: () => 0.5 });
const decide = (level: 'normal' | 'hard', g: GameState, pid = 1) =>
  new SmartOpponent(level).decide(playerView(g, pid), legalActions(g, pid), ctx(pid));

async function play(seed: number, rivals: Difficulty[]): Promise<GameState> {
  let g = newGame(seed, true);
  const opp = rivals.map((d) => opponentFor(d));
  while (!g.over) {
    g = (await endQuarter(g, opp)).state;
    for (const p of g.players) if (!p.out && !g.over) expect(p.cash).toBeGreaterThanOrEqual(0);
  }
  return g;
}

describe('SmartOpponent', () => {
  it('maps difficulties to strategies; old games without difficulty keep the legacy rivals', () => {
    expect(opponentFor('easy')).toBeInstanceOf(RuleBasedOpponent);
    expect(opponentFor(undefined)).toBeInstanceOf(RuleBasedOpponent);
    expect(opponentFor('normal')).toBeInstanceOf(SmartOpponent);
    expect(opponentsFor('hard')).toHaveLength(3);
    expect(createGame({ companyName: 'X', autoMinigames: false, seed: 1 }).settings.difficulty).toBe('normal');
  });

  it('plans actions from the view without minigame results', async () => {
    const g = newGame(5, true);
    const acts = await new SmartOpponent('hard').decide(playerView(g, 1), legalActions(g, 1), {
      playerId: 1,
      profile: { name: 'X', pref: ['nd'] },
      random: () => 0.5,
    });
    expect(acts.length).toBeGreaterThan(0);
    for (const a of acts) expect(a.type).not.toBe('minigameResult');
  });

  it('plays full games deterministically', async () => {
    const a = await play(31, ['normal', 'hard', 'normal']);
    const b = await play(31, ['normal', 'hard', 'normal']);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.year).toBe(2036);
  });

  it('is clearly stronger than the legacy rivals on average', async () => {
    const sum: Record<Difficulty, number> = { easy: 0, normal: 0, hard: 0 };
    const order: Difficulty[] = ['easy', 'normal', 'hard'];
    const N = 12;
    for (let i = 0; i < N; i++) {
      const seats = [0, 1, 2].map((k) => order[(i + k) % 3]!);
      const v = playerView(await play(200 + i, seats), 0);
      seats.forEach((d, k) => (sum[d] += v.players[k + 1]!.out ? 0 : v.players[k + 1]!.worth));
    }
    expect(sum.normal).toBeGreaterThan(sum.easy * 1.3);
    expect(sum.hard).toBeGreaterThan(sum.easy * 1.3);
    expect(sum.hard).toBeGreaterThan(sum.normal * 1.2);
  });

  it('hard sells a leased site that can never be connected, normal keeps it', async () => {
    const g = newGame(7, true);
    g.year = 2030;
    g.turn = 16;
    g.grid.al = 0;
    const x = setupSite(g, 'al3', 1, 'leased');
    const sells = (acts: { type: string }[]) => acts.filter((a) => a.type === 'sellSite');
    expect(sells(await decide('hard', g))).toEqual([{ type: 'sellSite', siteId: x.id }]);
    expect(sells(await decide('normal', g))).toEqual([]);
  });

  it('hard strikes back at a human who tricked it, even if the human is no threat', async () => {
    const g = newGame(8, true);
    g.players[1]!.cash = 120e6;
    setupSite(g, 'ns2', 0, 'approved');
    const lobby = async (level: 'normal' | 'hard') => (await decide(level, g)).filter((a) => a.type === 'lobby');
    expect(await lobby('hard')).toEqual([]);
    g.news.unshift({
      year: g.year,
      q: g.q,
      event: { type: 'trickSucceeded', actorId: 0, targetId: 1, trick: 'hack', siteId: 'nd1', suspected: true },
    });
    expect(await lobby('hard')).toEqual([{ type: 'lobby', trick: 'klage', siteId: 'ns2' }]);
    expect(await lobby('normal')).toEqual([]);
  });
});
