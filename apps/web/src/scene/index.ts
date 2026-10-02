/**
 * Animated region landscapes (ported from legacy/src/scene.js). Every `canvas[data-scene]` on the page
 * is registered and redrawn about 30 times per second; with reduced motion it is drawn once.
 */
import { clamp, SEASON } from '@power-tycoon/engine';
import { playerMark } from '../players.js';
import { RMO, S, UI } from '../state.js';
import { mix } from './color.js';
import {
  drawAtmosphere,
  drawAviationLights,
  drawCloudShadows,
  drawHaze,
  drawNightLights,
  drawTexture,
  drawVignette,
  noiseCanvas,
} from './effects.js';
import type { Ctx, Frame } from './frame.js';
import { geo, quad } from './geometry.js';
import { drawFarScenery, drawGround } from './landscape.js';
import { drawObject } from './objects.js';
import { DEFAULT_PLAYER_COLORS, FIELDS, SEASONS } from './palette.js';
import { drawFields, drawPlotFrames } from './plots.js';
import { drawSky } from './sky.js';

export { geo, quad } from './geometry.js';

interface Scene {
  cv: HTMLCanvasElement;
  ctx: Ctx;
  W: number;
  H: number;
  r: Frame['r'];
  mini: boolean;
  pat?: CanvasPattern | null;
}

const SC: Scene[] = [];
const T0 = performance.now();
let raf = 0;
let last = 0;
let colors = DEFAULT_PLAYER_COLORS;
let hovered: string | null = null;

/** Highlights the plot under the pointer. */
export function setHover(id: string | null): void {
  if (id !== hovered) {
    hovered = id;
    if (RMO) SC.forEach((sc) => drawScene(sc, 0));
  }
}

/** Finds all scene canvases on the page (call after every render). */
export function registerScenes(): void {
  SC.length = 0;
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-scene]').forEach((cv) => {
    const W = cv.clientWidth,
      H = cv.clientHeight;
    if (!W || !H) return;
    const d = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * d);
    cv.height = Math.round(H * d);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    SC.push({ cv, ctx, W, H, r: cv.dataset.scene as Frame['r'], mini: !!cv.dataset.mini });
  });
  readCols();
  if (RMO) {
    SC.forEach((sc) => drawScene(sc, 0));
    return;
  }
  if (!raf) raf = requestAnimationFrame(loop);
}

/** Reads the player colours from the CSS (they change with the colour scheme). */
export function readCols(): void {
  const cs = getComputedStyle(document.documentElement);
  colors = [0, 1, 2, 3].map((i) => cs.getPropertyValue('--c' + i).trim() || colors[i]!);
}

function loop(now: number): void {
  raf = requestAnimationFrame(loop);
  if (now - last < 33 || document.hidden) return;
  last = now;
  const t = (now - T0) / 1000;
  for (const sc of SC) if (sc.cv.isConnected) drawScene(sc, t);
}

/** Time of day, light and everything else that is the same for all layers of one frame. */
function frame(sc: Scene, t: number, q: number): Frame {
  const { ctx, W, H, r, mini } = sc,
    se = SEASONS[q]!;
  const p = RMO ? 0.27 : (t / 150 + 0.18) % 1,
    e = Math.sin(p * Math.PI * 2),
    d = clamp(e * 2 + 0.8, 0, 1);
  const low = p < 0.5 ? clamp(1 - e * 1.7, 0, 1) : 0; // morning/evening light
  const sunX = W * (0.05 + 0.9 * (p / 0.5));
  const onSites = UI.tab === 'sites';
  return {
    ctx,
    W,
    H,
    r,
    mini,
    still: RMO,
    q,
    se,
    g: geo(W, H),
    t,
    p,
    e,
    d,
    low,
    wf: SEASON.wind[q]!,
    hzc: mix(se.sky[1], '#ff9a5c', low * 0.85),
    shx: p < 0.5 ? clamp((W / 2 - sunX) / (W / 2), -1, 1) * (1 - e * 0.5) : 0,
    F: (FIELDS[r] || [])[q] || se.fields,
    L: (c) => mix('#1a2618', c, d * 0.85 + 0.15),
    colors,
    label: playerMark,
    hover: onSites ? hovered : null,
    selected: onSites ? UI.sel : null,
    lights: [],
  };
}

function drawScene(sc: Scene, t: number): void {
  const view = S.view;
  const sites = view ? view.sites.filter((x) => x.r === sc.r) : [];
  const fr = frame(sc, t, view ? view.q : 0);
  const plots = sites.map((x) => ({ x, qd: quad(fr.g, x.i) }));
  const clouds = drawSky(fr);
  drawFarScenery(fr);
  drawGround(fr);
  drawHaze(fr);
  drawFields(fr, plots);
  if (!sc.pat) sc.pat = sc.ctx.createPattern(noiseCanvas(), 'repeat');
  drawTexture(fr, sc.pat);
  drawPlotFrames(fr, plots);
  // objects back to front
  for (const plot of plots) drawObject(fr, plot);
  drawCloudShadows(fr, clouds);
  drawAtmosphere(fr);
  drawNightLights(fr, plots);
  drawVignette(fr);
  drawAviationLights(fr);
}
