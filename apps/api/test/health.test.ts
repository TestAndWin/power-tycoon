import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Action, OpponentStrategy } from '@power-tycoon/engine';
import { buildApp } from '../src/app.js';
import { hashToken, tokenMatches } from '../src/auth.js';
import { GameRepo, openDb } from '../src/db.js';
import { KeyedLock } from '../src/lock.js';

let dir: string;
let app: FastifyInstance;

const idle: OpponentStrategy = { decide: async () => [] };

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pt-api-'));
  app = await buildApp({ dbFile: join(dir, 'test.db'), opponents: () => [idle, idle, idle] });
});
afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

async function newGame(body: object = { companyName: 'Deichwatt AG', autoMinigames: false }) {
  const res = await app.inject({ method: 'POST', url: '/api/games', payload: body });
  expect(res.statusCode).toBe(201);
  return res.json() as { gameId: string; token: string; view: { me: { name: string; cash: number } } };
}
const auth = (token: string) => ({ authorization: `Bearer ${token}` });
const act = (id: string, token: string, action: Action | object) =>
  app.inject({ method: 'POST', url: `/api/games/${id}/actions`, headers: auth(token), payload: { action } });

describe('health', () => {
  it('responds ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('POST /api/games', () => {
  it('creates a game and stores only the token hash', async () => {
    const g = await newGame();
    expect(g.gameId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(g.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(g.view.me).toMatchObject({ name: 'Deichwatt AG', cash: 30e6 });
    const row = (app as unknown as { db: import('better-sqlite3').Database }).db
      .prepare('SELECT * FROM games WHERE id = ?')
      .get(g.gameId) as Record<string, unknown>;
    expect(row.token_hash).toBe(hashToken(g.token));
    expect(JSON.stringify(row)).not.toContain(g.token);
    expect(row).toMatchObject({ version: 1, status: 'running' });
  });
  it('stores the difficulty (default normal) and rejects unknown ones', async () => {
    const d = (g: { view: unknown }) => (g.view as { settings: { difficulty: string } }).settings.difficulty;
    expect(d(await newGame())).toBe('normal');
    expect(d(await newGame({ companyName: 'X', autoMinigames: true, difficulty: 'hard' }))).toBe('hard');
    const res = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: { companyName: 'X', autoMinigames: true, difficulty: 'insane' },
    });
    expect(res.statusCode).toBe(400);
  });
  it('validates the body', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/games', payload: { companyName: 5 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('badRequest');
  });
  it('is rate limited per IP', async () => {
    const limited = await buildApp({ dbFile: join(dir, 'rl.db'), createLimit: 2 });
    const body = { companyName: 'X', autoMinigames: true };
    const codes: number[] = [];
    for (let i = 0; i < 3; i++)
      codes.push((await limited.inject({ method: 'POST', url: '/api/games', payload: body })).statusCode);
    expect(codes).toEqual([201, 201, 429]);
    await limited.close();
  });
});

describe('auth', () => {
  it('needs the right token for the right game', async () => {
    const a = await newGame();
    const b = await newGame();
    expect((await app.inject({ method: 'GET', url: `/api/games/${a.gameId}` })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: `/api/games/${a.gameId}`, headers: auth(b.token) })).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: `/api/games/${a.gameId}`, headers: { authorization: 'Basic abc' } }))
        .statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/api/games/unknownGame1234', headers: auth(a.token) })).statusCode,
    ).toBe(404);
    expect((await act(a.gameId, b.token, { type: 'borrow', amount: 5e6 })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'POST', url: `/api/games/${a.gameId}/end-quarter`, headers: auth(b.token) }))
        .statusCode,
    ).toBe(401);
    const ok = await app.inject({ method: 'GET', url: `/api/games/${a.gameId}`, headers: auth(a.token) });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().view.me.cash).toBe(30e6);
  });
  it('tokenMatches is false for wrong tokens', () => {
    expect(tokenMatches('abc', hashToken('abc'))).toBe(true);
    expect(tokenMatches('abd', hashToken('abc'))).toBe(false);
    expect(tokenMatches('abc', 'deadbeef')).toBe(false);
  });
});

describe('actions', () => {
  it('executes a valid action and persists it', async () => {
    const g = await newGame();
    const res = await act(g.gameId, g.token, { type: 'lease', siteId: 'nd4' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.events[0]).toMatchObject({ type: 'siteLeased', playerId: 0, siteId: 'nd4' });
    expect(body.challenge).toBeNull();
    const again = await app.inject({ method: 'GET', url: `/api/games/${g.gameId}`, headers: auth(g.token) });
    expect(again.json().view.sites.find((s: { id: string }) => s.id === 'nd4').owner).toBe(0);
  });
  it('maps rule violations to 422 and leaves the state unchanged', async () => {
    const g = await newGame();
    const res = await act(g.gameId, g.token, { type: 'borrow', amount: 900e6 });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: 'creditLimit' });
    expect((await act(g.gameId, g.token, { type: 'lease', siteId: 'zz1' })).json()).toEqual({ error: 'unknownSite' });
    const view = (await app.inject({ method: 'GET', url: `/api/games/${g.gameId}`, headers: auth(g.token) })).json()
      .view;
    expect(view.me.loan).toBe(0);
  });
  it('rejects malformed actions with 400', async () => {
    const g = await newGame();
    expect((await act(g.gameId, g.token, { type: 'teleport' })).statusCode).toBe(400);
    expect((await act(g.gameId, g.token, { type: 'borrow', amount: 'lots' })).statusCode).toBe(400);
  });
  it('runs the minigame challenge flow and blocks end-quarter while open', async () => {
    const g = await newGame();
    const view = (await app.inject({ method: 'GET', url: `/api/games/${g.gameId}`, headers: auth(g.token) })).json()
      .view;
    const solar = view.sites.find((s: { r: string }) => s.r === 'ib').id;
    expect((await act(g.gameId, g.token, { type: 'lease', siteId: solar })).statusCode).toBe(200);
    expect((await act(g.gameId, g.token, { type: 'applyPermit', siteId: solar, plantType: 'solar' })).statusCode).toBe(
      200,
    );
    let approved = false;
    for (let i = 0; i < 4 && !approved; i++) {
      const eq = await app.inject({
        method: 'POST',
        url: `/api/games/${g.gameId}/end-quarter`,
        headers: auth(g.token),
      });
      expect(eq.statusCode).toBe(200);
      const site = eq.json().view.sites.find((s: { id: string }) => s.id === solar);
      if (site.permit === 'rejected')
        await act(g.gameId, g.token, { type: 'applyPermit', siteId: solar, plantType: 'solar' });
      approved = site.permit === 'approved';
    }
    expect(approved).toBe(true);
    const build = await act(g.gameId, g.token, { type: 'build', siteId: solar });
    expect(build.statusCode).toBe(200);
    const ch = build.json().challenge;
    expect(ch).toMatchObject({ kind: 'layout', siteId: solar });
    const reload = (await app.inject({ method: 'GET', url: `/api/games/${g.gameId}`, headers: auth(g.token) })).json();
    expect(reload.view.challenge).toEqual(ch);
    const blocked = await app.inject({
      method: 'POST',
      url: `/api/games/${g.gameId}/end-quarter`,
      headers: auth(g.token),
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toEqual({ error: 'challengeOpen' });
    expect((await act(g.gameId, g.token, { type: 'borrow', amount: 5e6 })).statusCode).toBe(409);
    const done = await act(g.gameId, g.token, { type: 'minigameResult', challengeId: ch.id, outcome: 1.02 });
    expect(done.statusCode).toBe(200);
    expect(done.json().events.map((e: { type: string }) => e.type)).toEqual(['layoutRated', 'plantBuilt']);
    // boolean outcome (cable) must arrive as boolean, not coerced to 0/1
    const connect = await act(g.gameId, g.token, { type: 'connectGrid', siteId: solar });
    const cable = connect.json().challenge;
    expect(cable).toMatchObject({ kind: 'cable' });
    const failed = await act(g.gameId, g.token, { type: 'minigameResult', challengeId: cable.id, outcome: false });
    expect(failed.statusCode).toBe(200);
    expect(failed.json().events.map((e: { type: string }) => e.type)).toEqual(['gridConnectFailed']);
    const again = (await act(g.gameId, g.token, { type: 'connectGrid', siteId: solar })).json().challenge;
    const ok = await act(g.gameId, g.token, { type: 'minigameResult', challengeId: again.id, outcome: true });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().events.map((e: { type: string }) => e.type)).toEqual(['gridConnected']);
  });
});

describe('end-quarter', () => {
  it('returns the report and rival actions and ends with gameOver', async () => {
    const strat: OpponentStrategy = { decide: async (v) => (v.turn === 0 ? [{ type: 'survey', siteId: 'ns3' }] : []) };
    const app2 = await buildApp({ dbFile: join(dir, 'eq.db'), opponents: () => [strat, idle, idle] });
    const g = (
      await app2.inject({ method: 'POST', url: '/api/games', payload: { companyName: 'X', autoMinigames: true } })
    ).json();
    const res = await app2.inject({
      method: 'POST',
      url: `/api/games/${g.gameId}/end-quarter`,
      headers: auth(g.token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.view).toMatchObject({ year: 2026, q: 1 });
    expect(body.report).toMatchObject({ year: 2026, q: 0, startCash: 30e6 });
    expect(Array.isArray(body.report.lines)).toBe(true);
    // a rival's survey is private
    expect(body.rivalActions[0]).toEqual({ playerId: 1, events: [] });
    for (let i = 1; i < 40; i++) {
      const r = await app2.inject({
        method: 'POST',
        url: `/api/games/${g.gameId}/end-quarter`,
        headers: auth(g.token),
      });
      expect(r.statusCode).toBe(200);
    }
    const over = await app2.inject({
      method: 'POST',
      url: `/api/games/${g.gameId}/end-quarter`,
      headers: auth(g.token),
    });
    expect(over.statusCode).toBe(409);
    expect(over.json()).toEqual({ error: 'gameOver' });
    const row = (app2 as unknown as { db: import('better-sqlite3').Database }).db
      .prepare('SELECT status, version FROM games WHERE id = ?')
      .get(g.gameId);
    expect(row).toEqual({ status: 'time', version: 41 });
    await app2.close();
  });

  it('serializes concurrent requests per game', async () => {
    const g = await newGame({ companyName: 'X', autoMinigames: true });
    const results = await Promise.all([
      app.inject({ method: 'POST', url: `/api/games/${g.gameId}/end-quarter`, headers: auth(g.token) }),
      app.inject({ method: 'POST', url: `/api/games/${g.gameId}/end-quarter`, headers: auth(g.token) }),
      act(g.gameId, g.token, { type: 'borrow', amount: 5e6 }),
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200]);
    const view = (await app.inject({ method: 'GET', url: `/api/games/${g.gameId}`, headers: auth(g.token) })).json()
      .view;
    expect(view.turn).toBe(2);
  });
});

describe('storage', () => {
  it('migrates once and deletes old games', () => {
    const db = openDb(join(dir, 'm.db'));
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    const repo = new GameRepo(db);
    const state = { over: false } as never;
    repo.insert('old', 'h', state, new Date('2020-01-01'));
    repo.insert('new', 'h', state, new Date());
    expect(repo.cleanup(180)).toBe(1);
    expect(repo.get('old')).toBeNull();
    expect(repo.get('new')).not.toBeNull();
    expect(repo.save('new', 99, state)).toBe(false);
    expect(repo.save('new', 1, state)).toBe(true);
    db.close();
    const again = openDb(join(dir, 'm.db'));
    expect(again.pragma('user_version', { simple: true })).toBe(1);
    again.close();
  });
  it('KeyedLock runs tasks per key in order', async () => {
    const lock = new KeyedLock();
    const log: number[] = [];
    const slow = (n: number, ms: number) =>
      lock.run('a', () => new Promise<void>((r) => setTimeout(() => (log.push(n), r()), ms)));
    await Promise.all([slow(1, 20), slow(2, 1), lock.run('a', () => log.push(3))]);
    expect(log).toEqual([1, 2, 3]);
    await expect(lock.run('a', () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(await lock.run('a', () => 5)).toBe(5);
    expect(lock.size).toBe(0);
  });
});

describe('static web app', () => {
  it('serves index.html for non-API routes and 404 JSON for unknown API routes', async () => {
    const web = join(dir, 'web');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(web, 'assets'), { recursive: true });
    writeFileSync(join(web, 'index.html'), '<!doctype html><title>Wattmogul</title>');
    writeFileSync(join(web, 'assets', 'a.js'), 'console.log(1)');
    const app3 = await buildApp({ dbFile: join(dir, 's.db'), webRoot: web });
    const index = await app3.inject({ method: 'GET', url: '/' });
    expect(index.statusCode).toBe(200);
    expect(index.body).toContain('Wattmogul');
    const asset = await app3.inject({ method: 'GET', url: '/assets/a.js' });
    expect(asset.headers['cache-control']).toContain('immutable');
    expect((await app3.inject({ method: 'GET', url: '/some/page' })).body).toContain('Wattmogul');
    const api404 = await app3.inject({ method: 'GET', url: '/api/nope' });
    expect(api404.statusCode).toBe(404);
    expect(api404.json()).toEqual({ error: 'notFound' });
    await app3.close();
  });
});
