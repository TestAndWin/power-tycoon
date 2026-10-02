/** Colour helpers and a deterministic hash for scenery variation. */

/** Pseudo-random but stable value in [0, 1) for an index (tree positions, cloud speeds, …). */
export const h1 = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** RGB components of `#rgb`, `#rrggbb` or `rgb(…)`. */
export function hx(c: string): number[] {
  if (c[0] === 'r') return c.match(/\d+/g)!.slice(0, 3).map(Number);
  c = c.replace('#', '');
  if (c.length === 3)
    c = c
      .split('')
      .map((x) => x + x)
      .join('');
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

/** Colour scaled by `f` (darker below 1). */
export const shade = (c: string, f: number): string =>
  '#' +
  hx(c)
    .map((v) =>
      Math.min(255, Math.round(v * f))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

/** Linear blend from `a` (f = 0) to `b` (f = 1). */
export const mix = (a: string, b: string, f: number): string => {
  const A = hx(a),
    B = hx(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i]! - v) * f)).join(',')})`;
};

export const rgba = (c: string, a: number): string => `rgba(${hx(c).join(',')},${a})`;
