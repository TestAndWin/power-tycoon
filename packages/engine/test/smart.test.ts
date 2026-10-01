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
import { newGame } from './helpers.js';

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
  });
});
