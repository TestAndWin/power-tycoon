/**
 * Desktop: every area opens as the object it lives in on the office (laptop, exchange monitor, phone,
 * newspaper, map table, …). The camera zooms from the object in the office to the full-size object and back.
 */
import { esc } from '../format.js';
import { RMO } from '../state.js';

type Kind = 'laptop' | 'monitor' | 'phone' | 'paper' | 'table' | 'cork' | 'cabinet' | 'dossier' | 'backroom';

/** Which object shows an area, and the title on it. */
const DEVICE: Record<string, { kind: Kind; title: string; app?: string }> = {
  overview: { kind: 'laptop', title: 'Lagebericht', app: 'Konzern-Cockpit' },
  bank: { kind: 'laptop', title: 'Bank', app: 'Hausbank Online' },
  market: { kind: 'monitor', title: 'Strommarkt', app: 'Strombörse · Live' },
  decision: { kind: 'phone', title: 'Handy' },
  news: { kind: 'paper', title: 'Zeitung' },
  sites: { kind: 'table', title: 'Standorte' },
  rivals: { kind: 'cork', title: 'Konkurrenz' },
  awards: { kind: 'cabinet', title: 'Auszeichnungen' },
  board: { kind: 'dossier', title: 'Vorstand & Firmensitz' },
  lobby: { kind: 'backroom', title: 'Hinterzimmer' },
};

export const deviceTitle = (k: string): string => DEVICE[k]?.title ?? '';

const BACK = '<button class="btn small back" data-act="closeFolder">← Zurück</button>';

/** The header on the object: back button and title, styled per object. */
export function deviceHead(k: string): string {
  const d = DEVICE[k] ?? DEVICE.overview!;
  switch (d.kind) {
    case 'laptop':
    case 'monitor':
      return `<div class="dhead"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>${BACK}<h2>${esc(d.title)}</h2><span class="dapp">${esc(d.app ?? '')}</span></div>`;
    case 'phone':
      return `<div class="dhead">${BACK}<h2>${esc(d.title)}</h2></div>`;
    case 'paper':
      return `<div class="dhead">${BACK}</div>`;
    default:
      return `<div class="dhead">${BACK}<h2><span class="plate">${esc(d.title)}</span></h2></div>`;
  }
}

/** The full object around the content of area `k`; the content goes into `.sheet`. */
export function deviceHtml(k: string, content: string, time: string): string {
  const d = DEVICE[k] ?? DEVICE.overview!,
    kind = d.kind;
  const after =
    kind === 'laptop'
      ? '<div class="dbase" aria-hidden="true"><i></i></div>'
      : kind === 'monitor'
        ? '<div class="dstand" aria-hidden="true"><i></i><b></b></div>'
        : '';
  return `<div class="dev dev-${kind}" data-area="${k}" role="dialog" aria-modal="true" aria-label="${esc(d.title)}">
    <div class="dframe">${kind === 'phone' ? `<div class="pstatus" aria-hidden="true"><span>${esc(time)}</span><i class="notch"></i><span class="sig">▂▄▆ ▮</span></div>` : ''}${deviceHead(k)}<div class="sheet" tabindex="-1">${content}</div>${kind === 'phone' ? '<i class="home" aria-hidden="true"></i>' : ''}</div>${after}</div>`;
}

/** Same object for both areas: the shell can stay, only the content and the header change. */
export const sameKind = (a: string, b: string): boolean => DEVICE[a]?.kind === DEVICE[b]?.kind;

/* ---------- camera ---------- */

const EASE = 'cubic-bezier(0.22, 0.8, 0.25, 1)';
const DUR = 520;
const DIM = 'rgba(42, 32, 22, 0.55)';
let officeAnim: Animation | null = null;
let closing: { anims: Animation[]; done: () => void } | null = null;

/** Rectangle of the object in the office, if the office is on screen. */
function spot(k: string): DOMRect | null {
  const el = document.querySelector<HTMLElement>(`#view .hot[data-v="${k}"]`);
  const r = el?.getBoundingClientRect();
  return r && r.width > 0 && r.bottom > 0 && r.top < innerHeight ? r : null;
}

/** Transform that puts `to` onto `from` (same centre, uniform scale). */
function onto(from: DOMRect, to: DOMRect): string {
  const s = Math.max(from.width / to.width, from.height / to.height, 0.05);
  const dx = from.left + from.width / 2 - (to.left + to.width / 2),
    dy = from.top + from.height / 2 - (to.top + to.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${s})`;
}

/** The office leans towards the object: zoomed around its centre and blurred. */
function officeZoom(from: DOMRect): { wrap: HTMLElement; frames: Keyframe[] } | null {
  const wrap = document.querySelector<HTMLElement>('#view .office-wrap');
  if (!wrap) return null;
  const w = wrap.getBoundingClientRect();
  wrap.style.transformOrigin = `${from.left + from.width / 2 - w.left}px ${from.top + from.height / 2 - w.top}px`;
  return {
    wrap,
    frames: [
      { transform: 'none', filter: 'none' },
      { transform: 'scale(1.9)', filter: 'blur(4px)' },
    ],
  };
}

/** Stops a running zoom-out at once (the layer is reused for the next object). */
export function stopClosing(): void {
  if (!closing) return;
  const c = closing;
  closing = null;
  c.anims.forEach((a) => a.cancel());
}

/** Zoom from the object in the office into the opened object `dev`. */
export function zoomIn(k: string, layer: HTMLElement, dev: HTMLElement): void {
  stopClosing();
  if (RMO) return;
  const from = spot(k);
  if (!from) {
    dev.animate(
      [
        { opacity: 0, transform: 'translateY(30px)' },
        { opacity: 1, transform: 'none' },
      ],
      {
        duration: 300,
        easing: EASE,
      },
    );
    return;
  }
  document.body.classList.add('zoom');
  dev.animate(
    [
      { transform: onto(from, dev.getBoundingClientRect()), opacity: 0.2 },
      { opacity: 1, offset: 0.4 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: DUR, easing: EASE },
  );
  layer.animate([{ backgroundColor: 'rgba(42, 32, 22, 0)' }, { backgroundColor: DIM }], {
    duration: DUR,
    easing: EASE,
  });
  const oz = officeZoom(from);
  officeAnim?.cancel();
  officeAnim = oz ? oz.wrap.animate(oz.frames, { duration: DUR, easing: EASE, fill: 'forwards' }) : null;
}

/** Zoom back out of the object; `done` hides the layer afterwards. */
export function zoomOut(k: string, layer: HTMLElement, done: () => void): void {
  stopClosing();
  const dev = layer.querySelector<HTMLElement>('.dev');
  const from = spot(k);
  const reset = () => {
    officeAnim?.cancel();
    officeAnim = null;
    document.body.classList.remove('zoom');
  };
  if (RMO || !dev || !from) {
    reset();
    done();
    return;
  }
  const anims = [
    dev.animate(
      [
        { transform: 'none', opacity: 1 },
        { opacity: 1, offset: 0.6 },
        { transform: onto(from, dev.getBoundingClientRect()), opacity: 0 },
      ],
      { duration: DUR - 80, easing: EASE, fill: 'forwards' },
    ),
    layer.animate([{ backgroundColor: DIM }, { backgroundColor: 'rgba(42, 32, 22, 0)' }], {
      duration: DUR - 80,
      easing: EASE,
      fill: 'forwards',
    }),
  ];
  const oz = officeZoom(from);
  officeAnim?.cancel();
  officeAnim = null;
  if (oz) anims.push(oz.wrap.animate([...oz.frames].reverse(), { duration: DUR - 80, easing: EASE }));
  const c = {
    anims,
    done: () => {
      if (closing !== c) return;
      closing = null;
      anims.forEach((a) => a.cancel());
      reset();
      done();
    },
  };
  closing = c;
  void anims[0]!.finished.then(c.done, () => {});
}

/** Switching from one object to another while zoomed in: a short swap. */
export function swapIn(dev: HTMLElement): void {
  if (RMO) return;
  dev.animate(
    [
      { opacity: 0, transform: 'scale(0.96) translateY(14px)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 260, easing: EASE },
  );
}
