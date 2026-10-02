import { describe, expect, it } from 'vitest';
import { createRng } from '@power-tycoon/engine';
import { createCablePuzzle, E_, isConnected, powered, rotate, W_, type CablePuzzle } from '../src/minigames/cable.js';
import { FrequencyControl } from '../src/minigames/frequency.js';
import { LayoutField } from '../src/minigames/layout.js';
import { RotorAssembly } from '../src/minigames/rotor.js';

describe('layout', () => {
  it('is generated from the seed and limits the number of placements', () => {
    const a = new LayoutField('onshore', createRng(1));
    const b = new LayoutField('onshore', createRng(1));
    expect(a.cells).toEqual(b.cells);
    expect(a.need).toBe(5);
    const free = a.cells.map((c, k) => (c.kind === 'block' ? -1 : k)).filter((k) => k >= 0);
    const blocked = a.cells.findIndex((c) => c.kind === 'block');
    if (blocked >= 0) expect(a.toggle(blocked)).toBe(false);
    for (const k of free.slice(0, 5)) expect(a.toggle(k)).toBe(true);
    expect(a.toggle(free[5]!)).toBe(false);
    expect(a.toggle(free[0]!)).toBe(true); // removing is always possible
    expect(a.placed()).toBe(4);
  });
  it('offshore has no blocked cells', () => {
    expect(new LayoutField('offshore', createRng(3)).cells.some((c) => c.kind !== 'ok')).toBe(false);
  });
  it('wake and shading cost yield; the score stays within 0.80 … 1.15', () => {
    const wind = new LayoutField('offshore', createRng(5));
    wind.toggle(wind.cells.indexOf(wind.at(1, 2)));
    const behind = wind.cells.indexOf(wind.at(2, 2));
    expect(wind.yieldOf(behind)).toBeCloseTo(wind.at(2, 2).v * 0.72);
    expect([...wind.wake()]).toEqual(['2,2', '3,2', '4,2']);
    const sun = new LayoutField('solar', createRng(5));
    const k = sun.cells.findIndex((c) => c.r === 1 && c.kind === 'ok' && sun.at(c.c, 2).kind === 'ok');
    const south = sun.cells.indexOf(sun.at(sun.cells[k]!.c, 2));
    sun.toggle(south);
    expect(sun.yieldOf(k)).toBeCloseTo(sun.cells[k]!.v * 0.78);
    for (const field of [wind, sun]) {
      expect(field.score()).toBeGreaterThanOrEqual(0.8);
      expect(field.score()).toBeLessThanOrEqual(1.15);
    }
  });
});

describe('cable', () => {
  const straight = (): CablePuzzle => ({
    cols: 3,
    rows: 1,
    grid: [[W_ | E_, W_ | E_, W_ | E_]],
    from: 0,
    to: 0,
  });
  it('power flows through matching pieces to the substation', () => {
    const p = straight();
    expect(isConnected(p, powered(p))).toBe(true);
    p.grid[0]![1] = rotate(p.grid[0]![1]!);
    expect(powered(p)).toEqual(new Set(['0,0']));
    expect(isConnected(p, powered(p))).toBe(false);
  });
  it('four rotations restore a piece', () => {
    for (let m = 0; m < 16; m++) expect(rotate(rotate(rotate(rotate(m))))).toBe(m);
  });
  it('generated puzzles are solvable: some rotation of every piece connects both ends', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = createCablePuzzle(createRng(seed), 6);
      expect(p.grid).toHaveLength(5);
      // depth-first search over the rotations of the pieces on a path from the plant
      const solve = (c: number, r: number, fromBit: number, seen: Set<string>): boolean => {
        if (c < 0 || r < 0 || c >= p.cols || r >= p.rows || seen.has(c + ',' + r)) return false;
        let m = p.grid[r]![c]!;
        for (let k = 0; k < 4; k++, m = rotate(m)) {
          if (!(m & fromBit)) continue;
          if (c === p.cols - 1 && r === p.to && m & E_) return true;
          const next = new Set(seen).add(c + ',' + r);
          if (m & 1 && fromBit !== 1 && solve(c, r - 1, 4, next)) return true;
          if (m & 2 && fromBit !== 2 && solve(c + 1, r, 8, next)) return true;
          if (m & 4 && fromBit !== 4 && solve(c, r + 1, 1, next)) return true;
          if (m & 8 && fromBit !== 8 && solve(c - 1, r, 2, next)) return true;
        }
        return false;
      };
      expect(solve(0, p.from, W_, new Set())).toBe(true);
    }
  });
});

describe('rotor', () => {
  it('a blade released above the hub fits, three blades finish the assembly', () => {
    const m = new RotorAssembly(false, createRng(1));
    let hits = 0;
    while (!m.done) {
      // wait until the hook is right above the hub, then release
      while (Math.abs(m.hookX() - 160) > 3) m.update(0.005);
      expect(m.release()).toBe(true);
      expect(m.release()).toBe(false);
      let r = null;
      while (!r) r = m.update(0.02);
      if (r === 'hit') hits++;
    }
    expect(hits).toBe(3);
    expect(m.success).toBe(true);
    expect(m.release()).toBe(false);
  });
  it('three misses end it without success', () => {
    const m = new RotorAssembly(true, createRng(2));
    while (!m.done) {
      while (Math.abs(m.hookX() - 160) < 40) m.update(0.005);
      m.release();
      while (!m.update(0.02));
    }
    expect(m.miss).toBe(3);
    expect(m.success).toBe(false);
  });
});

describe('frequency', () => {
  it('a growing imbalance ends in a blackout, the chart keeps 160 values', () => {
    const m = new FrequencyControl(createRng(1));
    m.D = 1300;
    let out = null;
    for (let i = 0; i < 2000 && !out; i++) out = m.step(0.02);
    expect(out).toBe('blackout');
    expect(Math.abs(m.f - 50)).toBeGreaterThan(0.9);
    expect(m.trace.length).toBeLessThanOrEqual(160);
  });
  it('holding the balance leads to a stable grid', () => {
    const m = new FrequencyControl(createRng(4));
    let out = null;
    for (let i = 0; i < 5000 && !out; i++) {
      // a perfect operator: feed-in follows the load
      m.set = m.D;
      out = m.step(0.02);
    }
    expect(out).toBe('stable');
    expect(m.ok).toBeGreaterThanOrEqual(15);
  });
});
