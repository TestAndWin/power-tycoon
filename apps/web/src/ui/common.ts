/** Helpers shared by the views: current view, site status and buttons driven by the engine's action options. */
import type { Action, ActionOption, PlayerSummary, PlayerView, SiteView } from '@power-tycoon/engine';
import { money } from '../format.js';
import { S, UI } from '../state.js';
import { siteName, siteStatusText, TODO_TEXT, type SiteStatusCode } from '../texts.js';

export const V = (): PlayerView => S.view!;
export const meP = (): PlayerSummary => V().players[V().playerId]!;
export const shortName = (p: PlayerSummary): string => (p.human ? 'Du' : p.name.split(' ')[0]!);

export const LOGO =
  '<svg class="logo" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><g class="rotor"><path d="M12 12V2M12 12l-8.7 5M12 12l8.7 5" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/></g><circle cx="12" cy="12" r="2.4" fill="var(--sun)"/></svg>';

/* ---------- site status ---------- */

type Kind = '' | 'warn' | 'bad' | 'good';
const STATUS_KIND: Record<SiteStatusCode, Kind> = {
  free: '',
  leased: 'warn',
  permitPending: '',
  rejected: 'bad',
  assemblyFailed: 'bad',
  ready: 'warn',
  noGrid: 'warn',
  fault: 'bad',
  curtailed: 'warn',
  repowering: 'warn',
  operating: 'good',
};

function statusCode(x: SiteView): SiteStatusCode {
  if (x.owner < 0) return 'free';
  if (!x.type) return 'leased';
  if (x.permit === 'pending') return 'permitPending';
  if (x.permit === 'rejected') return 'rejected';
  if (!x.built) return x.fail ? 'assemblyFailed' : 'ready';
  if (!x.grid) return 'noGrid';
  if (x.fault) return 'fault';
  if (x.offline > 0) return 'repowering';
  if (x.curtail > 0) return 'curtailed';
  return 'operating';
}

/** Stage of a site with its German label and chip colour. */
export function siteStatus(x: SiteView): { code: SiteStatusCode; t: string; k: Kind } {
  const code = statusCode(x);
  return { code, t: siteStatusText(code, x), k: STATUS_KIND[code] };
}

/** Open tasks of the player ("Handlungsbedarf"). */
export function todo(): { x: SiteView; t: string; k: Kind }[] {
  const L: { x: SiteView; t: string; k: Kind }[] = [];
  for (const x of V().sites) {
    if (x.owner !== V().playerId) continue;
    const { code } = siteStatus(x);
    const t = TODO_TEXT[code];
    if (t) L.push({ x, t: siteName(x) + ': ' + t, k: code === 'fault' ? 'bad' : 'warn' });
  }
  return L;
}

/* ---------- action options ---------- */

const same = (a: Action, b: Action): boolean => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k as keyof Action] === b[k as keyof Action]);
};

/** The viewer's option for exactly this action; undefined if it does not apply now. */
export const optionFor = (a: Action): ActionOption | undefined => V().options.find((o) => same(o.action, a));

/** Options that concern one site, in the engine's order. */
export const siteOptions = (siteId: string): ActionOption[] =>
  V().options.filter((o) => 'siteId' in o.action && o.action.siteId === siteId);

/** Can the action be executed right now (applies, not blocked, no request running)? */
export const allowed = (a: Action): boolean => optionFor(a)?.error === null && !S.busy;

/**
 * Button for a site action. `price` is shown (negative = income); the button is disabled while the
 * option is blocked or a request runs. `confirm` asks once more before the action.
 */
export function btn(
  act: string,
  v: string,
  label: string,
  opt: ActionOption,
  o: { cls?: string; confirm?: boolean; price?: number } = {},
): string {
  const price = o.price ?? opt.cost,
    dis = opt.error !== null || S.busy,
    key = act + ':' + v;
  if (o.confirm && UI.confirm === key)
    return `<button class="btn confirm" data-act="${act}" data-v="${v}" data-ok="1">Wirklich? Bestätigen</button>`;
  return `<button class="btn ${o.cls || ''}" data-act="${act}" data-v="${v}" ${dis ? 'disabled' : ''}><span>${label}</span>${price ? `<small>${price > 0 ? money(price, true) : '+' + money(-price, true)}</small>` : ''}</button>`;
}

/**
 * Note under a button that is blocked by money: how much is missing and, if the credit line covers it, a
 * jump to the bank. Empty for other options.
 */
export function fundsHint(opt: ActionOption | undefined): string {
  if (!opt || opt.error !== 'insufficientFunds') return '';
  const v = V(),
    miss = opt.cost - v.me.cash,
    room = v.me.creditLimit - v.me.loan;
  return `<p class="hint">Es fehlen ${money(miss, true)}. ${
    room >= miss
      ? `<button class="btn small" data-act="tab" data-v="bank">Kredit aufnehmen <small>noch ${money(room, true)} frei</small></button>`
      : 'Auch der freie Kreditrahmen reicht nicht.'
  }</p>`;
}

/** `disabled` attribute for a fixed button whose action may currently be impossible. */
export const disabledUnless = (a: Action): string => (allowed(a) ? '' : 'disabled');
