import { describe, expect, it } from 'vitest';
import { applyAction, DETECTIVES, endQuarter, playerView, SPY_COST, TRICK_CAUGHT, TRICKS } from '../src/index.js';
import { fails, giveIntel, newGame, ok, setupSite, site } from './helpers.js';

describe('spy reports', () => {
  it('cost money, last four quarters and reveal hidden information about the rival', async () => {
    const g = newGame();
    const x = setupSite(g, 'nd5', 1, 'operating', 'wind');
    x.eff = 1.07;
    g.players[1]!.contracts.push({ id: 99, buyer: 'Stahlwerk Qualmstedt', vol: 5000, quarters: 8, price: 90, left: 8 });
    const before = playerView(g, 0);
    expect(before.sites.find((s) => s.id === 'nd5')).toMatchObject({ known: false, wind: null });
    expect(before.sites.find((s) => s.id === 'nd5')!.intel).toBeUndefined();
    expect(before.players[1]!.intel).toBeUndefined();

    const r = ok(g, { type: 'spy', targetId: 1 });
    expect(r.events[0]).toMatchObject({ type: 'spied', playerId: 0, targetId: 1, caught: false });
    expect(r.state.players[0]!.intel).toEqual({ 1: 3 });
    expect(r.state.players[0]!.cash).toBe(30e6 - SPY_COST);
    const v = playerView(r.state, 0);
    expect(v.sites.find((s) => s.id === 'nd5')).toMatchObject({ known: true, wind: x.wind, intel: { eff: 1.07 } });
    expect(v.players[1]!.intel).toMatchObject({ until: 3, contracts: [{ buyer: 'Stahlwerk Qualmstedt' }] });
    // the rival does not learn about it and the report is not a news item
    expect(JSON.stringify(playerView(r.state, 1))).not.toContain('spied');
    fails(r.state, { type: 'spy', targetId: 1 }, 'invalidState');

    let s = r.state;
    for (let i = 0; i < 4; i++) s = (await endQuarter(s, [])).state;
    expect(playerView(s, 0).players[1]!.intel).toBeUndefined();
    expect(s.players[0]!.intel).toEqual({});
    ok(s, { type: 'spy', targetId: 1 });
  });
  it('target must be another active player', () => {
    const g = newGame();
    fails(g, { type: 'spy', targetId: 0 }, 'invalidTarget');
    fails(g, { type: 'spy', targetId: 9 }, 'invalidTarget');
    g.players[2]!.out = true;
    fails(g, { type: 'spy', targetId: 2 }, 'invalidTarget');
  });
  it('detectives may catch a spy: no report, and the target is told', () => {
    let caught = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const g = newGame(seed);
      g.players[1]!.detectives = { level: 'pro', left: 4 };
      const r = ok(g, { type: 'spy', targetId: 1 });
      const e = r.events[0]!;
      if (e.type !== 'spied') throw new Error('spied expected');
      if (e.caught) {
        caught++;
        expect(r.state.players[0]!.intel?.[1]).toBeUndefined();
        expect(playerView(r.state, 1).news.some((n) => n.event.type === 'spied')).toBe(true);
      } else expect(r.state.players[0]!.intel?.[1]).toBe(3);
    }
    expect(caught / 80).toBeGreaterThan(DETECTIVES.pro.catchSpy - 0.2);
    expect(caught / 80).toBeLessThan(DETECTIVES.pro.catchSpy + 0.2);
  });
});

describe('detectives', () => {
  it('are hired for four quarters; only an upgrade is possible while active', async () => {
    const g = newGame();
    const r = ok(g, { type: 'hireDetectives', level: 'basic' });
    expect(r.events[0]).toMatchObject({ type: 'detectivesHired', level: 'basic', quarters: 4 });
    expect(r.state.players[0]!.cash).toBe(30e6 - DETECTIVES.basic.cost);
    expect(playerView(r.state, 0).me.detectives).toEqual({ level: 'basic', left: 4 });
    // secret: other players do not see it
    expect(JSON.stringify(playerView(r.state, 1))).not.toContain('detectivesHired');
    fails(r.state, { type: 'hireDetectives', level: 'basic' }, 'detectivesActive');
    const up = ok(r.state, { type: 'hireDetectives', level: 'pro' }).state;
    fails(up, { type: 'hireDetectives', level: 'pro' }, 'detectivesActive');
    fails(g, { type: 'hireDetectives', level: 'gold' as 'pro' }, 'invalidState');

    let s = up;
    for (let i = 0; i < 3; i++) s = (await endQuarter(s, [])).state;
    expect(playerView(s, 0).me.detectives).toEqual({ level: 'pro', left: 1 });
    const last = await endQuarter(s, []);
    expect(playerView(last.state, 0).me.detectives).toBeNull();
    expect(last.report.events).toContainEqual({ type: 'detectivesExpired', playerId: 0 });
  });
  it('lower the success of tricks against the client and catch more culprits', () => {
    const N = 300;
    const run = (guard: boolean) => {
      let ok = 0;
      let caught = 0;
      let failed = 0;
      for (let seed = 1; seed <= N; seed++) {
        const g = giveIntel(newGame(seed), 1, 0);
        setupSite(g, 'nd0', 0, 'operating', 'wind');
        if (guard) g.players[0]!.detectives = { level: 'pro', left: 4 };
        const r = applyAction(g, 1, { type: 'lobby', trick: 'hack', siteId: 'nd0' });
        if (!r.ok) throw new Error(r.error);
        const e = r.events[0]!;
        if (e.type === 'trickSucceeded') ok++;
        if (e.type === 'trickFailed') {
          failed++;
          if (e.caught) caught++;
        }
      }
      return { ok: ok / N, caughtShare: caught / failed };
    };
    const open = run(false);
    const guarded = run(true);
    expect(open.ok).toBeGreaterThan(TRICKS.hack.chance - 0.08);
    expect(guarded.ok).toBeLessThan(TRICKS.hack.chance * DETECTIVES.pro.shield + 0.08);
    expect(open.caughtShare).toBeLessThan(TRICK_CAUGHT + 0.12);
    expect(guarded.caughtShare).toBeGreaterThan(DETECTIVES.pro.catchFailed - 0.12);
  });
  it('can catch the actor of a successful trick: the damage stays, the court pays the victim', () => {
    let found = false;
    for (let seed = 1; seed <= 200 && !found; seed++) {
      const g = giveIntel(newGame(seed), 1, 0);
      setupSite(g, 'nd0', 0, 'operating', 'wind');
      g.players[0]!.detectives = { level: 'pro', left: 4 };
      const r = applyAction(g, 1, { type: 'lobby', trick: 'bi', siteId: 'nd0' });
      if (!r.ok) throw new Error(r.error);
      const e = r.events[0]!;
      if (e.type !== 'trickSucceeded' || !e.caught) continue;
      found = true;
      expect(site(r.state, 'nd0').curtail).toBe(2);
      expect(e).toMatchObject({ suspected: true, actorId: 1, fine: TRICKS.bi.fine, damages: TRICKS.bi.damages });
      expect(r.state.players[1]!.cash).toBe(30e6 - TRICKS.bi.cost - TRICKS.bi.fine - TRICKS.bi.damages);
      expect(r.state.players[0]!.cash).toBe(30e6 + TRICKS.bi.damages);
      // the victim sees who it was
      expect(playerView(r.state, 0).news.find((n) => n.event.type === 'trickSucceeded')!.event).toMatchObject({
        actorId: 1,
      });
    }
    expect(found).toBe(true);
  });
});

describe('detectives – review fixes', () => {
  it('rivals hiring at the end of the quarter get four quarters against the human as well', async () => {
    const g = newGame();
    const r = applyAction(g, 1, { type: 'hireDetectives', level: 'basic' });
    if (!r.ok) throw new Error(r.error);
    let s = (await endQuarter(r.state, [])).state;
    for (let i = 0; i < 4; i++) {
      expect(s.players[1]!.detectives?.left ?? 0).toBeGreaterThan(0);
      s = (await endQuarter(s, [])).state;
    }
    expect(s.players[1]!.detectives).toBeNull();
  });
});
