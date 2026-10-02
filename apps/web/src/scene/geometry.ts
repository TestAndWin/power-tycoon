/** Perspective geometry of a region: 4 × 4 plots between the horizon and the bottom edge. */
export type Pt = [number, number];

export interface Geo {
  /** Horizon height. */
  hz: number;
  /** y of the 5 plot row borders. */
  Y: number[];
  /** Perspective scale at height y. */
  sc: (y: number) => number;
  /** Screen x of the relative position u (0..1) at height y. */
  X: (u: number, y: number) => number;
}

/** One plot: column/row, edges in plot coordinates, centre, width and corner points. */
export interface Quad {
  c: number;
  r: number;
  y0: number;
  y1: number;
  u0: number;
  u1: number;
  cy: number;
  cx: number;
  bw: number;
  p: Pt[];
}

export function geo(W: number, H: number): Geo {
  const hz = H * 0.3,
    Y = [0.05, 0.27, 0.5, 0.74, 0.99].map((g) => hz + (H - hz) * g),
    sc = (y: number) => 0.58 + (0.42 * (y - hz)) / (H - hz);
  return { hz, Y, sc, X: (u, y) => W / 2 + (u - 0.5) * W * 0.94 * sc(y) };
}

export function quad(g: Geo, i: number): Quad {
  const c = i % 4,
    r = Math.floor(i / 4),
    y0 = g.Y[r]! + 2,
    y1 = g.Y[r + 1]! - 3,
    u0 = c / 4 + 0.012,
    u1 = (c + 1) / 4 - 0.012,
    cy = (y0 + y1) / 2;
  return {
    c,
    r,
    y0,
    y1,
    u0,
    u1,
    cy,
    cx: g.X((u0 + u1) / 2, cy),
    bw: g.X(u1, cy) - g.X(u0, cy),
    p: [
      [g.X(u0, y0), y0],
      [g.X(u1, y0), y0],
      [g.X(u1, y1), y1],
      [g.X(u0, y1), y1],
    ],
  };
}
