/** SVG line charts (net worth, price and spread) with a hover tooltip. */
import { clamp } from '@power-tycoon/engine';
import { esc, eur, money, quarterLabel } from '../format.js';
import { playerColor } from '../players.js';
import { V } from './common.js';

interface Series {
  name: string;
  color: string;
  vals: (number | null)[];
  fmt: (v: number) => string;
}
export function drawChart(el: HTMLElement): void {
  const v = V();
  const type = el.dataset.chart;
  let series: Series[];
  if (type === 'price')
    series = [
      { name: 'Strompreis', color: 'var(--c0)', vals: v.market.priceHist, fmt: (x) => eur(x) },
      { name: 'Speicher-Spread', color: 'var(--c3)', vals: v.market.spreadHist, fmt: (x) => eur(x) },
    ];
  else series = v.players.map((p) => ({ name: p.name, color: playerColor(p.id), vals: p.hist, fmt: (x) => money(x) }));
  const labels = v.market.priceHist.map((_, i) => quarterLabel(v.startYear, i)),
    Wd = Math.max(280, el.clientWidth || 600),
    Ht = type === 'price' ? 180 : 230,
    ml = 58,
    mr = 100,
    mt = 10,
    mb = 24,
    n = labels.length;
  const all = series.flatMap((s) => s.vals.filter((x): x is number => x != null));
  let lo = Math.min(0, ...all),
    hi = Math.max(...all, 1);
  const step = niceStep((hi - lo) / 4);
  hi = Math.ceil(hi / step) * step;
  lo = Math.floor(lo / step) * step;
  const X = (i: number) => ml + (n <= 1 ? 0 : i / (n - 1)) * (Wd - ml - mr),
    Y = (x: number) => mt + (1 - (x - lo) / (hi - lo)) * (Ht - mt - mb);
  let s = `<svg viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="${type === 'price' ? 'Strompreis und Speicher-Spread' : 'Nettovermögen'}">`;
  for (let x = lo; x <= hi + 1e-9; x += step)
    s += `<line class="gridl" x1="${ml}" x2="${Wd - mr}" y1="${Y(x)}" y2="${Y(x)}"/><text class="axis" x="${ml - 6}" y="${Y(x) + 4}" text-anchor="end">${type === 'price' ? Math.round(x) + ' €' : axisMoney(x)}</text>`;
  const every = Math.max(1, Math.ceil(n / 6));
  labels.forEach((l, i) => {
    if (i % every === 0) s += `<text class="axis" x="${X(i)}" y="${Ht - 6}" text-anchor="middle">${l}</text>`;
  });
  {
    const se = series[0]!,
      pts = se.vals.map((x, i) => (x == null ? null : [X(i), Y(x)])).filter((p): p is number[] => !!p);
    if (pts.length > 1) {
      const gid = 'ag' + type;
      s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${se.color};stop-opacity:.22"/><stop offset="1" style="stop-color:${se.color};stop-opacity:0"/></linearGradient></defs><path d="M${pts[0]![0]} ${Y(Math.max(lo, 0))}${pts.map((p) => 'L' + p[0]!.toFixed(1) + ' ' + p[1]!.toFixed(1)).join('')}L${pts[pts.length - 1]![0]} ${Y(Math.max(lo, 0))}Z" fill="url(#${gid})"/>`;
    }
  }
  series.forEach((se) => {
    let d = '',
      pen = false;
    se.vals.forEach((x, i) => {
      if (x == null) {
        pen = false;
        return;
      }
      d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x).toFixed(1);
      pen = true;
    });
    s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se === series[0] ? 2.6 : 2}" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  const ends = series
    .map((se) => ({ se, i: se.vals.length - 1, v: se.vals[se.vals.length - 1] }))
    .filter((e): e is { se: Series; i: number; v: number } => e.v != null);
  const ly = ends.map((e) => ({ e, y: Y(e.v) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ly.length; k++) if (ly[k]!.y - ly[k - 1]!.y < 13) ly[k]!.y = ly[k - 1]!.y + 13;
  if (n <= 1)
    s += `<text class="empty" x="${(ml + Wd - mr) / 2}" y="${(mt + Ht - mb) / 2}" text-anchor="middle">Der Verlauf erscheint ab dem zweiten Quartal</text>`;
  else
    ly.forEach(({ e, y }) => {
      s += `<circle cx="${X(e.i)}" cy="${Y(e.v)}" r="4" fill="${e.se.color}" stroke="var(--surface)" stroke-width="2"/><text x="${X(e.i) + 8}" y="${y + 4}" font-size="11" fill="var(--muted)" font-family="var(--sans)">${esc(e.se.name.split(' ')[0])}</text>`;
    });
  s += `<line id="xh" x1="0" x2="0" y1="${mt}" y2="${Ht - mb}" stroke="var(--muted)" stroke-dasharray="3 3" visibility="hidden"/></svg>`;
  const legend = `<div class="legend">${series.map((se) => `<span><i class="dot" style="--oc:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>`;
  el.innerHTML = legend + s + '<div class="tip" hidden></div>';
  const svg = el.querySelector('svg')!,
    tip = el.querySelector<HTMLElement>('.tip')!,
    xh = svg.querySelector('#xh')!;
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect(),
      sx = ((e.clientX - r.left) / r.width) * Wd,
      i = clamp(Math.round(((sx - ml) / (Wd - ml - mr)) * (n - 1)), 0, n - 1);
    xh.setAttribute('x1', String(X(i)));
    xh.setAttribute('x2', String(X(i)));
    xh.setAttribute('visibility', 'visible');
    tip.innerHTML =
      `<b>${labels[i]}</b>` +
      series
        .filter((se) => se.vals[i] != null)
        .sort((a, b) => b.vals[i]! - a.vals[i]!)
        .map(
          (se) =>
            `<div><span class="row" style="gap:6px"><i class="dot" style="--oc:${se.color}"></i>${esc(se.name)}</span><span class="mono">${se.fmt(se.vals[i]!)}</span></div>`,
        )
        .join('');
    tip.hidden = false;
    tip.style.left = Math.max(0, Math.min((X(i) / Wd) * r.width + 12, r.width - tip.offsetWidth)) + 'px';
    tip.style.top = '24px';
  });
  svg.addEventListener('pointerleave', () => {
    tip.hidden = true;
    xh.setAttribute('visibility', 'hidden');
  });
}
function niceStep(r: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(r || 1)));
  const f = r / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
function axisMoney(x: number): string {
  const a = Math.abs(x);
  return a >= 1e9
    ? (x / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mrd'
    : a >= 1e6
      ? Math.round(x / 1e6) + ' Mio'
      : a >= 1e3
        ? Math.round(x / 1e3) + ' T'
        : String(x);
}
