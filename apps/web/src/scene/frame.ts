/** Everything a drawing function needs for one frame of one scene. */
import type { RegionKey, SiteView } from '@power-tycoon/engine';
import type { Geo, Quad } from './geometry.js';
import type { Season } from './palette.js';

export type Ctx = CanvasRenderingContext2D;
/** Blinking light: position and colour (default red aviation light). */
export type Light = [number, number, string?];
/** A cloud of this frame: x, size, index (for its shadow on the ground). */
export type Cloud = [number, number, number];

export interface Plot {
  x: SiteView;
  qd: Quad;
}

export interface Frame {
  ctx: Ctx;
  W: number;
  H: number;
  r: RegionKey;
  /** Small preview (fewer details). */
  mini: boolean;
  /** Reduced motion: one still image. */
  still: boolean;
  /** Quarter 0..3 (season). */
  q: number;
  se: Season;
  g: Geo;
  /** Seconds since start. */
  t: number;
  /** Position in the day/night cycle 0..1 (sun up to 0.5) and its sine. */
  p: number;
  e: number;
  /** Daylight 0..1. */
  d: number;
  /** Morning/evening light 0..1. */
  low: number;
  /** Seasonal wind factor. */
  wf: number;
  /** Horizon colour. */
  hzc: string;
  /** Horizontal direction of shadows (−1..1, 0 at night). */
  shx: number;
  /** Field colours of the region in this season. */
  F: string[];
  /** Applies the daylight to a colour. */
  L: (c: string) => string;
  /** Player colours. */
  colors: string[];
  /** Letter on a player's flag. */
  label: (pid: number) => string;
  /** Hovered and selected site (only on the sites tab). */
  hover: string | null;
  selected: string | null;
  /** Collected while drawing, blinking at the end. */
  lights: Light[];
}

/** Outline path of a plot. */
export function pathOf(ctx: Ctx, P: Quad['p']): void {
  ctx.beginPath();
  P.forEach((pt, k) => (k ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
  ctx.closePath();
}
