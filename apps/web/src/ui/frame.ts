/**
 * Page frame: top bar, and the main view. On desktop the main view is the office and every area opens as the
 * object it lives in (see `devices.ts`); on a phone the areas are tabs and the office is the head of the first one.
 */
import { esc, eur, money, qStr } from '../format.js';
import { registerScenes, swapKeepingScenes } from '../scene/index.js';
import { PHONE_TIME, resizeOffice } from '../scene/office.js';
import { SND } from '../sound.js';
import { $, isPhone, S, UI } from '../state.js';
import { HQ_TEXT, SEASON_NAME } from '../texts.js';
import { vBank } from './bank.js';
import { vAwards, vBoard, vDecision } from './board.js';
import { drawChart } from './chart.js';
import { LOGO, meP, todo, V } from './common.js';
import { crest } from './companies.js';
import { deviceHead, deviceHtml, deviceTitle, sameKind, stopClosing, swapIn, zoomIn, zoomOut } from './devices.js';
import { ICON } from './icons.js';
import { vLobby } from './lobby.js';
import { vMarket } from './market.js';
import { vNews } from './news.js';
import { boardTalk, mountOffice, officeScene, vOffice } from './office.js';
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
  const alive = v.players.filter((p) => !p.out).length;
  $('#top')!.innerHTML = `
    <div class="hq">${crest(0, 38)}<div class="hq-name"><span class="game">${LOGO}Wattmogul · ${HQ_TEXT[v.me.hq].name}</span><b>${esc(P.name)}</b></div></div>
    <div class="stats">
      <div class="stat cal"><span class="label">Quartal</span><span class="v">${qStr(v.year, v.q)} <span class="season s${v.q}">${SEASON_NAME[v.q]}</span></span></div>
      <button class="stat res linkstat" data-act="tab" data-v="bank" title="Bank öffnen"><i class="tok coin" aria-hidden="true">€</i><span><span class="label">Kasse</span><span class="v ${P.cash < 0 ? 'down' : ''}">${money(P.cash)}</span></span></button>
      <div class="stat res"><i class="tok debt" aria-hidden="true">%</i><span><span class="label">Kredit</span><span class="v">${money(P.loan)}</span></span></div>
      <div class="stat res"><i class="tok volt" aria-hidden="true">⚡</i><span><span class="label">Strompreis</span><span class="v">${eur(v.market.price)} <span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'}${Math.abs(d)}</span></span></span></div>
      <div class="stat rank r${v.me.rank}"><i class="ribbon" aria-hidden="true">${v.me.rank}</i><span><span class="label">Rang</span><span class="v">${v.me.rank} von ${alive}</span></span></div>
    </div>
    <div class="row" style="flex-wrap:nowrap"><button class="btn icon" data-act="sound" aria-label="Ton ${SND.on ? 'aus' : 'an'}schalten" title="Ton ${SND.on ? 'aus' : 'an'}">${SND.on ? SPK_ON : SPK_OFF}</button>
    ${v.over ? '<button class="btn primary big endq" data-act="newGameDlg">Neues Spiel</button>' : `<button class="btn primary big endq" data-act="endQuarter" ${S.busy ? 'disabled' : ''}>Quartal beenden →</button>`}</div>`;
}

/** Phone tabs: area key and label. */
const AREAS = [
  ['overview', 'Büro'],
  ['sites', 'Standorte'],
  ['market', 'Markt'],
  ['bank', 'Bank'],
  ['board', 'Vorstand'],
  ['lobby', 'Lobby'],
  ['rivals', 'Konkurrenz'],
  ['awards', 'Pokale'],
  ['news', 'Zeitung'],
] as const;

function renderTabs(): void {
  const n = todo().length + (V().me.decision ? 1 : 0);
  $('#tabs')!.innerHTML = isPhone()
    ? AREAS.map(
        ([k, l]) =>
          `<button class="tab" role="tab" aria-selected="${UI.tab === k}" data-act="tab" data-v="${k}">${ICON[k]}<span>${l}</span>${k === 'overview' && n ? ` <span class="badge">${n}</span>` : ''}</button>`,
      ).join('')
    : '';
}

const VIEWS: Record<string, () => string> = {
  overview: vOverview,
  sites: vSites,
  market: vMarket,
  bank: vBank,
  board: vBoard,
  lobby: vLobby,
  rivals: vRivals,
  awards: vAwards,
  news: vNews,
  decision: vDecision,
};

/** Phone: the first tab is the office with the board's speech bubbles, then the overview. */
const vPhoneOffice = (): string =>
  `<div class="stack" style="gap:14px"><div class="office-wrap">${officeScene()}</div>${boardTalk(4)}${vOverview()}</div>`;

let shownTab = '';
let shownFolder: string | null = null;
let phoneLayout: boolean | null = null;

function renderView(): void {
  const el = $('#view')!,
    phone = isPhone();
  if (phone !== phoneLayout) {
    phoneLayout = phone;
    shownTab = '';
    shownFolder = null;
  }
  document.body.classList.toggle('desk', !phone);
  if (phone) {
    UI.folder = null;
    el.classList.toggle('enter', UI.tab !== shownTab);
    shownTab = UI.tab;
    swapKeepingScenes(el, UI.tab === 'overview' ? vPhoneOffice() : (VIEWS[UI.tab] ?? vOverview)());
  } else if (shownTab !== 'office') {
    shownTab = 'office';
    el.classList.remove('enter');
    swapKeepingScenes(el, vOffice());
  } else {
    // keep the office canvas: only the hotspots and bubbles change
    const wrap = el.querySelector('.office-wrap')!;
    const cv = wrap.querySelector('canvas[data-office]');
    wrap.innerHTML = vOffice().replace(/^<div class="office-wrap">|<\/div>$/g, '');
    if (cv) wrap.querySelector('canvas[data-office]')?.replaceWith(cv);
  }
  renderFolder(phone);
  mountOffice();
  document.querySelectorAll<HTMLElement>('[data-chart]').forEach(drawChart);
  registerScenes();
}

/** Desktop: the opened object (laptop, phone, newspaper, …) in front of the office, with a back button. */
function renderFolder(phone: boolean): void {
  const layer = $('#folder')!;
  const k = phone ? null : UI.folder;
  if (!k) {
    if (shownFolder === null) return;
    const was = shownFolder;
    shownFolder = null;
    const hide = () => {
      layer.hidden = true;
      layer.innerHTML = '';
    };
    if (phone) {
      stopClosing();
      hide();
    } else zoomOut(was, layer, hide);
    return;
  }
  const time = PHONE_TIME[V().q]!;
  const sheet = layer.querySelector<HTMLElement>('.sheet');
  if (sheet && shownFolder !== null && sameKind(shownFolder, k)) {
    // the object stays: swap the content, keep the landscape canvases (and the scroll position on a re-render)
    const scroll = shownFolder === k ? sheet.scrollTop : 0;
    const dev = layer.querySelector<HTMLElement>('.dev')!;
    if (shownFolder !== k) {
      dev.dataset.area = k;
      dev.setAttribute('aria-label', deviceTitle(k));
      dev.querySelector('.dhead')!.outerHTML = deviceHead(k);
    }
    swapKeepingScenes(sheet, (VIEWS[k] ?? vOverview)());
    sheet.scrollTop = scroll;
  } else {
    const opening = shownFolder === null;
    if (opening) stopClosing();
    layer.innerHTML = deviceHtml(k, (VIEWS[k] ?? vOverview)(), time);
    layer.hidden = false;
    const dev = layer.querySelector<HTMLElement>('.dev')!;
    if (opening) zoomIn(k, layer, dev);
    else swapIn(dev);
    layer.querySelector<HTMLElement>('.sheet')?.focus({ preventScroll: true });
    SND.paper();
  }
  shownFolder = k;
}

export function redrawCharts(): void {
  document.querySelectorAll<HTMLElement>('[data-chart]').forEach(drawChart);
  resizeOffice();
}
