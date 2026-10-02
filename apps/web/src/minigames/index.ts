/**
 * Skill minigames, ported from legacy/src/mini.js. The playing field is generated from the
 * challenge seed; the result (efficiency or success) is sent back to the server.
 */
import { createRng, type Challenge, type ChallengeKind, type Random, type SiteView } from '@power-tycoon/engine';
import { miniCable } from './cable.js';
import { miniFreq } from './frequency.js';
import { miniLayout } from './layout.js';
import { miniRotor } from './rotor.js';

const GAMES: Record<ChallengeKind, (x: SiteView, R: Random) => Promise<number | boolean>> = {
  layout: miniLayout,
  rotor: miniRotor,
  cable: miniCable,
  frequency: miniFreq,
};

/** Plays the minigame for a challenge and resolves with the outcome to report. */
export const playChallenge = (ch: Challenge, x: SiteView): Promise<number | boolean> =>
  GAMES[ch.kind](x, createRng(ch.seed));
