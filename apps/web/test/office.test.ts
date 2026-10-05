import { describe, expect, it } from 'vitest';
import { applyAction, createGame, playerView, type GameState, type Site } from '@power-tycoon/engine';
import { S } from '../src/state.js';
import { decisionCard, vAwards, vBoard } from '../src/ui/board.js';
import { boardTalk } from '../src/ui/office.js';
import { decisionResultText, newsTexts, reportEventText } from '../src/texts.js';

function game(setup: (g: GameState, site: (id: string) => Site) => GameState | void): GameState {
  let g = createGame({ companyName: 'Test AG', autoMinigames: true, seed: 7 });
  g = setup(g, (id) => g.sites.find((s) => s.id === id)!) ?? g;
  S.view = playerView(g, 0);
  S.busy = false;
  S.call = null;
  return g;
}

describe('the board talks', () => {
  it('the assistant speaks for a vacant department, a board member for its own', () => {
    game((g, site) => {
      Object.assign(site('nd1'), { owner: 0, type: 'wind', permit: 'approved' });
      g.players[0]!.board = [{ dept: 'grid', grade: 'senior', since: 0 }];
      Object.assign(site('nd2'), { owner: 0, type: 'wind', permit: 'approved', built: true });
    });
    const html = boardTalk(5);
    expect(html).toContain('Frau Hansen');
    expect(html).toContain('Die Genehmigung für <b>ND-02</b> ist da');
    expect(html).toContain('Dr. Henrik Voss · Netz &amp; Technik');
    expect(html).toContain('data-act="build"');
  });

  it('a ringing phone and a rival on the line come first', () => {
    game((g) => {
      g.players[0]!.decision = { key: 'grant', turn: 0 };
    });
    S.call = { pid: 2, kind: 'overtook' };
    const html = boardTalk();
    expect(html.indexOf('Inés Valcárcel')).toBeLessThan(html.indexOf('Dein Handy klingelt'));
    expect(html).toContain('data-act="hangUp"');
    expect(html).toContain('data-v="decision"');
  });
});

describe('board folder', () => {
  it('shows candidates for vacant seats and blocks hiring when the headquarters is full', () => {
    game((g) => (applyAction(g, 0, { type: 'hireExecutive', dept: 'dev', grade: 'junior' }).ok ? undefined : g));
    let html = vBoard();
    expect(html).toContain('Lena Kowalski');
    expect(html).toContain('Umziehen');
    const g = game((g) => {
      const r = applyAction(g, 0, { type: 'hireExecutive', dept: 'dev', grade: 'junior' });
      return r.ok ? r.state : g;
    });
    html = vBoard();
    expect(g.players[0]!.board).toHaveLength(1);
    expect(html).toContain('Lukas Brandt');
    expect(html).toContain('Entlassen');
    // the container has one seat: the other candidates cannot be hired
    expect(html).toMatch(/data-act="hireExec" data-v="grid\|junior" disabled/);
  });
});

describe('decision card', () => {
  it('shows the options with their effects; locked ones are disabled', () => {
    game((g) => {
      g.players[0]!.decision = { key: 'grant', turn: 0 };
    });
    const html = decisionCard();
    expect(html).toContain('Förderprogramm Energiewende');
    expect(html).toContain('50 % Chance');
    expect(html).toContain('Gilt, wenn du nicht entscheidest');
    expect(html).toMatch(/data-v="lobbyist" disabled/);
    expect(html).toContain('Ab Firmensitz „Altbau-Etage“');
  });

  it('describes outcomes, also of the default option', () => {
    const v = playerView(createGame({ companyName: 'T', autoMinigames: true, seed: 1 }), 0);
    const base = { type: 'decisionTaken', playerId: 0, key: 'grant', cost: 0 } as const;
    expect(decisionResultText(v, { ...base, option: 'apply', auto: false, success: true, gain: 3e6 })).toContain(
      'bewilligt',
    );
    expect(decisionResultText(v, { ...base, option: 'skip', auto: true })).toContain('Keine Entscheidung');
    expect(reportEventText(v, { ...base, option: 'skip', auto: true })?.kind).toBe('warn');
  });
});

describe('awards', () => {
  it('lists won and open awards with progress, and the race for the annual cup', () => {
    game((g, site) => {
      Object.assign(site('ib0'), { owner: 0, type: 'solar', permit: 'approved', built: true, grid: true });
      g.players[0]!.awards = [{ key: 'firstPlant', turn: 3, gold: true }];
      g.players[1]!.awards = [{ key: 'cup', turn: 4, gold: true, year: 2026 }];
    });
    const html = vAwards();
    expect(html).toContain('Gold – als Erste');
    expect(html).toContain('30 von 500');
    expect(html).toContain('2026</b> · Möwenkraft AG');
    expect(html).toContain('Rennen um den Jahrespokal');
  });

  it('news of an award', () => {
    const v = playerView(createGame({ companyName: 'T', autoMinigames: true, seed: 1 }), 0);
    expect(newsTexts(v, { type: 'awardWon', playerId: 2, award: 'offshore', gold: true })[0]!.text).toContain(
      '„Offshore-Pionier“ in Gold für Siestasol',
    );
    expect(newsTexts(v, { type: 'awardWon', playerId: 0, award: 'cup', gold: true, year: 2027 })[0]).toMatchObject({
      kind: 'good',
      text: expect.stringContaining('Jahrespokal 2027'),
    });
  });
});
