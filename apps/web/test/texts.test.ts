import { describe, expect, it } from 'vitest';
import { createGame, playerView, type GameEvent } from '@power-tycoon/engine';
import { reportEventText } from '../src/texts.js';

const view = () => playerView(createGame({ companyName: 'Test AG', autoMinigames: true, seed: 7 }), 0);
const trick = { actorId: 1, targetId: 0, trick: 'hack', siteId: 'nd0' } as const;

describe('report events about tricks on the player', () => {
  it('a caught culprit is good news if the trick failed, mixed news if it succeeded', () => {
    const v = view();
    const failed: GameEvent = { type: 'trickFailed', ...trick, caught: true, fine: 5e6, damages: 3e6 };
    const hit: GameEvent = { type: 'trickSucceeded', ...trick, suspected: true, caught: true, fine: 5e6, damages: 3e6 };
    const plain: GameEvent = { type: 'trickSucceeded', ...trick, suspected: false };
    expect(reportEventText(v, failed)?.kind).toBe('good');
    expect(reportEventText(v, hit)?.kind).toBe('warn');
    expect(reportEventText(v, hit)?.text).toContain('Schadensersatz');
    expect(reportEventText(v, plain)?.kind).toBe('bad');
  });
});
