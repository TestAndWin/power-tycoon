/** Landscape: background at the horizon, ground (sea or fields with farm tracks) and trees. */
import { SEASON, type RegionKey } from '@power-tycoon/engine';
import { h1, mix, shade } from './color.js';
import type { Ctx, Frame, Light } from './frame.js';
import { ROAD, type Season } from './palette.js';

/** Background at the horizon: dunes and a lighthouse, an offshore platform, Spanish hills or the Alps. */
export function drawFarScenery(fr: Frame): void {
  const { ctx, r, W, g, q, t, d, lights } = fr,
    hz = g.hz;
  if (r === 'nd') {
    ctx.fillStyle = mix('#10200f', q === 0 ? '#b9c6c2' : '#4f7d45', d);
    ctx.fillRect(0, hz - 6, W, 8);
    for (let i = 0; i < 9; i++) {
      const x = W * h1(i + 70),
        hh = 4 + h1(i + 80) * 6;
      ctx.fillStyle = mix('#10180f', q === 0 ? '#8c9a94' : '#3f6a3a', d);
      ctx.beginPath();
      ctx.arc(x, hz - 4, hh, Math.PI, 0);
      ctx.fill();
    }
    // lighthouse
    const lx = W * 0.86;
    ctx.fillStyle = mix('#222', '#f2f2f2', d);
    ctx.fillRect(lx - 3, hz - 26, 6, 22);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(lx - 3, hz - 18, 6, 4);
    ctx.fillRect(lx - 3, hz - 10, 6, 4);
    ctx.fillStyle = '#333';
    ctx.fillRect(lx - 4, hz - 30, 8, 4);
    if (d < 0.8) {
      const a = t * 1.5;
      ctx.fillStyle = 'rgba(255,240,170,.18)';
      ctx.beginPath();
      ctx.moveTo(lx, hz - 28);
      ctx.lineTo(lx + Math.cos(a) * 90, hz - 28 + Math.sin(a) * 8 - 6);
      ctx.lineTo(lx + Math.cos(a) * 90, hz - 28 + Math.sin(a) * 8 + 6);
      ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      const x = W * (0.12 + i * 0.13 + h1(i) * 0.05);
      miniTurbine(ctx, x, hz - 3, 14 + h1(i + 3) * 6, t * (1.4 + h1(i)) * SEASON.wind[q]!, d, lights);
    }
  } else if (r === 'ns') {
    ctx.fillStyle = mix('#1a2533', '#6b7b8a', d);
    ctx.fillRect(W * 0.62, hz - 7, 26, 4);
    ctx.fillRect(W * 0.62 + 6, hz - 12, 10, 5);
    ctx.fillRect(W * 0.62 + 14, hz - 17, 2, 6);
    for (let i = 0; i < 7; i++) {
      const x = W * (0.05 + i * 0.07);
      miniTurbine(ctx, x, hz, 12 + h1(i) * 4, t * 1.8 * SEASON.wind[q]!, d, lights);
    }
  } else if (r === 'ib') {
    const cols = [mix('#1d170f', '#b98d58', d), mix('#1d170f', '#a8794a', d)];
    (
      [
        [0.35, 22],
        [0.1, 14],
      ] as const
    ).forEach(([off, a], k) => {
      ctx.fillStyle = cols[k]!;
      ctx.beginPath();
      ctx.moveTo(0, hz + 2);
      for (let x = 0; x <= W; x += 8)
        ctx.lineTo(x, hz - a - Math.sin((x / W) * 6 + off * 10) * a * 0.5 - Math.sin((x / W) * 13 + k) * a * 0.25);
      ctx.lineTo(W, hz + 2);
      ctx.fill();
    });
    for (let i = 0; i < 8; i++) {
      const x = W * (0.58 + i * 0.025),
        y = hz - 8 - h1(i) * 5;
      ctx.fillStyle = mix('#333', '#f4efe4', d);
      ctx.fillRect(x, y, 8, 7);
      ctx.fillStyle = mix('#222', '#c3643a', d);
      ctx.fillRect(x - 1, y - 2, 10, 2);
    }
    ctx.fillStyle = mix('#333', '#f4efe4', d);
    ctx.fillRect(W * 0.56, hz - 22, 5, 14);
  } else if (r === 'al') {
    const peaks: [number, number][] = [
      [0, 0.55],
      [0.12, 0.95],
      [0.22, 0.6],
      [0.33, 1],
      [0.45, 0.7],
      [0.55, 0.92],
      [0.68, 0.6],
      [0.8, 0.85],
      [0.92, 0.5],
      [1, 0.7],
    ];
    const snow = q === 0 ? 0.55 : q === 3 ? 0.35 : 0.2;
    ctx.fillStyle = mix('#0e1520', '#6f7f94', d);
    ctx.beginPath();
    ctx.moveTo(0, hz + 2);
    peaks.forEach(([u, h]) => ctx.lineTo(u * W, hz - h * hz * 0.62));
    ctx.lineTo(W, hz + 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,20,40,.22)';
    for (let k = 1; k < peaks.length - 1; k++) {
      const [u, h] = peaks[k]!,
        [ur, hr] = peaks[k + 1]!;
      if (h < hr) continue;
      ctx.beginPath();
      ctx.moveTo(u * W, hz - h * hz * 0.62);
      ctx.lineTo(ur * W, hz - hr * hz * 0.62);
      ctx.lineTo(ur * W, hz + 2);
      ctx.lineTo(u * W + (ur - u) * W * 0.25, hz + 2);
      ctx.fill();
    }
    ctx.fillStyle = mix('#3a4150', '#f7fafc', d);
    for (let k = 1; k < peaks.length - 1; k++) {
      const [u, h] = peaks[k]!;
      if (h < 0.65) continue;
      const px = u * W,
        py = hz - h * hz * 0.62,
        s = h * hz * 0.62 * snow;
      const [ul] = peaks[k - 1]!,
        [ur] = peaks[k + 1]!;
      const lx = px + (ul * W - px) * (s / (h * hz * 0.62)),
        rx = px + (ur * W - px) * (s / (h * hz * 0.62));
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(rx, py + s);
      ctx.lineTo((px + rx) / 2, py + s * 0.8);
      ctx.lineTo(px, py + s);
      ctx.lineTo((px + lx) / 2, py + s * 0.85);
      ctx.lineTo(lx, py + s);
      ctx.fill();
    }
    ctx.fillStyle = mix('#0c1a14', q === 0 ? '#dfe7ea' : '#3f6b3e', d);
    ctx.beginPath();
    ctx.moveTo(0, hz + 2);
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, hz - 8 - Math.sin((x / W) * 9) * 6);
    ctx.lineTo(W, hz + 2);
    ctx.fill();
    ctx.fillStyle = mix('#0a1b2c', '#5aa0c8', d);
    ctx.beginPath();
    ctx.ellipse(W * 0.22, hz + 3, W * 0.12, 5, 0, 0, 7);
    ctx.fill();
  }
}
function miniTurbine(ctx: Ctx, x: number, y: number, h: number, a: number, d: number, lights: Light[]): void {
  ctx.strokeStyle = mix('#3a4150', '#f4f6f5', d);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h);
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    const b = a + k * 2.094;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + Math.cos(b) * h * 0.45, y - h + Math.sin(b) * h * 0.45);
    ctx.stroke();
  }
  lights.push([x, y - h - 1]);
}
function tree(ctx: Ctx, x: number, y: number, s: number, r: RegionKey, se: Season): void {
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.beginPath();
  ctx.ellipse(x + s * 0.4, y, s * 0.9, s * 0.3, 0, 0, 7);
  ctx.fill();
  if (r === 'al') {
    ctx.fillStyle = se.snow ? '#3d5a48' : '#2e5a3a';
    ctx.beginPath();
    ctx.moveTo(x, y - s * 3);
    ctx.lineTo(x + s, y - s * 0.2);
    ctx.lineTo(x - s, y - s * 0.2);
    ctx.fill();
    if (se.snow) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(x, y - s * 3);
      ctx.lineTo(x + s * 0.4, y - s * 1.8);
      ctx.lineTo(x - s * 0.4, y - s * 1.8);
      ctx.fill();
    }
    return;
  }
  ctx.fillStyle = '#5b4632';
  ctx.fillRect(x - s * 0.12, y - s * 1.2, s * 0.24, s * 1.2);
  ctx.fillStyle = r === 'ib' ? '#6f7d45' : se.tree;
  ctx.beginPath();
  ctx.arc(x, y - s * 1.5, s * (r === 'ib' ? 0.8 : 1), 0, 7);
  ctx.fill();
  if (se.snow) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath();
    ctx.arc(x, y - s * 2, s * 0.55, Math.PI, 0);
    ctx.fill();
  }
}

/** The ground below the horizon: animated sea, or fields with farm tracks and trees at the edges. */
export function drawGround(fr: Frame): void {
  const { ctx, W, H, r, mini, q, se, g, t, d, low, wf, F, L } = fr,
    hz = g.hz;
  if (r === 'ns') {
    const wg = ctx.createLinearGradient(0, hz, 0, H);
    wg.addColorStop(0, mix('#0d2440', q === 0 ? '#7a98ab' : mix('#4a93c2', '#e0a070', low * 0.35), d));
    wg.addColorStop(1, mix('#061526', q === 0 ? '#34556b' : '#18577f', d));
    ctx.fillStyle = wg;
    ctx.fillRect(0, hz, W, H - hz);
    ctx.strokeStyle = `rgba(255,255,255,${0.12 + 0.15 * d})`;
    ctx.lineWidth = 1;
    for (let k = 0; k < 22; k++) {
      const y = hz + (H - hz) * Math.pow(k / 22, 1.4) + 2,
        amp = 1 + k * 0.12;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const yy = y + Math.sin(x / (18 + k * 2) + t * (1.2 + wf) + k) * amp;
        if (x) ctx.lineTo(x, yy);
        else ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }
  } else {
    const bg = ctx.createLinearGradient(0, hz, 0, H);
    bg.addColorStop(0, L(shade(F[0]!, 0.9)));
    bg.addColorStop(1, L(shade(F[0]!, 0.78)));
    ctx.fillStyle = bg;
    ctx.fillRect(0, hz, W, H - hz);
    // farm tracks
    const rc = L(ROAD[r]![q === 0 ? 1 : 0]),
      Y0 = g.Y[0]! - 2,
      Y4 = g.Y[4]!;
    ctx.fillStyle = rc;
    for (let k = 0; k <= 4; k++) {
      const u = k / 4,
        w = 0.012;
      ctx.beginPath();
      ctx.moveTo(g.X(u - w, Y0), Y0);
      ctx.lineTo(g.X(u + w, Y0), Y0);
      ctx.lineTo(g.X(u + w, Y4), Y4);
      ctx.lineTo(g.X(u - w, Y4), Y4);
      ctx.fill();
    }
    for (let k = 0; k <= 4; k++) {
      const y = g.Y[k]!;
      ctx.beginPath();
      ctx.moveTo(g.X(-0.012, y - 2.5), y - 2.5);
      ctx.lineTo(g.X(1.012, y - 2.5), y - 2.5);
      ctx.lineTo(g.X(1.012, y + 2), y + 2);
      ctx.lineTo(g.X(-0.012, y + 2), y + 2);
      ctx.fill();
    }
    if (!mini) {
      ctx.strokeStyle = 'rgba(60,40,20,.13)';
      ctx.lineWidth = 1;
      for (let k = 0; k <= 4; k++)
        for (const o of [-0.0045, 0.0045]) {
          const u = k / 4 + o;
          ctx.beginPath();
          ctx.moveTo(g.X(u, Y0), Y0);
          ctx.lineTo(g.X(u, Y4), Y4);
          ctx.stroke();
        }
    }
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1,
        yy = hz + (H - hz) * (0.04 + 0.94 * h1(i + 20)),
        edge = W / 2 + side * W * 0.47 * g.sc(yy),
        xx = edge + side * (8 + h1(i + 40) * (W / 2 - W * 0.47 * g.sc(yy) - 6));
      if (xx < -10 || xx > W + 10) continue;
      tree(ctx, xx, yy, Math.max(5, W * 0.018 * g.sc(yy)), r, se);
    }
  }
}
