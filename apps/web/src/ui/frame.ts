/** Page frame: top bar, tabs and the active view. */
import { esc, eur, money, qStr } from '../format.js';
import { playerColor } from '../players.js';
import { registerScenes } from '../scene/index.js';
import { SND } from '../sound.js';
import { $, S, UI } from '../state.js';
import { SEASON_NAME } from '../texts.js';
import { vBank } from './bank.js';
import { drawChart } from './chart.js';
import { LOGO, meP, todo, V } from './common.js';
import { ICON } from './icons.js';
import { vLobby } from './lobby.js';
import { vMarket } from './market.js';
import { vNews } from './news.js';
import { vOverview } from './overview.js';
import { vRivals } from './rivals.js';
import { vSites } from './sites.js';

const SPK_ON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>';
const SPK_OFF =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';

export function render(): void {
  if (!S.view) return;
  renderTop();
  renderTabs();
  renderView();
}
export function renderTop(): void {
  const v = V(),
    P = meP(),
    ph = v.market.priceHist,
    d = ph.length > 1 ? ph[ph.length - 1]! - ph[ph.length - 2]! : 0;
  $('#top')!.innerHTML = `
    <div class="brand"><b>${LOGO}Wattmogul</b><span><i class="dot" style="--oc:${playerColor(0)}"></i>${esc(P.name)}</span></div>
    <div class="stats">
      <div class="stat"><span class="label">Quartal</span><span class="v">${qStr(v.year, v.q)} <span class="season s${v.q}">${SEASON_NAME[v.q]}</span></span></div>
      <div class="stat"><span class="label">Kasse</span><span class="v ${P.cash < 0 ? 'down' : ''}">${money(P.cash)}</span></div>
      <div class="stat"><span class="label">Kredit</span><span class="v">${money(P.loan)}</span></div>
      <div class="stat"><span class="label">Strompreis</span><span class="v">${eur(v.market.price)} <span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'}${Math.abs(d)}</span></span></div>
      <div class="stat"><span class="label">Rang</span><span class="v">${v.me.rank} von ${v.players.filter((p) => !p.out).length}</span></div>
    </div>
    <div class="row" style="flex-wrap:nowrap"><button class="btn icon" data-act="sound" aria-label="Ton ${SND.on ? 'aus' : 'an'}schalten" title="Ton ${SND.on ? 'aus' : 'an'}">${SND.on ? SPK_ON : SPK_OFF}</button>
    ${v.over ? '<button class="btn primary big endq" data-act="newGameDlg">Neues Spiel</button>' : `<button class="btn primary big endq" data-act="endQuarter" ${S.busy ? 'disabled' : ''}>Quartal beenden →</button>`}</div>`;
}
const TABS = [
  ['overview', 'Übersicht'],
  ['sites', 'Standorte'],
  ['market', 'Strommarkt'],
  ['bank', 'Bank'],
  ['lobby', 'Lobby & Tricks'],
  ['rivals', 'Konkurrenz'],
  ['news', 'Nachrichten'],
] as const;
function renderTabs(): void {
  const n = todo().length;
  $('#tabs')!.innerHTML = TABS.map(
    ([k, l]) =>
      `<button class="tab" role="tab" aria-selected="${UI.tab === k}" data-act="tab" data-v="${k}">${ICON[k]}<span>${l}</span>${k === 'overview' && n ? ` <span class="badge">${n}</span>` : ''}</button>`,
  ).join('');
}
const VIEWS: Record<string, () => string> = {
  overview: vOverview,
  sites: vSites,
  market: vMarket,
  bank: vBank,
  lobby: vLobby,
  rivals: vRivals,
  news: vNews,
};
function renderView(): void {
  const el = $('#view')!;
  el.innerHTML = (VIEWS[UI.tab] ?? vOverview)();
  el.querySelectorAll<HTMLElement>('[data-chart]').forEach(drawChart);
  registerScenes();
}
export function redrawCharts(): void {
  $('#view')?.querySelectorAll<HTMLElement>('[data-chart]').forEach(drawChart);
}
