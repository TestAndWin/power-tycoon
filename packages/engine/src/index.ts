export const ENGINE_VERSION = 1;

export * from './types.js';
export * from './data.js';
export { createRng, rand, randint, pick, shuffle, gauss, clamp, type Random } from './rng.js';
export { createGame, type CreateGameOptions } from './game.js';
export { applyAction, validateAction } from './actions.js';
export { legalActions } from './legal.js';
export { playerView } from './view.js';
export { endQuarter, canEndQuarter, playTurn, rivalProfile, EngineError, MAX_ACTIONS_PER_TURN } from './quarter.js';
export { eventForViewer, eventsForViewer, worth } from './rules.js';
export { RuleBasedOpponent } from './opponents/ruleBased.js';
export { SmartOpponent, SMART_PARAMS, type SmartLevel, type SmartParams } from './opponents/smart.js';
export { opponentFor, opponentsFor } from './opponents/index.js';
