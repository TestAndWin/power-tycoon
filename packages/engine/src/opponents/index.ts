import type { Difficulty, OpponentStrategy } from '../types.js';
import { SmartOpponent } from './smart.js';

/** Strategy for one rival at the given difficulty. */
export const opponentFor = (difficulty: Difficulty): OpponentStrategy => new SmartOpponent(difficulty);

/** The three rivals of a game. */
export const opponentsFor = (difficulty: Difficulty): OpponentStrategy[] => [
  opponentFor(difficulty),
  opponentFor(difficulty),
  opponentFor(difficulty),
];
