/** Objects on the plots: owner flags, hay bales and the plants in all their stages. */
import { clamp, operating, PLANTS, SEASON, type PlantClass, type PlantType, type SiteView } from '@power-tycoon/engine';
import { h1, mix } from './color.js';
import type { Frame, Plot } from './frame.js';
import type { Quad } from './geometry.js';

/** A plot with an object and the measures derived from its geometry. */
interface Spot {
  x: SiteView;
  qd: Quad;
  st: PlantType;
  cls: PlantClass;
  /** Plot width, base point and a size unit. */
  u: number;
  bx: number;
  by: number;
  s: number;
  /** Producing (operating and no fault). */
  op: boolean;
  /** Rotor angle. */
  spin: number;
}

function bales(fr: Frame, qd: Quad, i: number): void {
  const { ctx, g, d, shx } = fr;
  const base = mix('#2a2414', '#dcb65a', d * 0.85 + 0.15),
    face = mix('#2a2414', '#ecd083', d * 0.85 + 0.15);
  for (let k = 0; k < 3; k++) {
    const v = 0.28 + k * 0.2 + h1(i + k * 3) * 0.08,
      y = qd.y0 + (qd.y1 - qd.y0) * (0.35 + h1(i + k + 9) * 0.45),
      x = g.X(qd.u0 + (qd.u1 - qd.u0) * v, y),
      rr = Math.max(3, qd.bw * 0.045),
      len = rr * 1.3;
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath();
    ctx.ellipse(x + len * 0.5 + shx * rr, y + rr * 0.9, len * 0.9 + Math.abs(shx) * rr, rr * 0.3, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.moveTo(x, y - rr);
    ctx.lineTo(x + len, y - rr);
    ctx.ellipse(x + len, y, rr * 0.45, rr, 0, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x, y + rr);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,75,20,.25)';
    ctx.lineWidth = Math.max(0.6, rr * 0.08);
    for (const f of [0.35, 0.7]) {
      ctx.beginPath();
      ctx.moveTo(x + len * f, y - rr * 0.98);
      ctx.lineTo(x + len * f, y + rr * 0.98);
      ctx.stroke();
    }
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.ellipse(x, y, rr * 0.45, rr, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,20,.5)';
    ctx.lineWidth = Math.max(0.6, rr * 0.1);
    ctx.beginPath();
    ctx.ellipse(x, y, rr * 0.27, rr * 0.6, 0, 0, 5.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y, rr * 0.1, rr * 0.24, 0, 0, 6);
    ctx.stroke();
  }
}
function flag(fr: Frame, x: number, y: number, u: number, col: string, letter: string): void {
  const { ctx, t, mini, still } = fr;
  const fh = Math.max(10, u * 0.19),
    fw = fh * 0.78,
    fl = fh * 0.52,
    w = still ? 0 : Math.sin(t * 3.2 + x * 0.1) * fl * 0.12;
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath();
  ctx.ellipse(x + 1, y, fh * 0.12, fh * 0.04, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#2b2f33';
  ctx.lineWidth = Math.max(1.2, fh * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - fh);
  ctx.stroke();
  ctx.fillStyle = '#f2c230';
  ctx.beginPath();
  ctx.arc(x, y - fh, Math.max(1.2, fh * 0.05), 0, 7);
  ctx.fill();
  const top = y - fh + fh * 0.04;
  ctx.fillStyle = col;
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = Math.max(0.8, fh * 0.04);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.quadraticCurveTo(x + fw * 0.5, top - w, x + fw, top + w * 0.5);
  ctx.lineTo(x + fw, top + fl + w * 0.5);
  ctx.quadraticCurveTo(x + fw * 0.5, top + fl - w, x, top + fl);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (!mini && fl >= 8) {
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${Math.round(fl * 0.72)}px Manrope,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, x + fw * 0.5, top + fl * 0.52 + w * 0.2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}
function turbine(fr: Frame, x: number, y: number, h: number, ang: number, off: boolean): void {
  const { ctx, d, shx, lights } = fr;
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath();
  ctx.ellipse(x + h * 0.08, y, h * 0.12, h * 0.03, 0, 0, 7);
  ctx.fill();
  if (shx && !off) {
    const l = h * 0.8 * shx,
      sy = y + h * 0.07;
    ctx.fillStyle = 'rgba(0,0,0,.13)';
    ctx.beginPath();
    ctx.moveTo(x - h * 0.02, y);
    ctx.lineTo(x + h * 0.02, y);
    ctx.lineTo(x + l + h * 0.008, sy);
    ctx.lineTo(x + l - h * 0.008, sy);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.07)';
    ctx.beginPath();
    ctx.ellipse(x + l, sy, h * 0.4, h * 0.05, 0, 0, 7);
    ctx.fill();
  }
  if (off) {
    ctx.fillStyle = '#e8b923';
    ctx.fillRect(x - h * 0.035, y - h * 0.14, h * 0.07, h * 0.16);
    ctx.fillStyle = '#50585c';
    ctx.fillRect(x - h * 0.07, y - h * 0.15, h * 0.14, h * 0.02);
  }
  const base = off ? y - h * 0.14 : y,
    top = y - h;
  ctx.fillStyle = mix('#56606a', '#f5f7f6', d);
  ctx.strokeStyle = 'rgba(0,0,0,.18)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - h * 0.028, base);
  ctx.lineTo(x + h * 0.028, base);
  ctx.lineTo(x + h * 0.011, top);
  ctx.lineTo(x - h * 0.011, top);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = mix('#4c555e', '#e8ecea', d);
  ctx.fillRect(x - h * 0.025, top - h * 0.03, h * 0.1, h * 0.055);
  const rl = h * 0.45;
  for (let k = 0; k < 3; k++) {
    ctx.save();
    ctx.translate(x, top);
    ctx.rotate(ang + k * 2.0944);
    ctx.fillStyle = mix('#56606a', '#fbfcfc', d);
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.018);
    ctx.quadraticCurveTo(rl * 0.3, -h * 0.045, rl, -h * 0.005);
    ctx.lineTo(rl, h * 0.005);
    ctx.quadraticCurveTo(rl * 0.3, h * 0.025, 0, h * 0.018);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d8413a';
    ctx.fillRect(rl * 0.88, -h * 0.006, rl * 0.1, h * 0.012);
    ctx.restore();
  }
  ctx.fillStyle = mix('#56606a', '#ffffff', d);
  ctx.beginPath();
  ctx.arc(x, top, h * 0.028, 0, 7);
  ctx.fill();
  ctx.stroke();
  lights.push([x + h * 0.03, top - h * 0.035]);
}
/** Leased, no plant type yet: surveying stakes. */
function drawStakes(fr: Frame, sp: Spot): void {
  const { ctx } = fr;
  const { u, bx, by, s } = sp;
  for (let k = 0; k < 3; k++) {
    const px = bx - u * 0.2 + k * u * 0.2,
      py = by - (k % 2) * u * 0.05;
    ctx.fillStyle = '#fff';
    ctx.fillRect(px - 1, py - s * 2, 2.4, s * 2);
    ctx.fillStyle = '#d8413a';
    ctx.fillRect(px - 1, py - s * 2, 2.4, s * 0.6);
    ctx.fillRect(px - 1, py - s * 0.9, 2.4, s * 0.5);
  }
}

/** Permit pending (§) or rejected (✕). */
function drawPermitSign(fr: Frame, sp: Spot): void {
  const { ctx } = fr;
  const { x, bx, by, s } = sp;
  ctx.fillStyle = '#6b4f33';
  ctx.fillRect(bx - 1.5, by - s * 3, 3, s * 3);
  ctx.fillStyle = x.permit === 'rejected' ? '#f3d6d2' : '#fdfcf7';
  ctx.strokeStyle = '#6b4f33';
  ctx.lineWidth = 1;
  ctx.fillRect(bx - s * 2, by - s * 5.2, s * 4, s * 2.6);
  ctx.strokeRect(bx - s * 2, by - s * 5.2, s * 4, s * 2.6);
  ctx.fillStyle = x.permit === 'rejected' ? '#b42318' : '#2b2b2b';
  ctx.font = `700 ${Math.max(8, s * 2)}px Manrope,sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(x.permit === 'rejected' ? '✕' : '§', bx, by - s * 3.2);
  ctx.textAlign = 'left';
}

/** Construction site with crane (a failed assembly shows a "!"). */
function drawConstruction(fr: Frame, sp: Spot): void {
  const { ctx, t, d } = fr;
  const { x, st, cls, u, bx, by, s } = sp;
  // construction site
  const ch = u * (st === 'off' ? 1.1 : 0.95);
  ctx.strokeStyle = '#e0a100';
  ctx.lineWidth = Math.max(1.5, u * 0.02);
  ctx.beginPath();
  ctx.moveTo(bx + u * 0.25, by);
  ctx.lineTo(bx + u * 0.25, by - ch);
  ctx.lineTo(bx - u * 0.25, by - ch);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#333';
  const hk = bx - u * 0.1 + Math.sin(t * 1.3) * u * 0.04;
  ctx.beginPath();
  ctx.moveTo(bx - u * 0.1, by - ch);
  ctx.lineTo(hk, by - ch * 0.55);
  ctx.stroke();
  if (cls === 'wind') {
    ctx.fillStyle = mix('#56606a', '#eef1f0', d);
    ctx.fillRect(bx - u * 0.03, by - ch * 0.45, u * 0.06, ch * 0.45);
  } else {
    ctx.fillStyle = '#b5b9b6';
    ctx.fillRect(bx - u * 0.2, by - u * 0.12, u * 0.3, u * 0.12);
  }
  if (x.fail) {
    ctx.fillStyle = '#b42318';
    ctx.font = `700 ${Math.max(9, s * 2)}px Manrope,sans-serif`;
    ctx.fillText('!', bx - u * 0.3, by - u * 0.1);
  }
}

/** Rising sparks above an operating plant. */
function drawSparks(fr: Frame, sp: Spot): void {
  const { ctx, t } = fr;
  const { x, cls, u, bx, by } = sp;
  const sc = cls === 'store' ? '126,226,160' : '255,222,110';
  ctx.shadowColor = `rgb(${sc})`;
  ctx.shadowBlur = 6;
  for (let k = 0; k < 4; k++) {
    const f = (t * 0.32 + k / 4 + h1(x.i)) % 1,
      px = bx + Math.sin(f * 7 + k * 2) * u * 0.2,
      py = by - u * 0.12 - f * u * 0.6;
    ctx.fillStyle = `rgba(${sc},${Math.sin(f * Math.PI) * 0.95})`;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1.2, u * 0.011) * (1 - f * 0.4), 0, 7);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

/** Two onshore turbines or one offshore turbine on its foundation. */
function drawWind(fr: Frame, sp: Spot): void {
  const { x, st, u, bx, by, spin } = sp;
  const h = u * (st === 'off' ? 0.9 : 0.68);
  if (st === 'wind') {
    turbine(fr, bx - u * 0.18, by - u * 0.08, h * 0.85, spin + h1(x.i), false);
    turbine(fr, bx + u * 0.2, by, h, spin * 1.07 + 1, false);
  } else turbine(fr, bx, by, h, spin, true);
}

/** Three rows of panels with a light reflex running over them. */
function drawSolar(fr: Frame, sp: Spot): void {
  const { ctx, g, t, d } = fr;
  const { qd, op } = sp;
  for (let k = 0; k < 3; k++) {
    const y = qd.y0 + (qd.y1 - qd.y0) * (0.28 + k * 0.25),
      x0 = g.X(qd.u0 + 0.02, y) + 2,
      x1 = g.X(qd.u1 - 0.02, y) - 2,
      ph = (qd.y1 - qd.y0) * 0.14;
    ctx.fillStyle = '#50575a';
    ctx.fillRect(x0 + 4, y, 1.5, ph * 0.6);
    ctx.fillRect(x1 - 6, y, 1.5, ph * 0.6);
    const gr = ctx.createLinearGradient(x0, 0, x1, 0);
    const gp = op && d > 0.5 ? ((t * 0.25 + k * 0.2) % 1.6) - 0.3 : -1;
    gr.addColorStop(0, mix('#0b1633', '#1d3a8a', d));
    if (gp > 0 && gp < 1) {
      gr.addColorStop(clamp(gp - 0.08, 0, 1), mix('#0b1633', '#1d3a8a', d));
      gr.addColorStop(gp, '#9fc0ff');
      gr.addColorStop(clamp(gp + 0.08, 0, 1), mix('#0b1633', '#1d3a8a', d));
    }
    gr.addColorStop(1, mix('#0b1633', '#27469a', d));
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(x0 + 3, y - ph);
    ctx.lineTo(x1 + 3, y - ph);
    ctx.lineTo(x1, y);
    ctx.lineTo(x0, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,185,235,.35)';
    ctx.lineWidth = 0.6;
    for (let j = 1; j < 6; j++) {
      const xx = x0 + ((x1 - x0) * j) / 6;
      ctx.beginPath();
      ctx.moveTo(xx + 3, y - ph);
      ctx.lineTo(xx, y);
      ctx.stroke();
    }
  }
}

/** Two battery containers with status LEDs. */
function drawBattery(fr: Frame, sp: Spot): void {
  const { ctx, t, d, colors, lights } = fr;
  const { x, u, bx, by, op } = sp;
  for (let k = 0; k < 2; k++) {
    const w = u * 0.3,
      h = u * 0.14,
      x0 = bx - u * 0.34 + k * u * 0.36,
      y0 = by - h;
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.fillRect(x0 + 3, by - 2, w, 4);
    ctx.fillStyle = mix('#4d555c', '#e9edef', d);
    ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = mix('#3d444a', '#cfd6da', d);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + w * 0.12, y0 - h * 0.35);
    ctx.lineTo(x0 + w * 1.12, y0 - h * 0.35);
    ctx.lineTo(x0 + w, y0);
    ctx.fill();
    ctx.fillStyle = colors[x.owner]!;
    ctx.fillRect(x0, y0 + h * 0.35, w, h * 0.15);
    ctx.fillStyle = op ? (Math.floor(t * 2 + k) % 2 ? '#39d353' : '#1a7f37') : '#666';
    ctx.fillRect(x0 + w * 0.8, y0 + h * 0.65, 3, 3);
    lights.push([x0 + w * 0.8 + 1.5, y0 + h * 0.65 + 1.5, op ? '#39d353' : '#666']);
  }
}

/** Dam with running water. */
function drawHydro(fr: Frame, sp: Spot): void {
  const { ctx, t, d } = fr;
  const { u, bx, by, op } = sp;
  const w = u * 0.7,
    x0 = bx - w / 2,
    dh = u * 0.2;
  ctx.fillStyle = mix('#0b2033', '#4a90c2', d);
  ctx.fillRect(x0, by - dh - u * 0.12, w, u * 0.12);
  ctx.fillStyle = mix('#44494c', '#b9bdb9', d);
  ctx.beginPath();
  ctx.moveTo(x0 - 4, by);
  ctx.lineTo(x0 + w + 4, by);
  ctx.lineTo(x0 + w, by - dh);
  ctx.lineTo(x0, by - dh);
  ctx.fill();
  if (op) {
    ctx.strokeStyle = 'rgba(235,245,255,.85)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 5; k++) {
      const xx = x0 + w * (0.2 + k * 0.15),
        o = (t * 30 + k * 7) % 10;
      ctx.beginPath();
      ctx.moveTo(xx, by - dh + o);
      ctx.lineTo(xx, by - dh + o + 5);
      ctx.stroke();
    }
  }
}

/** Upper basin, penstock and powerhouse with flowing water. */
function drawPump(fr: Frame, sp: Spot): void {
  const { ctx, t, d, colors } = fr;
  const { x, qd, u, bx, by, op } = sp;
  const ux = bx - u * 0.22,
    uy = qd.y0 + (qd.y1 - qd.y0) * 0.3;
  ctx.fillStyle = mix('#44494c', '#aab0ad', d);
  ctx.beginPath();
  ctx.ellipse(ux, uy, u * 0.2, u * 0.06, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = mix('#0b2033', '#4a90c2', d);
  ctx.beginPath();
  ctx.ellipse(ux, uy, u * 0.17, u * 0.045, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#5c6166';
  ctx.lineWidth = Math.max(2, u * 0.025);
  ctx.beginPath();
  ctx.moveTo(ux + u * 0.1, uy + 2);
  ctx.lineTo(bx + u * 0.2, by - u * 0.08);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = mix('#44494c', '#e3e6e4', d);
  ctx.fillRect(bx + u * 0.12, by - u * 0.14, u * 0.18, u * 0.12);
  ctx.fillStyle = colors[x.owner]!;
  ctx.fillRect(bx + u * 0.12, by - u * 0.16, u * 0.18, u * 0.03);
  if (op) {
    ctx.fillStyle = '#bfe3ff';
    for (let k = 0; k < 4; k++) {
      const f = (t * 0.4 + k / 4) % 1,
        px = ux + u * 0.1 + (bx + u * 0.2 - ux - u * 0.1) * f,
        py = uy + 2 + (by - u * 0.08 - uy - 2) * f;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, 7);
      ctx.fill();
    }
  }
}

/** Smoke and a blinking warning sign. */
function drawFault(fr: Frame, sp: Spot): void {
  const { ctx, still, t } = fr;
  const { u, bx, by } = sp;
  for (let k = 0; k < 4; k++) {
    const f = (t * 0.5 + k / 4) % 1;
    ctx.fillStyle = `rgba(90,90,90,${0.55 * (1 - f)})`;
    ctx.beginPath();
    ctx.arc(bx + Math.sin(f * 6 + k) * u * 0.05, by - u * 0.2 - f * u * 0.6, u * (0.05 + f * 0.1), 0, 7);
    ctx.fill();
  }
  if (still || Math.floor(t * 3) % 2 === 0) {
    ctx.fillStyle = '#e5484d';
    ctx.beginPath();
    ctx.moveTo(bx, by - u * 0.75);
    ctx.lineTo(bx + u * 0.1, by - u * 0.58);
    ctx.lineTo(bx - u * 0.1, by - u * 0.58);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx - 1, by - u * 0.71, 2, u * 0.08);
  }
}

/** Yellow diamond: output cut by a citizens' initiative. */
function drawCurtailed(fr: Frame, sp: Spot): void {
  const { ctx } = fr;
  const { u, bx, by, s } = sp;
  ctx.fillStyle = '#f0b429';
  ctx.save();
  ctx.translate(bx - u * 0.35, by - u * 0.25);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-s, -s, s * 2, s * 2);
  ctx.restore();
}

const PLANT_PAINTERS: Record<PlantType, (fr: Frame, sp: Spot) => void> = {
  wind: drawWind,
  off: drawWind,
  solar: drawSolar,
  batt: drawBattery,
  hydro: drawHydro,
  pump: drawPump,
};

/** Draws everything on one plot, depending on its owner and stage. */
export function drawObject(fr: Frame, { x, qd }: Plot): void {
  const { r, mini, still, q, t, d, colors, label } = fr;
  const u = qd.bw,
    bx = qd.cx,
    by = qd.y1 - (qd.y1 - qd.y0) * 0.22,
    s = Math.max(3, u * 0.06);
  if (x.owner >= 0) {
    const fx = qd.p[1]![0] - u * 0.26,
      fy = qd.p[1]![1] + (qd.y1 - qd.y0) * 0.3;
    flag(fr, fx, fy, u, colors[x.owner]!, label(x.owner));
  }
  if (x.owner < 0) {
    if (!mini && (r === 'nd' || r === 'ib') && (q === 2 || q === 3) && h1(x.i + 3) < 0.6) bales(fr, qd, x.i);
    return;
  }
  const st = x.type;
  const sp = { x, qd, u, bx, by, s } as Spot;
  if (!st) return drawStakes(fr, sp);
  if (x.permit === 'pending' || x.permit === 'rejected') return drawPermitSign(fr, sp);
  sp.st = st;
  sp.cls = PLANTS[st].cls;
  sp.op = operating(x) && !x.fault;
  if (!x.built) return drawConstruction(fr, sp);
  if (sp.op && !mini && !still && d > 0.15) drawSparks(fr, sp);
  sp.spin = sp.op ? t * (1.2 + ((x.wind || 7) - 5) * 0.35) * SEASON.wind[q]! : 0;
  PLANT_PAINTERS[st](fr, sp);
  if (x.fault) drawFault(fr, sp);
  else if (x.curtail > 0) drawCurtailed(fr, sp);
}
