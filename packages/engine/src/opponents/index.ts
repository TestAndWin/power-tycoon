import type { Difficulty, OpponentStrategy } from '../types.js';
import { SmartOpponent } from './smart.js';

/**
 * Strategy for one rival at the given difficulty. Games stored before phase 6 have no difficulty
 * and old ones may still say `easy` (the removed legacy rivals): they play against `normal`.
 */
export const opponentFor = (difficulty: Difficulty | 'easy' | undefined): OpponentStrategy =>
  new SmartOpponent(difficulty === 'hard' ? 'hard' : 'normal');

/** The three rivals of a game. */
export const opponentsFor = (difficulty: Difficulty | 'easy' | undefined): OpponentStrategy[] => [
  opponentFor(difficulty),
  opponentFor(difficulty),
  opponentFor(difficulty),
];
