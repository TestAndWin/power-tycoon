import type { OpponentStrategy } from '../types.js';
import { SmartOpponent } from './smart.js';

/** Strategy for one rival. */
export const opponentFor = (): OpponentStrategy => new SmartOpponent();

/** The three rivals of a game (each with its own instance). */
export const opponentsFor = (): OpponentStrategy[] => [opponentFor(), opponentFor(), opponentFor()];
