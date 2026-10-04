import { describe, expect, it } from 'vitest';
import { createGame, endQuarter, HIST, historicFor, playerView } from '../src/index.js';

const game = (years?: number) => createGame({ companyName: 'Kurz AG', autoMinigames: true, seed: 7, years });

describe('game length', () => {
  it('is selectable; unknown lengths fall back to ten years', () => {
    expect(game(3).endYear).toBe(2029);
    expect(game(5).endYear).toBe(2031);
    expect(game().endYear).toBe(2036);
    expect(game(7).endYear).toBe(2036);
    expect(playerView(game(3), 0).quartersLeft).toBe(12);
  });
  it('milestones are squeezed into the game length in their order', () => {
    expect(historicFor(2026, 2036)).toEqual(HIST);
    for (const years of [3, 5]) {
      const h = historicFor(2026, 2026 + years);
      const turns = h.map((m) => (m.year - 2026) * 4 + m.q);
      expect(h.map((m) => m.key)).toEqual(HIST.map((m) => m.key));
      expect(new Set(turns).size).toBe(turns.length);
      expect(turns).toEqual([...turns].sort((a, b) => a - b));
      expect(Math.max(...turns)).toBeLessThan(years * 4);
    }
  });
  it('a three-year game ends after 12 quarters with all milestones', async () => {
    let g = game(3);
    const milestones = playerView(g, 0).milestones.length;
    let seen = 0;
    let quarters = 0;
    while (!g.over) {
      const r = await endQuarter(g, []);
      seen += r.report.events.filter((e) => e.type === 'historicEvent').length;
      g = r.state;
      quarters++;
    }
    expect(quarters).toBe(12);
    expect(g.over).toBe('time');
    expect(seen).toBe(milestones);
    expect(milestones).toBe(HIST.length);
  });
});
