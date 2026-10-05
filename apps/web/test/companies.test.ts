import { describe, expect, it } from 'vitest';
import type { PlayerSummary } from '@power-tycoon/engine';
import { standing, trend } from '../src/ui/companies.js';

const player = (worth: number, hist: (number | null)[] = [], out = false): PlayerSummary => ({
  id: 1,
  name: 'Rival',
  human: false,
  cash: 0,
  loan: 0,
  out,
  worth,
  hq: 0,
  awards: [],
  sites: 0,
  mw: 0,
  genLast: 0,
  co2: 0,
  hist,
});

describe('rival standing', () => {
  it('compares the net worth with the player', () => {
    const me = player(100);
    expect(standing(player(120), me).key).toBe('leads');
    expect(standing(player(105), me).key).toBe('ahead');
    expect(standing(player(95), me).key).toBe('close');
    expect(standing(player(80), me).key).toBe('behind');
    expect(standing(player(200, [], true), me).key).toBe('out');
  });

  it('takes the trend from the last two recorded quarters', () => {
    expect(trend(player(0, [null, 30, 28]))).toBe(-2);
    expect(trend(player(0, [30, null]))).toBeNull();
  });
});
