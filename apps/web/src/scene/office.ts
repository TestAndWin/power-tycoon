/**
 * The CEO's office (phase 8): the main view on desktop. A canvas scene in the board game style of the
 * landscapes (flat fills, ink outlines, hard cardboard shadows), drawn in a virtual 1600 × 1000 space. The
 * objects in the room are hotspots (HTML buttons laid over the canvas, see `OFFICE_HOTSPOTS`).
 */
import type { HqLevel, RegionKey } from '@power-tycoon/engine';
import { money } from '../format.js';
import { RMO } from '../state.js';
import { mix } from './color.js';
import { SEASONS } from './palette.js';

export const OFFICE_W = 1600;
export const OFFICE_H = 1000;
const W = OFFICE_W,
  H = OFFICE_H,
  FLOOR = 650,
  INK = '#2a2016';

/** Everything the office shows of the game. */
export interface OfficeData {
  hq: HqLevel;
  /** Quarter 0–3 (season in the window). */
  q: number;
  /** Quarters played so far (year and quarter in one number): the coffee is refilled every quarter. */
  turn: number;
  /** Region in the window: the one with the largest own capacity. */
  region: RegionKey;
  colors: string[];
  price: number;
  priceDelta: number;
  priceHist: number[];
  /** Laptop on the desk: cash and loan in euros. */
  cash: number;
  loan: number;
  ticker: string;
  /** Site pins on the wall map: region, index in the region, owner, needs action. */
  pins: { r: RegionKey; i: number; owner: number; hot: boolean }[];
  /** Trophies on the shelf, oldest first. */
  trophies: { cup: boolean; gold: boolean }[];
  /** Rival portraits (SVG markup), ordered by rank. */
  rivals: { id: number; svg: string }[];
  /** A spy report is valid (the back room door stands ajar); detectives are hired (light under the door). */
  spy: boolean;
  detectives: boolean;
  /** A decision card waits: the smartphone vibrates and lights up. */
  ringing: boolean;
  caller: string;
  headline: string;
}

type Ctx = CanvasRenderingContext2D;
type Path = () => void;

interface WindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  arch?: boolean;
}
const WINDOW: Record<HqLevel, WindowRect> = {
  0: { x: 1060, y: 170, w: 360, h: 240, r: 22 },
  1: { x: 1050, y: 92, w: 380, h: 420, arch: true },
  2: { x: 990, y: 96, w: 560, h: 420 },
  3: { x: 960, y: 34, w: 628, h: 606 },
};
const KEY: Record<HqLevel, 'container' | 'altbau' | 'buero' | 'turm'> = {
  0: 'container',
  1: 'altbau',
  2: 'buero',
  3: 'turm',
};

/** Lowest virtual height: on wide, low windows the office is cropped down to 2 : 1. */
export const OFFICE_MIN_H = 800;

/**
 * Cropping for a virtual height `vh`: the ceiling loses `top`, the desk (and everything on it) moves up by
 * `cut` in total so it still stands at the bottom edge.
 */
export function officeCrop(vh: number): { top: number; cut: number } {
  const cut = Math.max(0, Math.min(H - OFFICE_MIN_H, H - vh));
  return { top: Math.round(cut * 0.3), cut };
}

/**
 * Hotspots: area key (as in `UI.tab`), label, rectangle in office coordinates, and whether it sits on the
 * desk (moves with the desk when the office is cropped).
 */
export function officeHotspots(
  hq: HqLevel,
): { k: string; label: string; r: [number, number, number, number]; desk?: boolean }[] {
  const w = WINDOW[hq];
  return [
    { k: 'sites', label: 'Landkarte · Standorte', r: [236, 104, 380, 330] },
    { k: 'market', label: 'Börsenmonitor · Strommarkt', r: [650, 116, 272, 210] },
    { k: 'awards', label: 'Pokalregal · Auszeichnungen', r: [646, 326, 288, 106] },
    { k: 'rivals', label: 'Porträtwand · Konkurrenz', r: [646, 452, 288, 94] },
    { k: 'lobby', label: 'Hinterzimmer · Lobby & Spionage', r: [26, 116, 178, 540] },
    {
      k: 'overview',
      label: 'Fenster · Lagebericht',
      r: [w.x, w.y, Math.min(w.w, 1370 - w.x), Math.min(w.h, 520 - w.y)],
    },
    { k: 'bank', label: 'Laptop · Bank', r: [832, 678, 306, 224], desk: true },
    { k: 'board', label: 'Namensschild · Vorstand & Firmensitz', r: [572, 740, 256, 60], desk: true },
    { k: 'news', label: 'Zeitung · Nachrichten', r: [536, 812, 310, 180], desk: true },
    { k: 'decision', label: 'Handy · Entscheidung', r: [1300, 760, 140, 200], desk: true },
  ];
}

/** The rival portrait at rank position `i` on the wall: centre and radius of its frame. */
export const rivalPortrait = (i: number): { cx: number; cy: number; r: number } => ({
  cx: 700 + i * 90,
  cy: 498,
  r: 38,
});

/** Clock on the phone, per quarter (also on the opened phone). */
export const PHONE_TIME = ['08:15', '09:41', '10:30', '17:05'];

/** The desk lamp: a light switch, not an area. */
export const LAMP_HOTSPOT: [number, number, number, number] = [356, 600, 190, 190];
/** Little things to click that are not areas: the plant rustles, the coffee gets drunk. */
export const PLANT_HOTSPOT: [number, number, number, number] = [1376, 420, 228, 236];
export const MUG_HOTSPOT: [number, number, number, number] = [1196, 796, 100, 124];

/* ---------- drawing state ---------- */

let cv: HTMLCanvasElement | null = null;
let ctx: Ctx | null = null;
let data: OfficeData | null = null;
let scale = 1;
/** Virtual height of the visible part and its cropping (see `officeCrop`). */
let vh = H;
let crop = officeCrop(H);
let T = 0;
let raf = 0;
let last = 0;
let grain: CanvasPattern | null = null;
const images = new Map<string, HTMLImageElement>();
/** Desk lamp switched by the player; only holds for the quarter it was switched in. */
let lampSwitch: { q: number; on: boolean } | null = null;

/** Desk lamp: lit in winter and autumn unless the player switched it this quarter. */
function lampLit(q: number): boolean {
  return lampSwitch?.q === q ? lampSwitch.on : q === 0 || q === 3;
}

/** Switches the desk lamp on or off. */
export function toggleLamp(): void {
  if (!data) return;
  lampSwitch = { q: data.q, on: !lampLit(data.q) };
  draw();
}

/** When the plant was last touched (seconds, animation clock), and the quarter the coffee was drunk in. */
let plantTouched = -99;
let mugDrunk = -1;
const now = (): number => performance.now() / 1000;

/** Touches the plant: its leaves sway and one falls (not with reduced motion). Returns false while it still sways. */
export function touchPlant(): boolean {
  if (now() - plantTouched < 1.6) return false;
  if (!RMO) plantTouched = now();
  return true;
}

/** Drinks the coffee. Returns false if the mug is already empty this quarter. */
export function drinkCoffee(): boolean {
  if (!data || mugDrunk === data.turn) return false;
  mugDrunk = data.turn;
  draw();
  return true;
}

/** Shows the office in `canvas` (call after every render; the canvas may be the same as before). */
export function showOffice(canvas: HTMLCanvasElement | null, d: OfficeData): void {
  data = d;
  for (const r of d.rivals) portraitImage(r.svg);
  if (canvas !== cv) {
    cv = canvas;
    ctx = cv?.getContext('2d') ?? null;
  }
  resizeOffice();
  if (!RMO && !raf) raf = requestAnimationFrame(loop);
}

/** Matches the canvas resolution to its size on screen. */
export function resizeOffice(): void {
  if (!cv || !ctx) return;
  const r = cv.getBoundingClientRect();
  if (!r.width) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(r.width * dpr),
    h = Math.round(r.height * dpr);
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
  scale = w / W;
  vh = Math.round(h / scale);
  crop = officeCrop(vh);
  const box = cv.parentElement;
  box?.style.setProperty('--vh', String(vh));
  box?.style.setProperty('--top', String(crop.top));
  box?.style.setProperty('--cut', String(crop.cut));
  grain ??= makeGrain(ctx);
  draw();
}

function loop(now: number): void {
  raf = 0;
  if (!cv?.isConnected) return;
  raf = requestAnimationFrame(loop);
  if (now - last < 33 || document.hidden) return;
  last = now;
  T = now / 1000;
  draw();
}

function portraitImage(svg: string): HTMLImageElement {
  let im = images.get(svg);
  if (!im) {
    im = new Image();
    im.onload = () => draw();
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    images.set(svg, im);
  }
  return im;
}

function makeGrain(c: Ctx): CanvasPattern | null {
  const g = document.createElement('canvas');
  g.width = g.height = 160;
  const gc = g.getContext('2d');
  if (!gc) return null;
  const d = gc.createImageData(160, 160);
  let s = 7;
  for (let i = 0; i < d.data.length; i += 4) {
    // fixed pattern, not game randomness
    s = (s * 16807) % 2147483647;
    const v = s % 255;
    d.data[i] = 60;
    d.data[i + 1] = 44;
    d.data[i + 2] = 26;
    d.data[i + 3] = v < 120 ? 0 : (v - 120) / 9;
  }
  gc.putImageData(d, 0, 0);
  return c.createPattern(g, 'repeat');
}

/* ---------- primitives: fill + ink outline + optional hard shadow ---------- */

function shape(path: Path, fill: string | CanvasGradient, lw = 3, sh = 0): void {
  const c = ctx!;
  if (sh) {
    c.save();
    c.translate(sh * 0.4, sh);
    path();
    c.fillStyle = 'rgba(42,32,22,.85)';
    c.fill();
    c.restore();
  }
  path();
  c.fillStyle = fill;
  c.fill();
  if (lw) {
    c.lineWidth = lw;
    c.strokeStyle = INK;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
  }
}
const rr =
  (x: number, y: number, w: number, h: number, r = 6): Path =>
  () => {
    ctx!.beginPath();
    ctx!.roundRect(x, y, w, h, r);
  };
const poly =
  (pts: [number, number][]): Path =>
  () => {
    ctx!.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx!.lineTo(x, y) : ctx!.moveTo(x, y)));
    ctx!.closePath();
  };
const circ =
  (x: number, y: number, r: number): Path =>
  () => {
    ctx!.beginPath();
    ctx!.arc(x, y, r, 0, Math.PI * 2);
  };
const ell =
  (x: number, y: number, rx: number, ry: number, rot = 0): Path =>
  () => {
    ctx!.beginPath();
    ctx!.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  };
function line(x1: number, y1: number, x2: number, y2: number, col = INK, lw = 3): void {
  const c = ctx!;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.strokeStyle = col;
  c.lineWidth = lw;
  c.lineCap = 'round';
  c.stroke();
}
function text(s: string, x: number, y: number, font: string, col = INK, align: CanvasTextAlign = 'left'): void {
  const c = ctx!;
  c.font = font;
  c.fillStyle = col;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(s, x, y);
}
const DISPLAY = 'Unbounded, "Arial Black", Arial, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const SANS = 'Manrope, system-ui, sans-serif';

/* ---------- the view out of the window ---------- */

function turbine(x: number, y: number, h: number, ph: number, lw: number): void {
  const top = y - h,
    bw = Math.max(2, h * 0.035);
  shape(
    poly([
      [x - bw, y],
      [x + bw, y],
      [x + bw * 0.45, top],
      [x - bw * 0.45, top],
    ]),
    '#f6f2ea',
    lw,
  );
  const a = (RMO ? 0 : T * (1.1 + ph * 0.3)) + ph * 2,
    L = h * 0.52;
  for (let i = 0; i < 3; i++) {
    const b = a + i * 2.094,
      c = Math.cos(b),
      s = Math.sin(b),
      n = -s,
      m = c;
    shape(
      poly([
        [x, top],
        [x + c * L * 0.3 + n * L * 0.06, top + s * L * 0.3 + m * L * 0.06],
        [x + c * L, top + s * L],
        [x + c * L * 0.3 - n * L * 0.03, top + s * L * 0.3 - m * L * 0.03],
      ]),
      '#fbf8f1',
      lw * 0.8,
    );
  }
  shape(circ(x, top, Math.max(2, h * 0.04)), '#e8e2d6', lw * 0.8);
}
function hills(x: number, w: number, base: number, amp: number, col: string, seed: number, lw: number): void {
  shape(
    () => {
      const c = ctx!;
      c.beginPath();
      c.moveTo(x - 10, 2000);
      c.lineTo(x - 10, base);
      for (let i = 0; i <= 12; i++)
        c.lineTo(x + (w / 12) * i, base - amp * (0.5 + 0.5 * Math.sin(i * 1.3 + seed) * Math.cos(i * 0.7 + seed * 2)));
      c.lineTo(x + w + 10, 2000);
      c.closePath();
    },
    col,
    lw,
  );
}
function cloud(x: number, y: number, s: number): void {
  shape(
    () => {
      const c = ctx!;
      c.beginPath();
      c.arc(x, y, 22 * s, Math.PI, 0);
      c.arc(x + 30 * s, y - 8 * s, 28 * s, Math.PI, 0);
      c.arc(x + 62 * s, y, 20 * s, Math.PI, 0);
      c.closePath();
    },
    'rgba(255,255,255,.92)',
    2,
  );
}
function solarRows(x: number, y: number, n: number, rows: number, col: string): void {
  for (let r = 0; r < rows; r++)
    for (let i = 0; i < n; i++) {
      const px = x + i * 44 + r * 8,
        py = y + r * 16;
      shape(
        poly([
          [px, py],
          [px + 36, py],
          [px + 30, py - 10],
          [px + 6, py - 10],
        ]),
        col,
        1.5,
      );
    }
}

function view(d: OfficeData): void {
  const { x, y, w, h } = WINDOW[d.hq],
    key = KEY[d.hq],
    S0 = SEASONS[d.q]!;
  const c = ctx!;
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, S0.sky[0]);
  g.addColorStop(1, S0.sky[1]);
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  shape(circ(x + w * 0.78, y + h * 0.2, 26), d.q === 0 ? '#fff6dc' : '#ffd860', 0);
  const drift = RMO ? 0 : (T * 8) % (w + 300);
  cloud(x + ((w * 0.1 + drift) % (w + 200)) - 100, y + h * 0.18, 0.9);
  cloud(x + ((w * 0.6 + drift * 0.7) % (w + 200)) - 100, y + h * 0.3, 0.7);
  const F = S0.fields;
  // the region with the largest own capacity: sea, sun-dried plains, mountains or the green north
  if (d.region === 'ns' || key === 'turm') {
    const hz = y + h * (key === 'turm' ? 0.5 : 0.55);
    hills(x, w, hz, 10, mix(F[1]!, '#9fb6c9', 0.5), 3, 1.5);
    const sg = c.createLinearGradient(0, hz, 0, y + h);
    sg.addColorStop(0, '#5f9fc2');
    sg.addColorStop(1, '#2f6f98');
    c.fillStyle = sg;
    c.fillRect(x, hz, w, y + h - hz);
    line(x, hz, x + w, hz, INK, 2);
    const n = Math.max(3, Math.round(w / 90));
    for (let i = 0; i < n; i++) {
      const px = x + w * (0.12 + (i * 0.8) / n),
        py = hz + 18 + (i % 3) * 22,
        hh = 50 + (i % 3) * 26;
      line(px, py, px, py + 10, '#e8e2d6', 3);
      turbine(px, py, hh, i, 1.6);
    }
    for (let i = 0; i < 14; i++) {
      const wx = x + ((i * 97 + (RMO ? 0 : T * 12)) % w),
        wy = hz + 60 + ((i * 37) % (h * 0.45));
      line(wx, wy, wx + 26, wy, 'rgba(255,255,255,.45)', 2);
    }
  } else if (d.region === 'al') {
    const peaks: [number, number][] = [
      [0.1, 0.35],
      [0.3, 0.22],
      [0.55, 0.3],
      [0.8, 0.18],
      [1, 0.32],
    ];
    shape(
      poly([
        [x - 10, y + h],
        [x - 10, y + h * 0.5],
        ...peaks.map(([fx, fy]): [number, number] => [x + w * fx, y + h * fy]),
        [x + w + 10, y + h * 0.5],
        [x + w + 10, y + h],
      ]),
      mix(S0.tree, '#9aa3a8', 0.55),
      2,
    );
    for (const [fx, fy] of peaks)
      shape(
        poly([
          [x + w * fx - 26, y + h * fy + 30],
          [x + w * fx, y + h * fy],
          [x + w * fx + 26, y + h * fy + 30],
        ]),
        '#f6f8fa',
        1.5,
      );
    hills(x, w, y + h * 0.78, 30, F[1]!, 2.2, 2);
    shape(rr(x + w * 0.55, y + h * 0.66, w * 0.25, 18, 3), '#c9cdd3', 2);
    solarRows(x + 30, y + h * 0.9, Math.max(3, Math.round(w / 110)), 2, '#30496b');
  } else {
    hills(x, w, y + h * 0.62, 40, mix(F[2]!, S0.sky[1], 0.35), 1, 1.5);
    const far = key === 'container' ? 2 : 5;
    for (let i = 0; i < far; i++)
      turbine(x + w * (0.1 + i * 0.17), y + h * 0.6 + (i % 2) * 8, 60 + (i % 3) * 12, i, 1.4);
    hills(x, w, y + h * 0.74, 34, d.region === 'ib' ? mix(F[1]!, '#d9b26a', 0.5) : F[1]!, 2.2, 2);
    if (d.region === 'ib' || key === 'buero')
      solarRows(x + 40, y + h * 0.84, Math.max(3, Math.round(w / 90)), 3, '#30496b');
    if (key === 'buero')
      for (let i = 0; i < 3; i++) turbine(x + w * (0.62 + i * 0.14), y + h * 0.86, 150 + i * 20, i + 3, 2.4);
    hills(x, w, y + h * 0.9, 18, F[0]!, 3.3, 2);
  }
  if (key === 'altbau')
    for (let i = 0; i < 5; i++) {
      const bx = x - 10 + i * 84,
        by = y + h - 70 + (i % 2) * 18;
      shape(
        poly([
          [bx, y + h + 4],
          [bx, by],
          [bx + 42, by - 46],
          [bx + 84, by],
          [bx + 84, y + h + 4],
        ]),
        i % 2 ? '#b5523a' : '#a8462f',
        2,
      );
      shape(rr(bx + 54, by - 50, 12, 28, 1), '#8a6a52', 2);
    }
  if (key === 'container') turbine(x + w * 0.32, y + h + 40, 330, 1, 3);
  if (S0.snow) {
    c.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 40; i++) c.fillRect(x + ((i * 53) % w), y + ((i * 91 + (RMO ? 0 : T * 30)) % h), 3, 3);
  }
}

function windowFrame(d: OfficeData): void {
  const c = ctx!,
    { x, y, w, h, arch, r } = WINDOW[d.hq],
    key = KEY[d.hq];
  const path: Path = arch
    ? () => {
        c.beginPath();
        c.moveTo(x, y + h);
        c.lineTo(x, y + w / 2);
        c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
        c.lineTo(x + w, y + h);
        c.closePath();
      }
    : rr(x, y, w, h, r ?? 4);
  // light falling into the room
  c.save();
  c.globalAlpha = 0.13;
  c.fillStyle = '#fff6d8';
  c.beginPath();
  c.moveTo(x, Math.min(y + h, FLOOR));
  c.lineTo(x + w, Math.min(y + h, FLOOR));
  c.lineTo(x + w - 120, FLOOR + 90);
  c.lineTo(x - 140, FLOOR + 90);
  c.closePath();
  c.fill();
  c.restore();
  c.save();
  path();
  c.clip();
  view(d);
  c.restore();
  const fc = { container: '#7c8a87', altbau: '#f3ead6', buero: '#d9d2c3', turm: '#3a3f44' }[key];
  c.lineWidth = key === 'turm' ? 10 : 14;
  c.strokeStyle = fc;
  path();
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = INK;
  path();
  c.stroke();
  if (key === 'altbau') {
    line(x + w / 2, y + 10, x + w / 2, y + h, fc, 10);
    line(x, y + h * 0.55, x + w, y + h * 0.55, fc, 10);
    line(x + w / 2, y + 10, x + w / 2, y + h, INK, 1.5);
  }
  if (key === 'buero') for (const f of [1 / 3, 2 / 3]) line(x + w * f, y, x + w * f, y + h, fc, 8);
  if (key === 'turm')
    for (const f of [0.25, 0.5, 0.75]) {
      line(x + w * f, y, x + w * f, y + h, '#3a3f44', 7);
      line(x + w * f, y, x + w * f, y + h, 'rgba(255,255,255,.25)', 1.5);
    }
  if (key !== 'turm') shape(rr(x - 18, y + h - 2, w + 36, 18, 3), key === 'container' ? '#8e9c98' : '#efe2c2', 3, 4);
  c.save();
  path();
  c.clip();
  c.globalAlpha = 0.12;
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(x + w * 0.1, y);
  c.lineTo(x + w * 0.3, y);
  c.lineTo(x + w * 0.05, y + h);
  c.lineTo(x - w * 0.15, y + h);
  c.fill();
  c.restore();
  if (key === 'altbau' || key === 'buero') {
    const cc = key === 'altbau' ? '#9c3b33' : '#7d8f8a';
    for (const [cx, s] of [
      [x - 34, 1],
      [x + w + 34, -1],
    ] as const)
      shape(
        () => {
          c.beginPath();
          c.moveTo(cx - 26 * s, y - 30);
          c.lineTo(cx + 34 * s, y - 30);
          c.quadraticCurveTo(cx + 10 * s, y + h * 0.5, cx + 30 * s, y + h + 40);
          c.lineTo(cx - 26 * s, y + h + 40);
          c.closePath();
        },
        cc,
        3,
        5,
      );
    shape(rr(x - 70, y - 40, w + 140, 12, 6), '#6e4528', 3);
  }
}

/* ---------- the room ---------- */

function wall(hq: HqLevel): void {
  const c = ctx!,
    key = KEY[hq];
  c.fillStyle = { container: '#a9b8b4', altbau: '#d8bf8c', buero: '#e9dfc9', turm: '#d4cab4' }[key];
  c.fillRect(0, 0, W, FLOOR);
  if (key === 'container') {
    for (let x = 0; x < W; x += 30) {
      c.fillStyle = 'rgba(255,255,255,.16)';
      c.fillRect(x, 0, 11, FLOOR);
      c.fillStyle = 'rgba(0,0,0,.08)';
      c.fillRect(x + 15, 0, 6, FLOOR);
    }
    shape(rr(-5, -5, W + 10, 34, 0), '#8e9c98', 3);
  } else if (key === 'altbau') {
    for (let x = 0; x < W; x += 64) {
      c.fillStyle = 'rgba(255,246,222,.22)';
      c.fillRect(x, 0, 24, 540);
    }
    c.fillStyle = 'rgba(120,80,30,.12)';
    for (let x = 32; x < W; x += 64)
      for (let y = 80; y < 540; y += 70) {
        c.beginPath();
        c.arc(x + 12, y, 4, 0, 7);
        c.fill();
      }
    shape(rr(-5, -5, W + 10, 44, 0), '#f1e5c6', 3);
    shape(rr(-5, 39, W + 10, 10, 0), '#e2d2ac', 2);
    shape(rr(-5, 540, W + 10, 112, 0), '#6e4528', 3);
    for (let x = 230; x < W; x += 200) shape(rr(x, 556, 160, 78, 4), '#7d5233', 2);
    shape(rr(-5, 534, W + 10, 12, 0), '#5d3a20', 3);
  } else if (key === 'buero') {
    for (let x = 400; x < W; x += 400) line(x, 0, x, FLOOR, 'rgba(0,0,0,.05)', 3);
    shape(rr(-5, 624, W + 10, 28, 0), '#cfc2a8', 3);
    shape(rr(-5, -5, W + 10, 24, 0), '#f3ecdc', 3);
  } else {
    c.fillStyle = 'rgba(0,0,0,.04)';
    for (let y = 0; y < FLOOR; y += 90) c.fillRect(0, y, W, 2);
    shape(rr(-5, -5, W + 10, 30, 0), '#4a4f54', 3);
  }
}
function floor(hq: HqLevel): void {
  const c = ctx!,
    key = KEY[hq];
  c.fillStyle = { container: '#7d7a70', altbau: '#a3693a', buero: '#5c727a', turm: '#9a8e7a' }[key];
  c.fillRect(0, FLOOR, W, H - FLOOR);
  if (key === 'altbau')
    for (let r = 0, y = FLOOR; y < H; r++, y += 26) {
      line(0, y, W, y, 'rgba(60,30,10,.35)', 2);
      for (let x = (r % 2) * 90; x < W; x += 180) line(x, y, x, y + 26, 'rgba(60,30,10,.35)', 2);
    }
  else if (key === 'turm') {
    for (let x = 0; x < W; x += 160) line(x, FLOOR, x - 60, H, 'rgba(255,255,255,.18)', 2);
    for (let y = FLOOR + 60; y < H; y += 90) line(0, y, W, y, 'rgba(255,255,255,.18)', 2);
  } else if (key === 'container') {
    for (let x = 10; x < W; x += 40)
      for (let y = FLOOR + 14; y < H; y += 30) line(x, y, x + 12, y - 6, 'rgba(0,0,0,.15)', 3);
  } else {
    c.fillStyle = 'rgba(255,255,255,.04)';
    for (let i = 0; i < 300; i++) c.fillRect((i * 137) % W, FLOOR + ((i * 71) % 350), 3, 3);
  }
  line(0, FLOOR, W, FLOOR, INK, 3);
}
function door(d: OfficeData): void {
  const c = ctx!,
    key = KEY[d.hq];
  const trim = { container: '#7c8a87', altbau: '#f1e5c6', buero: '#d9d2c3', turm: '#4a4f54' }[key];
  const leaf = { container: '#5f6e6b', altbau: '#7a4a2a', buero: '#b48a5a', turm: '#2e3236' }[key];
  // the frame stands on the floor: no drop shadow below it, a threshold in front
  shape(rr(26, 156, 178, FLOOR - 156, 4), trim, 3);
  shape(rr(44, 174, 144, FLOOR - 174, 2), '#1d1610', 3);
  // ajar with warm light when a spy report is valid; closed otherwise
  const open = d.spy ? 22 : 0;
  if (open) {
    const lg = c.createLinearGradient(170 - open, 0, 190, 0);
    lg.addColorStop(0, 'rgba(255,200,90,0)');
    lg.addColorStop(1, 'rgba(255,200,90,.85)');
    c.fillStyle = lg;
    c.fillRect(160 - open + 22, 180, 26, 468);
  }
  shape(
    poly([
      [44, 174],
      [190 - open, 174 + open * 0.55],
      [190 - open, FLOOR - open * 0.55],
      [44, FLOOR],
    ]),
    leaf,
    3,
  );
  if (key === 'altbau' || key === 'container') {
    shape(rr(62, 210, 86, 160, 3), mix(leaf, '#ffffff', 0.1), 2);
    shape(rr(62, 400, 86, 200, 3), mix(leaf, '#ffffff', 0.1), 2);
  } else shape(rr(70, 220, 18, 300, 3), 'rgba(190,220,235,.7)', 2);
  shape(circ(170 - open, 420, 9), '#e2b13c', 2.5);
  // light under the door: detectives on duty
  if (d.detectives) {
    c.save();
    c.globalAlpha = 0.35;
    c.fillStyle = '#ffd27a';
    c.beginPath();
    c.moveTo(44, FLOOR);
    c.lineTo(190, FLOOR);
    c.lineTo(260, FLOOR + 50);
    c.lineTo(10, FLOOR + 50);
    c.fill();
    c.restore();
  }
  shape(
    poly([
      [26, FLOOR],
      [204, FLOOR],
      [214, FLOOR + 10],
      [16, FLOOR + 10],
    ]),
    mix(trim, '#000000', 0.25),
    2.5,
  );
  shape(rr(70, 120, 92, 26, 4), '#e2b13c', 2.5);
  text('PRIVAT', 116, 133, `700 13px ${DISPLAY}`, INK, 'center');
}
function plant(x: number): void {
  const c = ctx!,
    age = T - plantTouched,
    sway = age < 1.6 ? Math.sin(age * 14) * 0.12 * (1 - age / 1.6) : 0;
  for (const [i, [a0, l, col]] of (
    [
      [-1.1, 120, '#3f7a43'],
      [-0.5, 150, '#4d8f4f'],
      [0.1, 140, '#3f7a43'],
      [0.7, 120, '#4d8f4f'],
      [-0.2, 100, '#5ba25b'],
    ] as const
  ).entries()) {
    const a = a0 + sway * (i % 2 ? 1 : -0.8),
      ex = x + Math.sin(a) * l,
      ey = 580 - Math.cos(a) * l;
    line(x, 590, ex, ey + 20, '#2f5b33', 4);
    shape(ell(ex, ey, 30, 18, a - 0.4), col, 2.5);
  }
  shape(
    poly([
      [x - 46, 570],
      [x + 46, 570],
      [x + 36, FLOOR + 6],
      [x - 36, FLOOR + 6],
    ]),
    '#c0663a',
    3,
    5,
  );
  shape(rr(x - 52, 562, 104, 16, 4), '#d27a4a', 3);
  // a leaf drifts down to the floor and fades there
  if (age < 2.6) {
    const f = age / 2.6;
    c.save();
    c.globalAlpha = f < 0.8 ? 1 : (1 - f) / 0.2;
    shape(
      ell(x + 70 + Math.sin(age * 5) * 22, 470 + f * (FLOOR + 30 - 470), 16, 9, Math.sin(age * 5) * 0.8),
      '#5ba25b',
      2,
    );
    c.restore();
  }
}

/* rough Europe, lon −12…28, lat 35…60, drawn into the map frame */
const MAPR = { x: 252, y: 120, w: 348, h: 298 };
const gx = (lon: number) => MAPR.x + ((lon + 12) / 40) * MAPR.w,
  gy = (lat: number) => MAPR.y + ((60 - lat) / 25) * MAPR.h;
const geoPoly =
  (pts: readonly (readonly [number, number])[]): Path =>
  () => {
    const c = ctx!;
    c.beginPath();
    pts.forEach(([lo, la], i) => (i ? c.lineTo(gx(lo), gy(la)) : c.moveTo(gx(lo), gy(la))));
    c.closePath();
  };
const EUROPE = {
  main: [
    [-5.6, 36],
    [-2, 36.7],
    [-0.5, 38.3],
    [0.2, 39.8],
    [0.9, 41],
    [3.2, 42],
    [3.1, 43.1],
    [4.8, 43.4],
    [7.5, 43.8],
    [8.8, 44.4],
    [10.2, 43.9],
    [11, 42.5],
    [12.5, 41.6],
    [15.6, 40.1],
    [16, 38.5],
    [15.7, 38],
    [16.6, 38.4],
    [17.2, 39.3],
    [16.6, 40.4],
    [18.5, 40.1],
    [17, 41],
    [16, 41.9],
    [14, 42.9],
    [12.3, 44.5],
    [12.4, 45.4],
    [13.7, 45.6],
    [14.5, 45.2],
    [15.5, 44],
    [17.5, 43],
    [19.5, 41.8],
    [19.4, 40.3],
    [20.2, 39.5],
    [21.1, 37.8],
    [22.4, 36.5],
    [23.1, 37.4],
    [24, 38.2],
    [22.7, 39.5],
    [23.4, 40.2],
    [24, 40.8],
    [26, 40.8],
    [26.2, 41.3],
    [28.5, 41.2],
    [28.5, 59.4],
    [24, 59.3],
    [23.5, 58.5],
    [24.3, 57.8],
    [23.8, 57],
    [22.6, 57.6],
    [21.1, 56.9],
    [21.1, 55.7],
    [20.6, 54.9],
    [19.6, 54.4],
    [18.3, 54.8],
    [16.5, 54.5],
    [14.2, 53.9],
    [12, 54.2],
    [10.9, 54],
    [10, 54.8],
    [10.5, 56.5],
    [10.6, 57.7],
    [9.6, 57.2],
    [8.2, 56.8],
    [8.1, 55.5],
    [8.6, 54.9],
    [8.8, 54],
    [8, 53.6],
    [7, 53.4],
    [6, 53.4],
    [4.8, 53],
    [4.4, 52.2],
    [3.6, 51.4],
    [2.5, 51.1],
    [1.6, 50.9],
    [1.6, 50.2],
    [0.1, 49.6],
    [-1.2, 49.6],
    [-1.6, 48.7],
    [-3, 48.8],
    [-4.7, 48.4],
    [-4.2, 47.8],
    [-2.5, 47.3],
    [-1.2, 46.2],
    [-1.2, 44.6],
    [-1.8, 43.4],
    [-4, 43.5],
    [-7.6, 43.7],
    [-9.3, 43],
    [-8.9, 42],
    [-8.8, 40.2],
    [-9.5, 38.8],
    [-8.9, 38.4],
    [-8.8, 37],
    [-7.4, 37.2],
    [-6.3, 36.8],
  ],
  gb: [
    [-5.7, 50.1],
    [-3, 50.6],
    [1.3, 51.1],
    [1.7, 52.6],
    [0.2, 53.4],
    [-0.5, 54.5],
    [-1.6, 55.6],
    [-2.1, 57.1],
    [-1.8, 57.6],
    [-3.3, 58.6],
    [-5, 58.6],
    [-6.2, 57.5],
    [-5.6, 56],
    [-4.9, 55],
    [-3, 54.9],
    [-3.4, 54.2],
    [-3, 53.3],
    [-4.6, 53.2],
    [-4.2, 52.3],
    [-5.2, 51.7],
    [-3.2, 51.4],
    [-4.5, 51.1],
  ],
  ie: [
    [-6, 52],
    [-6.2, 53.5],
    [-5.6, 54.6],
    [-7.2, 55.3],
    [-8.5, 54.9],
    [-10, 53.6],
    [-9.6, 52.2],
    [-10.3, 51.8],
    [-8, 51.6],
  ],
  scan: [
    [5, 61],
    [5, 60],
    [5.6, 59],
    [6.5, 58.1],
    [8, 58.1],
    [9.5, 58.9],
    [10.5, 59.4],
    [11.2, 58.9],
    [11.8, 58.2],
    [12, 57.4],
    [12.6, 56.4],
    [12.9, 55.6],
    [14.2, 55.4],
    [14.6, 56.2],
    [16, 56.2],
    [16.6, 57.6],
    [16.7, 58.6],
    [17.8, 59],
    [18.8, 59.6],
    [18.6, 60.5],
    [17.6, 61],
  ],
  fi: [
    [21, 61],
    [21.3, 60.6],
    [22.5, 60],
    [24.5, 60.1],
    [26.5, 60.4],
    [28.5, 60.6],
    [28.5, 61],
  ],
  dk: [
    [10.9, 55.7],
    [12.1, 56.1],
    [12.6, 55.7],
    [12.1, 55.2],
    [11.2, 55.2],
  ],
  co: [
    [8.6, 41.4],
    [9.4, 41.4],
    [9.5, 43],
    [8.6, 42.4],
  ],
  sa: [
    [8.4, 39],
    [9.6, 39.1],
    [9.8, 41],
    [8.2, 40.9],
  ],
  si: [
    [12.4, 37.8],
    [15.6, 38.3],
    [15.1, 36.7],
  ],
  af: [
    [-12, 34],
    [-6, 35.8],
    [-5.3, 35.9],
    [-2, 35.1],
    [1, 36.5],
    [5, 36.8],
    [9.8, 37.3],
    [11.1, 37],
    [10.3, 36],
    [10.8, 35],
    [28.5, 34],
  ],
} as const;
/** The four game regions on the map: centre (lon, lat), radii in px, colour, label position. */
const ZONES: Record<
  RegionKey,
  { lo: number; la: number; rx: number; ry: number; col: string; label: string; at: [number, number]; size: number }
> = {
  ns: { lo: 2.8, la: 56.4, rx: 36, ry: 26, col: '#7fb2c9', label: 'NORDSEE', at: [-0.6, 58.9], size: 11 },
  nd: { lo: 10.2, la: 53.2, rx: 38, ry: 20, col: '#c8d98a', label: 'NORDDEUTSCHLAND', at: [11.2, 51.4], size: 9 },
  ib: { lo: -4.2, la: 40, rx: 44, ry: 36, col: '#f0c26a', label: 'IBERIEN', at: [-4.2, 41.3], size: 11 },
  al: { lo: 10.5, la: 46.7, rx: 46, ry: 16, col: '#cfd3c0', label: 'ALPEN', at: [10.5, 44.6], size: 11 },
};

function map(d: OfficeData): void {
  const c = ctx!;
  shape(rr(236, 104, 380, 330, 8), '#7a4f2e', 3, 7);
  const { x, y, w, h } = MAPR;
  shape(rr(x, y, w, h, 2), '#a9cbd6', 2);
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  for (let lo = -10; lo <= 25; lo += 10) line(gx(lo), y, gx(lo), y + h, 'rgba(255,255,255,.45)', 1);
  for (let la = 40; la <= 55; la += 5) line(x, gy(la), x + w, gy(la), 'rgba(255,255,255,.45)', 1);
  shape(geoPoly(EUROPE.af), '#e6d8b4', 2);
  for (const k of ['main', 'gb', 'ie', 'scan', 'fi', 'dk', 'co', 'sa', 'si'] as const)
    shape(geoPoly(EUROPE[k]), '#efe0b6', 2);
  for (const z of Object.values(ZONES)) {
    c.save();
    c.globalAlpha = 0.55;
    c.setLineDash([5, 4]);
    c.beginPath();
    c.ellipse(gx(z.lo), gy(z.la), z.rx, z.ry, 0, 0, 7);
    c.fillStyle = z.col;
    c.fill();
    c.globalAlpha = 1;
    c.strokeStyle = INK;
    c.lineWidth = 1.5;
    c.stroke();
    c.restore();
  }
  for (const [lo, la] of [
    [7, 47],
    [9.5, 46.4],
    [12, 47],
    [14, 46.8],
  ] as const)
    shape(
      poly([
        [gx(lo) - 9, gy(la) + 8],
        [gx(lo), gy(la) - 8],
        [gx(lo) + 9, gy(la) + 8],
      ]),
      '#b8b4a2',
      1.5,
    );
  c.restore();
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.strokeRect(x, y, w, h);
  for (const z of Object.values(ZONES))
    text(
      z.label,
      gx(z.at[0]),
      gy(z.at[1]),
      `700 ${z.size}px ${DISPLAY}`,
      z.label === 'NORDSEE' ? '#2f5f78' : INK,
      'center',
    );
  // sites as pins, spread over the region's zone on a golden-angle spiral
  for (const p of d.pins) {
    const z = ZONES[p.r],
      a = p.i * 2.39996,
      k = Math.sqrt((p.i + 0.5) / 16) * 0.85;
    const px = gx(z.lo) + Math.cos(a) * z.rx * k,
      py = gy(z.la) + Math.sin(a) * z.ry * k + 6;
    if (p.hot && !RMO) {
      const f = (T * 1.6) % 1;
      c.beginPath();
      c.arc(px, py - 11, 9 + f * 20, 0, 7);
      c.strokeStyle = `rgba(191,54,38,${1 - f})`;
      c.lineWidth = 3;
      c.stroke();
    }
    line(px, py, px, py - 10, INK, 2);
    shape(circ(px, py - 12, 6.5), d.colors[p.owner] ?? INK, 2.2);
  }
}
function monitor(d: OfficeData): void {
  const c = ctx!;
  shape(rr(650, 116, 272, 186, 12), '#3a3530', 3, 7);
  shape(rr(664, 130, 244, 142, 6), '#17222b', 2);
  text('STROMPREIS · €/MWh', 678, 148, `500 11px ${MONO}`, '#c9a65a');
  text(String(Math.round(d.price)), 678, 186, `600 38px ${MONO}`, '#f2b53a');
  const up = d.priceDelta >= 0;
  text(
    `${up ? '▲' : '▼'} ${Math.abs(Math.round(d.priceDelta))}`,
    770,
    186,
    `600 16px ${MONO}`,
    up ? '#7fd18b' : '#ff8a7a',
  );
  const ph = d.priceHist.slice(-6);
  if (ph.length > 1) {
    const lo = Math.min(...ph),
      hi = Math.max(...ph, lo + 1);
    c.beginPath();
    ph.forEach((v, i) => {
      const px = 820 + i * (75 / (ph.length - 1)),
        py = 226 - ((v - lo) / (hi - lo)) * 40;
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    });
    c.strokeStyle = '#f2b53a';
    c.lineWidth = 2.5;
    c.stroke();
  }
  c.save();
  c.beginPath();
  c.rect(664, 246, 244, 26);
  c.clip();
  c.fillStyle = '#0d151b';
  c.fillRect(664, 246, 244, 26);
  c.font = `500 13px ${MONO}`;
  const tw = Math.max(1, c.measureText(d.ticker).width),
    off = RMO ? 0 : (T * 45) % tw;
  for (let k = 0; k < 3; k++) text(d.ticker, 670 - off + k * tw, 259, `500 13px ${MONO}`, '#9fd4a8');
  c.restore();
}
function cup(x: number, y: number, s: number, col: string, handles: boolean): void {
  const c = ctx!;
  if (handles)
    for (const dx of [-1, 1]) {
      c.beginPath();
      c.arc(x + dx * 17 * s, y - 46 * s, 9 * s, 0, 7);
      c.strokeStyle = INK;
      c.lineWidth = 6;
      c.stroke();
      c.strokeStyle = col;
      c.lineWidth = 3;
      c.stroke();
    }
  shape(rr(x - 16 * s, y - 10 * s, 32 * s, 10 * s, 2), '#6e4528', 2);
  shape(rr(x - 4 * s, y - 26 * s, 8 * s, 16 * s, 2), col, 2);
  shape(
    () => {
      c.beginPath();
      c.moveTo(x - 18 * s, y - 56 * s);
      c.lineTo(x + 18 * s, y - 56 * s);
      c.quadraticCurveTo(x + 16 * s, y - 26 * s, x, y - 26 * s);
      c.quadraticCurveTo(x - 16 * s, y - 26 * s, x - 18 * s, y - 56 * s);
      c.closePath();
    },
    col,
    2,
  );
}
function shelf(d: OfficeData): void {
  const c = ctx!;
  shape(rr(646, 410, 288, 16, 3), '#7a4f2e', 3, 5);
  for (const bx of [672, 908])
    shape(
      poly([
        [bx - 8, 426],
        [bx + 8, 426],
        [bx, 450],
      ]),
      '#5d3a20',
      2,
    );
  // the latest five trophies; annual cups are the big ones with handles
  d.trophies
    .slice(-5)
    .forEach((t, i) => cup(684 + i * 44, 410, t.cup ? 1.15 : 0.85, t.gold ? '#e2b13c' : '#c9cdd3', t.cup));
  if (d.hq === 0)
    shape(
      () => {
        c.beginPath();
        c.arc(905, 410, 22, Math.PI, 0);
        c.closePath();
      },
      '#f2b53a',
      3,
    );
  else {
    line(908, 410, 908, 360, INK, 4);
    turbine(908, 410, 56, 9, 1.4);
  }
  d.rivals.forEach((r, i) => {
    const { cx, cy, r: frame } = rivalPortrait(i);
    shape(circ(cx, cy, frame), '#c98a17', 3, 4);
    const im = portraitImage(r.svg);
    if (im.complete && im.naturalWidth) {
      c.save();
      c.beginPath();
      c.arc(cx, cy, 31, 0, 7);
      c.clip();
      c.drawImage(im, cx - 31, cy - 31, 62, 62);
      c.restore();
    }
    c.beginPath();
    c.arc(cx, cy, 31, 0, 7);
    c.strokeStyle = INK;
    c.lineWidth = 2.5;
    c.stroke();
  });
}
function desk(hq: HqLevel): void {
  const c = ctx!;
  const wood = { container: '#b9935a', altbau: '#7d4b28', buero: '#a8794a', turm: '#5a3a26' }[KEY[hq]];
  shape(
    poly([
      [270, 742],
      [1330, 742],
      [1560, H + 6],
      [40, H + 6],
    ]),
    wood,
    3,
  );
  c.save();
  c.globalAlpha = 0.18;
  for (let i = 0; i < 14; i++) {
    const f = i / 13;
    line(270 + f * 1060, 742, 40 + f * 1520, H, i % 2 ? '#2a170a' : '#ffffff', 2);
  }
  c.restore();
  shape(
    poly([
      [270, 742],
      [1330, 742],
      [1336, 756],
      [264, 756],
    ]),
    mix(wood, '#ffffff', 0.15),
    2.5,
  );
  shape(
    poly([
      [560, 800],
      [1180, 800],
      [1220, H + 6],
      [520, H + 6],
    ]),
    '#2f5a4a',
    3,
  );
  c.setLineDash([6, 6]);
  c.lineWidth = 1.5;
  c.strokeStyle = 'rgba(255,240,200,.45)';
  poly([
    [574, 812],
    [1166, 812],
    [1200, H],
    [538, H],
  ])();
  c.stroke();
  c.setLineDash([]);
}
/** The laptop on the desk: the bank app with cash and loan on its screen, the keyboard on its base. */
function terminal(d: OfficeData): void {
  const c = ctx!;
  // base in aluminium, seen from above: the lid stands on its back edge
  shape(
    poly([
      [860, 834],
      [1110, 834],
      [1136, 894],
      [834, 894],
    ]),
    '#cfc8bb',
    3,
    5,
  );
  shape(rr(832, 892, 306, 9, 4), '#a8a093', 2.5);
  c.fillStyle = 'rgba(42,32,22,.32)';
  for (let row = 0; row < 3; row++) {
    const y = 842 + row * 11,
      f = (y - 834) / 60,
      x0 = 860 - f * 26 + 14,
      x1 = 1110 + f * 26 - 14;
    for (let k = 0; k < 13; k++) c.fillRect(x0 + (k * (x1 - x0)) / 13, y, (x1 - x0) / 13 - 3, 7);
  }
  shape(rr(948, 877, 74, 12, 3), '#c2baac', 1.5);
  // lid: aluminium shell, thin black bezel, the screen; the hinge joins it to the base
  shape(rr(860, 678, 250, 158, 10), '#cfc8bb', 3);
  shape(rr(866, 684, 238, 146, 6), '#14100d', 0);
  shape(rr(872, 690, 226, 134, 3), '#17222b', 0);
  shape(rr(884, 829, 202, 7, 3), '#9a9285', 2);
  text('BANK', 886, 716, `700 16px ${DISPLAY}`, '#c9a65a');
  text('KASSE', 886, 754, `500 11px ${MONO}`, '#8fa3b0');
  text(money(d.cash), 1084, 754, `600 17px ${MONO}`, d.cash < 0 ? '#ff8a7a' : '#7fd18b', 'right');
  text('KREDIT', 886, 788, `500 11px ${MONO}`, '#8fa3b0');
  text(money(d.loan), 1084, 788, `600 17px ${MONO}`, d.loan > 0 ? '#f2b53a' : '#9fd4a8', 'right');
  if (!RMO && Math.sin(T * 4) > 0) shape(rr(886, 798, 9, 12, 1), '#9fd4a8', 0);
}
function lamp(q: number): void {
  const c = ctx!,
    lit = lampLit(q);
  if (lit) {
    const g = c.createRadialGradient(470, 760, 10, 470, 760, 260);
    g.addColorStop(0, 'rgba(255,220,130,.45)');
    g.addColorStop(1, 'rgba(255,220,130,0)');
    c.fillStyle = g;
    c.fillRect(200, 560, 560, 440);
  }
  shape(ell(440, 772, 54, 14), '#c9a14a', 3);
  line(440, 770, 440, 650, '#c9a14a', 7);
  line(440, 770, 440, 650, INK, 1.5);
  shape(
    () => {
      c.beginPath();
      c.moveTo(360, 660);
      c.quadraticCurveTo(360, 610, 440, 608);
      c.quadraticCurveTo(540, 610, 540, 660);
      c.closePath();
    },
    '#2f6b4f',
    3,
    4,
  );
  if (lit) shape(ell(450, 662, 80, 8), '#ffe9a8', 2);
}
/** Breaks `s` into at most `max` lines of `width` px. */
function wrap(s: string, width: number, font: string, max: number): string[] {
  const c = ctx!;
  c.font = font;
  const out: string[] = [];
  let cur = '';
  for (const w of s.split(' ')) {
    const t = cur ? cur + ' ' + w : w;
    if (c.measureText(t).width > width && cur) {
      out.push(cur);
      cur = w;
      if (out.length === max) break;
    } else cur = t;
  }
  if (out.length < max && cur) out.push(cur);
  if (out.length === max && s.length > out.join(' ').length) out[max - 1] = out[max - 1]!.replace(/\s*\S*$/, ' …');
  return out;
}
function newspaper(d: OfficeData): void {
  const c = ctx!;
  c.save();
  c.translate(690, 900);
  c.rotate(-0.07);
  shape(rr(-150, -82, 300, 176, 3), '#f4efe0', 3, 5);
  text('ENERGIE-KURIER', 0, -60, `700 20px ${DISPLAY}`, INK, 'center');
  line(-136, -44, 136, -44, INK, 2);
  line(-136, -40, 136, -40, INK, 1);
  const font = '700 17px Georgia, serif';
  wrap(d.headline, 272, font, 2).forEach((l, i) => text(l, -136, -22 + i * 22, font));
  shape(rr(46, 26, 90, 56, 2), '#d9e3ea', 2);
  turbine(92, 78, 44, 2, 1.2);
  c.fillStyle = 'rgba(42,32,22,.28)';
  for (let i = 0; i < 5; i++) c.fillRect(-136, 32 + i * 11, i === 4 ? 110 : 170, 4);
  c.restore();
}
function phone(d: OfficeData): void {
  const c = ctx!;
  const ring = d.ringing,
    buzz = ring && !RMO && Math.sin(T * 3) > 0;
  const jx = buzz ? Math.sin(T * 90) * 2.5 : 0,
    jy = buzz ? Math.cos(T * 70) * 1.5 : 0;
  c.save();
  c.translate(1370 + jx, 862 + jy);
  c.rotate(-0.1);
  c.scale(0.8, 0.8);
  shape(rr(-62, -108, 124, 216, 18), '#1d1d22', 3, 6);
  shape(rr(-53, -96, 106, 188, 10), ring ? '#20354a' : '#11161b', 1.5);
  shape(rr(-14, -103, 28, 5, 3), '#000', 0);
  if (ring) {
    const g = c.createLinearGradient(0, -96, 0, 92);
    g.addColorStop(0, '#2c4f6e');
    g.addColorStop(1, '#183049');
    c.fillStyle = g;
    c.beginPath();
    c.roundRect(-53, -96, 106, 188, 10);
    c.fill();
    text('Eingehender Anruf', 0, -74, `600 10px ${SANS}`, '#bcd2e6', 'center');
    shape(circ(0, -36, 20), '#e3c182', 2);
    text(d.caller.slice(0, 1).toUpperCase(), 0, -35, `700 18px ${DISPLAY}`, INK, 'center');
    wrap(d.caller, 96, `700 12px ${SANS}`, 2).forEach((l, i) =>
      text(l, 0, -2 + i * 16, `700 12px ${SANS}`, '#ffffff', 'center'),
    );
    shape(circ(-26, 62, 14), '#d64b3c', 2);
    shape(circ(26, 62, 14), '#3fae5a', 2);
  } else {
    // the time follows the quarter: winter mornings are dark
    text(PHONE_TIME[d.q]!, 0, -40, `600 26px ${MONO}`, '#5d6b78', 'center');
  }
  c.restore();
  if (buzz)
    for (const s of [-1, 1])
      for (let k = 0; k < 2; k++) {
        const bx = 1370 + s * (68 + k * 12);
        c.beginPath();
        c.moveTo(bx, 832);
        c.quadraticCurveTo(bx + s * 7, 862, bx, 892);
        c.strokeStyle = INK;
        c.lineWidth = 3;
        c.stroke();
      }
}
function nameplate(): void {
  shape(
    poly([
      [580, 790],
      [820, 790],
      [808, 752],
      [592, 752],
    ]),
    '#d9a83a',
    3,
    4,
  );
  text('VORSTANDSVORSITZ', 700, 773, `700 13px ${DISPLAY}`, '#3d2a08', 'center');
}
function mug(col: string, full: boolean): void {
  const c = ctx!;
  c.save();
  c.translate(90, 0);
  shape(rr(1110, 840, 64, 74, 8), col, 3, 4);
  c.beginPath();
  c.arc(1180, 876, 18, -1.3, 1.3);
  c.strokeStyle = INK;
  c.lineWidth = 9;
  c.stroke();
  c.strokeStyle = col;
  c.lineWidth = 4;
  c.stroke();
  shape(ell(1142, 842, 30, 7), full ? '#4a2e1a' : mix(col, '#000000', 0.55), 2.5);
  c.save();
  c.translate(1142, 878);
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(4, -16);
  c.lineTo(-8, 2);
  c.lineTo(0, 2);
  c.lineTo(-3, 16);
  c.lineTo(9, -3);
  c.lineTo(1, -3);
  c.closePath();
  c.fill();
  c.restore();
  if (!RMO && full)
    for (let i = 0; i < 2; i++) {
      const o = (T * 20 + i * 30) % 60;
      c.beginPath();
      c.moveTo(1132 + i * 18, 830 - o);
      c.quadraticCurveTo(1122 + i * 18, 815 - o, 1134 + i * 18, 800 - o);
      c.strokeStyle = `rgba(255,255,255,${0.6 - o / 100})`;
      c.lineWidth = 3;
      c.stroke();
    }
  c.restore();
}

const SEASON_LIGHT = [
  'rgba(110,140,190,.10)',
  'rgba(255,240,200,.04)',
  'rgba(255,200,110,.07)',
  'rgba(200,120,60,.08)',
];

function draw(): void {
  const c = ctx,
    d = data;
  if (!c || !d || !cv?.width) return;
  c.setTransform(scale, 0, 0, scale, 0, 0);
  c.clearRect(0, 0, W, vh);
  c.translate(0, -crop.top);
  wall(d.hq);
  floor(d.hq);
  windowFrame(d);
  map(d);
  monitor(d);
  shelf(d);
  door(d);
  plant(1490);
  // the desk stands at the bottom edge whatever the cropping
  c.translate(0, crop.top - crop.cut);
  desk(d.hq);
  lamp(d.q);
  newspaper(d);
  nameplate();
  terminal(d);
  phone(d);
  mug(d.colors[0] ?? '#2f5bd3', mugDrunk !== d.turn);
  c.setTransform(scale, 0, 0, scale, 0, 0);
  c.fillStyle = SEASON_LIGHT[d.q]!;
  c.fillRect(0, 0, W, vh);
  if (grain) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = grain;
    c.fillRect(0, 0, cv.width, cv.height);
    c.restore();
    c.setTransform(scale, 0, 0, scale, 0, 0);
  }
  const v = c.createRadialGradient(W / 2, vh * 0.45, vh * 0.45, W / 2, vh * 0.5, vh * 1.05);
  v.addColorStop(0, 'rgba(42,32,22,0)');
  v.addColorStop(1, 'rgba(42,32,22,.38)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, vh);
}
