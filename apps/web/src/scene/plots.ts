/** The 16 plots of a region: field texture, ownership frames, hover and selection. */
import { h1, shade } from './color.js';
import { pathOf, type Frame, type Plot } from './frame.js';

/** Fields with furrows and a side edge (not offshore). */
export function drawFields(fr: Frame, plots: Plot[]): void {
  const { ctx, r, q, g, F, L } = fr;
  if (r !== 'ns')
    for (const { x, qd } of plots) {
      const P = qd.p,
        fc = F[Math.floor(h1(x.i + 7) * 3)]!,
        dep = Math.max(2, qd.bw * 0.03);
      ctx.fillStyle = L(shade(fc, 0.58));
      ctx.beginPath();
      ctx.moveTo(P[3]![0], P[3]![1]);
      ctx.lineTo(P[2]![0], P[2]![1]);
      ctx.lineTo(P[2]![0], P[2]![1] + dep);
      ctx.lineTo(P[3]![0], P[3]![1] + dep);
      ctx.closePath();
      ctx.fill();
      pathOf(ctx, P);
      ctx.fillStyle = L(fc);
      ctx.fill();
      ctx.save();
      ctx.clip();
      const n = q === 0 ? 0 : 9 + Math.floor(h1(x.i + 2) * 8);
      ctx.lineWidth = Math.max(1, qd.bw * 0.006);
      for (let k = 1; k < n; k++) {
        const u = qd.u0 + ((qd.u1 - qd.u0) * k) / n;
        ctx.strokeStyle = k % 2 ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.07)';
        ctx.beginPath();
        ctx.moveTo(g.X(u, qd.y0), qd.y0);
        ctx.lineTo(g.X(u, qd.y1), qd.y1);
        ctx.stroke();
      }
      const lg = ctx.createLinearGradient(0, qd.y0, 0, qd.y1);
      lg.addColorStop(0, 'rgba(255,255,255,.12)');
      lg.addColorStop(1, 'rgba(0,0,0,.08)');
      ctx.fillStyle = lg;
      ctx.fill();
      ctx.restore();
    }
}

/** Frames in the owner's colour (the player's own pulse), dashed outlines of free plots, hover and selection. */
export function drawPlotFrames(fr: Frame, plots: Plot[]): void {
  const { ctx, r, mini, still, t, colors, hover, selected } = fr;
  for (const { x, qd } of plots) {
    const P = qd.p,
      own = x.owner >= 0,
      oc = own ? colors[x.owner]! : '',
      lw = Math.max(1.5, qd.bw * 0.017);
    pathOf(ctx, P);
    if (own) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = oc;
      ctx.globalAlpha = r === 'ns' ? 0.2 : 0.12;
      ctx.fill();
      ctx.strokeStyle = oc;
      for (const [m, a] of [
        [14, 0.1],
        [8, 0.16],
        [4, 0.28],
      ] as const) {
        ctx.globalAlpha = a;
        ctx.lineWidth = lw * m;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = lw * 2 + 2.5;
      ctx.stroke();
      ctx.strokeStyle = oc;
      ctx.lineWidth = lw * 2;
      ctx.stroke();
      ctx.restore();
      if (x.owner === 0 && !mini && !still) {
        ctx.save();
        ctx.shadowColor = oc;
        ctx.shadowBlur = 9 + 6 * Math.sin(t * 2.4);
        ctx.strokeStyle = oc;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }
    } else {
      ctx.strokeStyle = r === 'ns' ? 'rgba(255,220,90,.55)' : 'rgba(255,255,255,.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (r === 'ns' && !own) {
      ctx.fillStyle = '#f2c230';
      P.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt[0], pt[1] + Math.sin(t * 2 + pt[0]) * 1.2, Math.max(1.5, qd.bw * 0.015), 0, 7);
        ctx.fill();
      });
    }
    if (!mini && hover === x.id) {
      pathOf(ctx, P);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,.13)';
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    if (!mini && selected === x.id) {
      pathOf(ctx, P);
      ctx.save();
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 6]);
      ctx.lineDashOffset = still ? 0 : -t * 24;
      ctx.stroke();
      ctx.restore();
    }
  }
}
