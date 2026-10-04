import { describe, expect, it } from 'vitest';
import { createGame, playerView, type GameEvent } from '@power-tycoon/engine';
import { reportEventText } from '../src/texts.js';

const view = () => playerView(createGame({ companyName: 'Test AG', autoMinigames: true, seed: 7 }), 0);
const trick = { actorId: 1, targetId: 0, trick: 'hack', siteId: 'nd0' } as const;

describe('report events about tricks on the player', () => {
  it('a caught culprit is good news if the trick failed, mixed news if it succeeded', () => {
    const v = view();
    const failed: GameEvent = { type: 'trickFailed', ...trick, caught: true, fine: 5e6, damages: 3e6, defended: true };
    const hit: GameEvent = { type: 'trickSucceeded', ...trick, suspected: true, caught: true, fine: 5e6, damages: 3e6 };
    const plain: GameEvent = { type: 'trickSucceeded', ...trick, suspected: false };
    expect(reportEventText(v, failed)?.kind).toBe('good');
    expect(reportEventText(v, hit)?.kind).toBe('warn');
    expect(reportEventText(v, hit)?.text).toContain('Schadensersatz');
    expect(reportEventText(v, plain)?.kind).toBe('bad');
  });

  it('an undiscovered failed attempt tells the target what was fended off, without the actor', () => {
    const v = view();
    const anon = { ...trick, actorId: null, trick: 'klage', caught: false, fine: 0 } as const;
    const byDetectives: GameEvent = { type: 'trickFailed', ...anon, defended: true };
    const plain: GameEvent = { type: 'trickFailed', ...anon, defended: false };
    expect(reportEventText(v, byDetectives)).toMatchObject({ kind: 'good', text: expect.stringContaining('Detektei') });
    expect(reportEventText(v, plain)?.kind).toBe('good');
    expect(reportEventText(v, plain)?.text).not.toContain('Detektei');
  });
});
