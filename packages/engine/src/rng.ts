/**
 * Small seeded PRNG (mulberry32). The whole generator state is one 32-bit integer,
 * so it can live inside the JSON game state (`GameState.rng`).
 */

export type Random = () => number;

export interface RngHolder {
  rng: number;
}

/** Advances the generator stored in `h.rng` and returns a float in [0, 1). */
export function nextFloat(h: RngHolder): number {
  let t = (h.rng = (h.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Advances the generator and returns an unsigned 32-bit integer (used to derive seeds). */
export function nextUint(h: RngHolder): number {
  return Math.floor(nextFloat(h) * 4294967296) >>> 0;
}

/** Random function bound to a holder (e.g. the game state). */
export function randomOf(h: RngHolder): Random {
  return () => nextFloat(h);
}

/** Independent generator from a seed, e.g. for minigame fields in the browser. */
export function createRng(seed: number): Random {
  const h = { rng: seed | 0 };
  return () => nextFloat(h);
}

export const rand = (r: Random, a: number, b: number): number => a + r() * (b - a);
export const randint = (r: Random, a: number, b: number): number => Math.floor(rand(r, a, b + 1));
export const pick = <T>(r: Random, a: readonly T[]): T => a[Math.floor(r() * a.length)] as T;
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Standard normal distribution (Box-Muller), as in the legacy game. */
export function gauss(r: Random): number {
  let u = 0;
  let v = 0;
  while (!u) u = r();
  while (!v) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function shuffle<T>(r: Random, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}
