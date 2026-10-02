/** Sky: gradient, stars, sun or moon, clouds and birds. */
import { h1, mix, rgba, shade } from './color.js';
import type { Cloud, Frame } from './frame.js';

/** Draws the sky above the horizon and returns this frame's clouds (for their shadows). */
export function drawSky(fr: Frame): Cloud[] {
  const { ctx, W, r, mini, still, q, se, g, t, p, e, d, low, hzc, wf } = fr,
    hz = g.hz,
    clouds: Cloud[] = [];
  const sg = ctx.createLinearGradient(0, 0, 0, hz);
  sg.addColorStop(0, mix('#040a1e', shade(se.sky[0], 0.78), d));
  sg.addColorStop(0.6, mix('#0d1838', mix(se.sky[0], '#c27a9c', low * 0.4), d));
  sg.addColorStop(1, mix('#2a3760', hzc, d));
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, hz + 2);
  if (d < 0.7) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = (0.7 - d) * (0.55 + 0.45 * Math.sin(t * 2 + i));
      ctx.fillRect(h1(i) * W, h1(i + 50) * hz * 0.92, 1.3, 1.3);
    }
    ctx.globalAlpha = 1;
  }
  if (p < 0.5) {
    const sx = W * (0.05 + 0.9 * (p / 0.5)),
      sy = hz * (1.05 - 0.9 * Math.max(0, e)),
      R = Math.max(8, W * 0.028) * (r === 'ib' ? 1.3 : 1);
    if (!mini && !still) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(t * 0.025);
      ctx.fillStyle = `rgba(255,240,205,${0.055 * d})`;
      for (let k = 0; k < 12; k++) {
        ctx.rotate(Math.PI / 6);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(W, -W * 0.045);
        ctx.lineTo(W, W * 0.045);
        ctx.fill();
      }
      ctx.restore();
    }
    if (low > 0) {
      const hg = ctx.createRadialGradient(sx, hz, 0, sx, hz, W * 0.55);
      hg.addColorStop(0, `rgba(255,160,80,${0.45 * low})`);
      hg.addColorStop(1, 'rgba(255,160,80,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, W, hz + 2);
    }
    const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 6);
    gl.addColorStop(0, 'rgba(255,238,180,.8)');
    gl.addColorStop(0.3, 'rgba(255,230,160,.25)');
    gl.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(sx - R * 6, sy - R * 6, R * 12, R * 12);
    const sd = ctx.createRadialGradient(sx - R * 0.3, sy - R * 0.3, 0, sx, sy, R);
    sd.addColorStop(0, '#fffbe8');
    sd.addColorStop(1, e < 0.25 ? '#ffa94d' : '#ffe98a');
    ctx.fillStyle = sd;
    ctx.beginPath();
    ctx.arc(sx, sy, R, 0, 7);
    ctx.fill();
  } else {
    const mp = (p - 0.5) / 0.5,
      mx = W * (0.05 + 0.9 * mp),
      my = hz * (1.05 - 0.8 * Math.sin(mp * Math.PI)),
      R = Math.max(6, W * 0.018);
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, R * 5);
    mg.addColorStop(0, 'rgba(200,215,255,.35)');
    mg.addColorStop(1, 'rgba(200,215,255,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(mx - R * 5, my - R * 5, R * 10, R * 10);
    ctx.fillStyle = '#eef1f7';
    ctx.beginPath();
    ctx.arc(mx, my, R, 0, 7);
    ctx.fill();
    ctx.fillStyle = mix('#08122b', se.sky[0], d);
    ctx.beginPath();
    ctx.arc(mx + R * 0.45, my - R * 0.2, R * 0.85, 0, 7);
    ctx.fill();
  }
  // clouds
  const grey = q === 0 || q === 3;
  for (let i = 0; i < se.cloud + (r === 'ns' ? 2 : 0); i++) {
    const sp = (6 + h1(i + 3) * 10) * wf,
      x = ((h1(i) * W * 1.4 + t * sp) % (W + 220)) - 110,
      y = hz * (0.12 + 0.55 * h1(i + 9)),
      s = W * (0.03 + 0.03 * h1(i + 4));
    clouds.push([x, s, i]);
    const cg = ctx.createLinearGradient(0, y - s * 1.3, 0, y + s);
    cg.addColorStop(0, grey ? mix('#8e9aa8', '#fbfcfd', d) : mix('#39466a', '#ffffff', d));
    cg.addColorStop(
      1,
      mix('#1a2340', grey ? mix('#aab4c0', '#e8b89a', low * 0.5) : mix('#cdd8e6', '#ffc59a', low * 0.7), d),
    );
    ctx.fillStyle = cg;
    ctx.globalAlpha = 0.96;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, 7);
    ctx.arc(x + s * 0.9, y + s * 0.2, s * 0.8, 0, 7);
    ctx.arc(x - s * 0.9, y + s * 0.25, s * 0.7, 0, 7);
    ctx.arc(x + s * 0.2, y - s * 0.45, s * 0.75, 0, 7);
    ctx.arc(x - s * 0.35, y - s * 0.3, s * 0.6, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // birds
  if (!mini && d > 0.35) {
    ctx.strokeStyle = rgba('#1d2430', 0.65 * d);
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const bx = ((h1(i + 60) * W + t * (16 + h1(i + 61) * 14)) % (W + 80)) - 40,
        by = hz * (0.22 + 0.4 * h1(i + 62)) + Math.sin(t * 0.8 + i) * 6,
        s = 3.5 + h1(i + 63) * 3,
        f = still ? s * 0.3 : Math.sin(t * 9 + i * 2) * s * 0.6;
      ctx.beginPath();
      ctx.moveTo(bx - s, by - f);
      ctx.quadraticCurveTo(bx - s * 0.4, by - Math.abs(f) * 0.3 - 1, bx, by);
      ctx.quadraticCurveTo(bx + s * 0.4, by - Math.abs(f) * 0.3 - 1, bx + s, by - f);
      ctx.stroke();
    }
  }
  return clouds;
}
