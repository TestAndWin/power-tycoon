import type { Difficulty, OpponentStrategy } from '../types.js';
import { RuleBasedOpponent } from './ruleBased.js';
import { SmartOpponent } from './smart.js';

/** Strategy for one rival at the given difficulty (`easy` = legacy rival AI). */
export function opponentFor(difficulty: Difficulty | undefined): OpponentStrategy {
  if (difficulty === 'normal' || difficulty === 'hard') return new SmartOpponent(difficulty);
  return new RuleBasedOpponent();
}

/** The three rivals of a game. Games without a stored difficulty keep the legacy rivals. */
export const opponentsFor = (difficulty: Difficulty | undefined): OpponentStrategy[] => [
  opponentFor(difficulty),
  opponentFor(difficulty),
  opponentFor(difficulty),
];
