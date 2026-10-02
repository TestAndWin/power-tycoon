import { describe, expect, it } from 'vitest';
import { createGame, playerView, type GameState, type Site } from '@power-tycoon/engine';
import { S } from '../src/state.js';
import { btn, disabledUnless, optionFor, siteStatus, todo } from '../src/ui/common.js';

function game(setup: (g: GameState, site: (id: string) => Site) => void): void {
  const g = createGame({ companyName: 'Test AG', autoMinigames: true, seed: 7 });
  setup(g, (id) => g.sites.find((s) => s.id === id)!);
  S.view = playerView(g, 0);
  S.busy = false;
}

describe('site status and open tasks', () => {
  it('derives the stage and lists the tasks for own sites only', () => {
    game((_g, site) => {
      Object.assign(site('nd0'), { owner: 0 });
      Object.assign(site('nd1'), { owner: 0, type: 'wind', permit: 'approved' });
      Object.assign(site('nd2'), { owner: 0, type: 'wind', permit: 'approved', built: true, grid: true, fault: true });
      Object.assign(site('nd3'), { owner: 1 });
    });
    const v = S.view!;
    const status = (id: string) => siteStatus(v.sites.find((s) => s.id === id)!);
    expect(status('nd0')).toMatchObject({ code: 'leased', t: 'Gepachtet', k: 'warn' });
    expect(status('nd1')).toMatchObject({ code: 'ready', t: 'Baureif' });
    expect(status('nd2')).toMatchObject({ code: 'fault', k: 'bad' });
    expect(status('nd4')).toMatchObject({ code: 'free', t: 'Frei' });
    expect(todo().map((t) => [t.x.id, t.t, t.k])).toEqual([
      ['nd0', 'ND-01: Genehmigung beantragen', 'warn'],
      ['nd1', 'ND-02: bauen', 'warn'],
      ['nd2', 'ND-03: Störung beheben', 'bad'],
    ]);
  });
});

describe('buttons from the engine options', () => {
  it('shows the price and disables blocked options', () => {
    game((g, site) => {
      Object.assign(site('nd0'), { owner: 0, type: 'wind', permit: 'approved', built: true });
      g.grid.nd = 0;
    });
    const connect = optionFor({ type: 'connectGrid', siteId: 'nd0' })!;
    expect(connect.error).toBe('noGridCapacity');
    expect(btn('connect', 'nd0', 'Ans Netz', connect)).toContain('disabled');
    const lease = optionFor({ type: 'lease', siteId: 'nd5' })!;
    expect(btn('lease', 'nd5', 'Pachten', lease)).not.toContain('disabled');
    expect(optionFor({ type: 'build', siteId: 'nd0' })).toBeUndefined();
  });
  it('fixed buttons follow the engine rules (partial repayment is allowed)', () => {
    game((g) => {
      g.players[0]!.loan = 3e6;
    });
    expect(disabledUnless({ type: 'repay', amount: 5e6 })).toBe('');
    expect(disabledUnless({ type: 'borrow', amount: 50e9 })).toBe('disabled');
    S.busy = true;
    expect(disabledUnless({ type: 'repay', amount: 5e6 })).toBe('disabled');
  });
});
