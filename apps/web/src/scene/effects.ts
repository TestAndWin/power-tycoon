/** Light and atmosphere: haze, texture, cloud shadows, weather, time of day, night lights, vignette. */
import { h1, rgba } from './color.js';
import { pathOf, type Cloud, type Frame, type Plot } from './frame.js';

/** Haze at the horizon. */
export function drawHaze(fr: Frame): void {
  const { ctx, W, H, g, d, hzc } = fr,
    hz = g.hz;
  const hg = ctx.createLinearGradient(0, hz - hz * 0.35, 0, hz + (H - hz) * 0.14);
  hg.addColorStop(0, rgba(hzc, 0));
  hg.addColorStop(0.72, rgba(hzc, 0.4 * d));
  hg.addColorStop(1, rgba(hzc, 0));
  ctx.fillStyle = hg;
  ctx.fillRect(0, hz - hz * 0.35, W, hz * 0.35 + (H - hz) * 0.14);
}

let NOISE: HTMLCanvasElement | null = null;
/** Grain texture for the ground (purely visual, not game randomness). */
export function noiseCanvas(): HTMLCanvasElement {
  if (NOISE) return NOISE;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!,
    im = x.createImageData(128, 128);
  for (let i = 0; i < im.data.length; i += 4) {
    const l = Math.random() > 0.5 ? 255 : 0;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = l;
    im.data[i + 3] = Math.random() * 20;
  }
  x.putImageData(im, 0, 0);
  return (NOISE = c);
}

export function drawTexture(fr: Frame, pattern: CanvasPattern | null): void {
  const { ctx, W, H, g } = fr,
    hz = g.hz;
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, hz, W, H - hz);
  }
}

export function drawCloudShadows(fr: Frame, clouds: Cloud[]): void {
  const { ctx, W, H, g, d } = fr,
    hz = g.hz;
  if (d > 0.2) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hz, W, H - hz);
    ctx.clip();
    for (const [cx, s, i] of clouds) {
      const gy = hz + (H - hz) * (0.15 + 0.75 * h1(i + 31)),
        rx = s * 4.2 * g.sc(gy),
        gx = cx + (gy - hz) * 0.15;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.scale(1, 0.3);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      rg.addColorStop(0, `rgba(12,22,34,${0.17 * d})`);
      rg.addColorStop(1, 'rgba(12,22,34,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

/** Atmosphere in front of the plots, weather and time-of-day light. */
export function drawAtmosphere(fr: Frame): void {
  const { ctx, W, H, r, mini, q, g, t, d, low, hzc, wf, L } = fr,
    hz = g.hz;
  // aerial perspective
  const ap = ctx.createLinearGradient(0, hz, 0, hz + (H - hz) * 0.45);
  ap.addColorStop(0, rgba(hzc, 0.3 * d));
  ap.addColorStop(1, rgba(hzc, 0));
  ctx.fillStyle = ap;
  ctx.fillRect(0, hz, W, (H - hz) * 0.45);
  // weather
  if (q === 0 && r !== 'ib') {
    const n = mini ? 25 : 80;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < n; i++) {
      const x = (h1(i) * W + Math.sin(t * 0.7 + i) * 12 + t * 8 * wf) % W,
        y = (h1(i + 100) * H + t * (14 + h1(i + 200) * 16)) % H,
        s = 0.8 + h1(i + 300) * 1.7;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, 7);
      ctx.fill();
    }
  } else if (q === 3 && r !== 'ns' && !mini) {
    const LC = ['#c8642a', '#e0a03a', '#a84a22'];
    for (let i = 0; i < 18; i++) {
      const x = ((h1(i) * W + t * (18 + h1(i + 5) * 18) * wf) % (W + 20)) - 10,
        y = (h1(i + 100) * H + t * (16 + h1(i + 9) * 12)) % H;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * (1 + h1(i + 7) * 2) + i);
      ctx.fillStyle = L(LC[i % 3]!);
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.2, 1.6, 0, 0, 7);
      ctx.fill();
      ctx.restore();
    }
  }
  // morning/evening mood
  if (low > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = `rgba(255,125,45,${0.75 * low})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // night
  if (d < 1) {
    ctx.fillStyle = `rgba(6,12,32,${(1 - d) * 0.5})`;
    ctx.fillRect(0, hz, W, H - hz);
  }
}

/** At night: lit crossings of the farm tracks and glowing ownership frames. */
export function drawNightLights(fr: Frame, plots: Plot[]): void {
  const { ctx, W, r, mini, g, d, colors } = fr;
  if (d < 0.9) {
    const n = 1 - d;
    if (r !== 'ns')
      for (let j = 0; j <= 4; j++)
        for (let k = 0; k <= 4; k++) {
          const y = g.Y[j]!,
            x = g.X(k / 4, y),
            rr = W * 0.018 * g.sc(y);
          const lg = ctx.createRadialGradient(x, y, 0, x, y, rr * 2.4);
          lg.addColorStop(0, `rgba(255,214,140,${0.55 * n})`);
          lg.addColorStop(1, 'rgba(255,214,140,0)');
          ctx.fillStyle = lg;
          ctx.fillRect(x - rr * 2.4, y - rr * 2.4, rr * 4.8, rr * 4.8);
          ctx.fillStyle = `rgba(255,238,200,${0.95 * n})`;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1, rr * 0.16), 0, 7);
          ctx.fill();
        }
    ctx.save();
    ctx.lineJoin = 'round';
    for (const { x, qd } of plots) {
      if (x.owner < 0) continue;
      const oc = colors[x.owner]!;
      pathOf(ctx, qd.p);
      ctx.shadowColor = oc;
      ctx.shadowBlur = mini ? 6 : 14;
      ctx.strokeStyle = rgba(oc, 0.95 * n);
      ctx.lineWidth = Math.max(1.5, qd.bw * 0.014);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * n})`;
      ctx.lineWidth = Math.max(0.6, qd.bw * 0.004);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawVignette(fr: Frame): void {
  const { ctx, W, H } = fr;
  const vg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.24)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

/** Blinking aviation lights collected while drawing. */
export function drawAviationLights(fr: Frame): void {
  const { ctx, still, t, d, lights } = fr;
  const on = still || Math.floor(t / 1.2) % 2 === 0;
  if (on && d < 0.85)
    lights.forEach(([lx, ly, c]) => {
      ctx.fillStyle = c || '#ff2a2a';
      ctx.shadowColor = c || '#ff2a2a';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(lx, ly, 1.8, 0, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
}
