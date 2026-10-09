import { describe, expect, it } from 'vitest';
import { createGame, playerView } from '@power-tycoon/engine';
import { S, UI } from '../src/state.js';
import { vSites } from '../src/ui/sites.js';

describe('site detail', () => {
  it('puts the missing-money hint of the repowering below the button, not beside it', () => {
    const g = createGame({ companyName: 'Test AG', autoMinigames: true, seed: 7 });
    Object.assign(
      g.sites.find((x) => x.id === 'nd1')!,
      {
        owner: 0,
        type: 'wind',
        permit: 'approved',
        built: true,
        grid: true,
      },
    );
    g.players[0]!.cash = 1e6;
    S.view = playerView(g, 0);
    Object.assign(UI, { region: 'nd', sel: 'nd1' });
    const html = vSites();
    expect(html).toContain('Es fehlen');
    expect(html).toMatch(/<div class="withinfo">(?:(?!<\/div>).)*data-act="repower"/s);
    expect(html).not.toMatch(/<div class="withinfo">(?:(?!<\/div>).)*Es fehlen/s);
  });
});
