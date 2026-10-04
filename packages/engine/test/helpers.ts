import { expect } from 'vitest';
import { applyAction, createGame } from '../src/index.js';
import type { Action, ActionResult, GameState, PlantType, PlayerId, Site } from '../src/index.js';

export const newGame = (seed = 42, autoMinigames = false): GameState =>
  createGame({ companyName: 'Testwatt AG', autoMinigames, seed });

export const site = (g: GameState, id: string): Site => g.sites.find((s) => s.id === id)!;

export function ok(g: GameState, a: Action, pid: PlayerId = 0): Extract<ActionResult, { ok: true }> {
  const r = applyAction(g, pid, a);
  if (!r.ok) throw new Error(`expected ok for ${a.type}, got ${r.error}`);
  return r;
}

export function fails(g: GameState, a: Action, error: string, pid: PlayerId = 0): void {
  const before = JSON.stringify(g);
  const r = applyAction(g, pid, a);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toBe(error);
  expect(JSON.stringify(g)).toBe(before);
}

/** Puts a site into a given stage for player `pid` (direct state setup for tests). */
export function setupSite(
  g: GameState,
  id: string,
  pid: PlayerId,
  stage: 'leased' | 'approved' | 'built' | 'operating',
  type?: PlantType,
): Site {
  const x = site(g, id);
  x.owner = pid;
  if (stage === 'leased') return x;
  x.type = type ?? (x.r === 'ns' ? 'off' : x.r === 'al' ? 'solar' : 'wind');
  x.permit = 'approved';
  if (stage === 'approved') return x;
  x.built = true;
  x.invested = 10e6;
  if (stage === 'built') return x;
  x.grid = true;
  return x;
}

/** Gives player `pid` a valid spy report on each of `targets` (needed for lobby tricks). */
export function giveIntel(g: GameState, pid: PlayerId, ...targets: PlayerId[]): GameState {
  const p = g.players[pid]!;
  p.intel = { ...p.intel };
  for (const t of targets) p.intel[t] = g.turn + 3;
  return g;
}
