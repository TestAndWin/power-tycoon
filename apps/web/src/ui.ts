/** Render functions ported from legacy/src/ui.js; they read the PlayerView instead of `G`. */
import {
  GAME_YEARS,
  PLANTS,
  REGION_KEYS,
  REGIONS,
  TRICK_KEYS,
  type Difficulty,
  type PlayerSummary,
  type PlayerView,
  type QuarterReport,
  type RegionKey,
  type RivalActionLog,
  type SiteView,
} from '@power-tycoon/engine';
import { clamp, esc, eur, money, mwh, QN, qStr, quarterLabel, tons } from './format.js';
import { closeModal, openModal } from './modal.js';
import { geo, mono, quad, registerScenes, SEAS } from './scene.js';
import { SND } from './sound.js';
import { $, RMO, S, UI } from './state.js';
import {
  newsTexts,
  PLANT_NAME,
  REGION_TEXT,
  reportEventText,
  reportLineText,
  rivalActionText,
  siteName,
  siteQuality,
  DIFFICULTY_TEXT,
  TRICK_TEXT,
  type NewsKind,
} from './texts.js';

const pc = (id: number) => `var(--c${id})`;
const V = (): PlayerView => S.view!;
const meP = (): PlayerSummary => V().players[V().playerId]!;
const shortName = (p: PlayerSummary) => (p.human ? 'Du' : p.name.split(' ')[0]!);
const operating = (x: SiteView) => x.owner >= 0 && x.built && x.grid;
const isStoreT = (t: string | null) => !!t && PLANTS[t as keyof typeof PLANTS].cls === 'store';

export const LOGO =
  '<svg class="logo" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><g class="rotor"><path d="M12 12V2M12 12l-8.7 5M12 12l8.7 5" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/></g><circle cx="12" cy="12" r="2.4" fill="var(--sun)"/></svg>';
const SPK_ON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>';
const SPK_OFF =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';

/* ---------- site status ---------- */
export function siteStatus(x: SiteView): { t: string; k: string } {
  if (x.owner < 0) return { t: 'Frei', k: '' };
  if (!x.type) return { t: 'Gepachtet', k: 'warn' };
  if (x.permit === 'pending')
    return { t: x.own ? 'Genehmigung · ' + Math.max(1, x.own.permitLeft) + ' Q' : 'Genehmigung läuft', k: '' };
  if (x.permit === 'rejected') return { t: 'Abgelehnt', k: 'bad' };
  if (!x.built) return x.fail ? { t: 'Montage abgebrochen', k: 'bad' } : { t: 'Baureif', k: 'warn' };
  if (!x.grid) return { t: 'Netzanschluss fehlt', k: 'warn' };
  if (x.fault) return { t: 'Störung!', k: 'bad' };
  if (x.curtail > 0) return { t: 'Auflage −50 %', k: 'warn' };
  return { t: 'In Betrieb', k: 'good' };
}
function todo(): { x: SiteView; t: string; k: string }[] {
  const L: { x: SiteView; t: string; k: string }[] = [];
  V()
    .sites.filter((x) => x.owner === V().playerId)
    .forEach((x) => {
      const s = siteStatus(x).t;
      const n = siteName(x);
      if (x.fault && x.built && x.grid) L.push({ x, t: n + ': Störung beheben', k: 'bad' });
      else if (s === 'Gepachtet') L.push({ x, t: n + ': Genehmigung beantragen', k: 'warn' });
      else if (s === 'Abgelehnt') L.push({ x, t: n + ': Genehmigung abgelehnt', k: 'warn' });
      else if (s === 'Baureif') L.push({ x, t: n + ': bauen', k: 'warn' });
      else if (s === 'Montage abgebrochen') L.push({ x, t: n + ': Montage wiederholen', k: 'warn' });
      else if (s === 'Netzanschluss fehlt') L.push({ x, t: n + ': ans Netz anschließen', k: 'warn' });
    });
  return L;
}

/* ---------- frame ---------- */
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
    <div class="brand"><b>${LOGO}Wattmogul</b><span><i class="dot" style="--oc:${pc(0)}"></i>${esc(P.name)}</span></div>
    <div class="stats">
      <div class="stat"><span class="label">Quartal</span><span class="v">${qStr(v.year, v.q)} <span class="season s${v.q}">${SEAS[v.q]!.name}</span></span></div>
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
      `<button class="tab" role="tab" aria-selected="${UI.tab === k}" data-act="tab" data-v="${k}">${l}${k === 'overview' && n ? ` <span class="badge">${n}</span>` : ''}</button>`,
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

/* ---------- overview ---------- */
function vOverview(): string {
  const v = V(),
    P = meP(),
    T = todo(),
    mine = v.sites.filter((x) => x.owner === v.playerId);
  const minis = REGION_KEYS.map((r) => {
    const m = v.sites.filter((x) => x.r === r && x.owner === v.playerId),
      mw2 = m.filter(operating).reduce((a, x) => a + PLANTS[x.type!].mw, 0);
    return `<button class="mini" data-act="goRegion" data-v="${r}"><canvas data-scene="${r}" data-mini="1"></canvas><span class="mcap"><b>${REGION_TEXT[r].name}</b><span>${m.length ? m.length + ' Fläche' + (m.length > 1 ? 'n' : '') + ' · ' + mw2 + ' MW' : 'noch nicht vertreten'}</span>${ownBar(r)}</span></button>`;
  }).join('');
  const news = newsList().slice(0, 4);
  return `<div class="stack" style="gap:14px">
  <div class="minis">${minis}</div>
  <div class="tiles">
    <div class="tile"><span class="label">Nettovermögen</span><span class="big">${money(P.worth)}</span><span class="muted">Rang ${v.me.rank} · noch ${v.quartersLeft} Quartale bis Ende ${v.endYear - 1}</span></div>
    <div class="tile"><span class="label">Installierte Leistung</span><span class="big">${v.me.mw.toLocaleString('de-DE')} MW</span><span class="muted">${mine.filter(operating).length} Anlagen am Netz</span></div>
    <div class="tile"><span class="label">Erzeugung ${QN[v.q]}</span><span class="big">${mwh(v.me.nextGen)}</span><span class="muted">Prognose ohne Wetterereignisse</span></div>
    <div class="tile"><span class="label">CO₂ vermieden</span><span class="big co2">${tons(v.me.co2)}</span><span class="muted">gegenüber Kohle- und Gasstrom</span></div>
  </div>
  <div class="grid g2">
    <section class="panel"><div class="phead"><h3>Nettovermögen der Konzerne</h3><span class="muted">quartalsweise</span></div><div class="chart" data-chart="worth"></div></section>
    <section class="panel"><div class="phead"><h3>Handlungsbedarf</h3></div>
      ${T.length ? `<ul class="list">${T.map((o) => `<li><span class="chip ${o.k}">${o.k === 'bad' ? 'Dringend' : 'Offen'}</span><button class="linkish" data-act="goSite" data-v="${o.x.id}">${o.t}</button></li>`).join('')}</ul>` : `<p class="muted" style="margin:0">Nichts offen. Zeit für neue Flächen unter <button class="linkish" data-act="tab" data-v="sites">Standorte</button>.</p>`}
      <div class="phead" style="margin-top:18px"><h3>Meldungen</h3><button class="linkish" data-act="tab" data-v="news">Alle</button></div>
      <ul class="list">${news.map((n) => `<li><span class="mono muted" style="font-size:12px;min-width:62px">${n.d}</span><span>${n.text}</span></li>`).join('')}</ul>
    </section>
  </div>
  <section class="panel"><div class="phead"><h3>Strompreis & Speicher-Spread</h3><span class="muted">Euro je Megawattstunde</span></div><div class="chart" data-chart="price"></div></section>
  </div>`;
}

/* ---------- sites ---------- */
function gridBar(r: RegionKey): string {
  const g = V().grid[r],
    cap = g.capacity;
  const seg = V()
    .players.map((p) => ({ c: pc(p.id), mw: g.usedBy[p.id] ?? 0 }))
    .filter((s) => s.mw > 0);
  return `<div class="gridwrap"><div class="row" style="justify-content:space-between"><span class="label">Netzkapazität</span><span class="mono" style="font-size:12px">${g.used} + ${g.reserved} res. / ${cap} MW</span></div>
    <div class="gridbar" role="img" aria-label="${g.used} MW belegt, ${g.reserved} MW reserviert, ${cap} MW gesamt">${seg.map((s) => `<i style="width:${(s.mw / cap) * 100}%;background:${s.c}"></i>`).join('')}${g.reserved ? `<i class="res" style="width:${(g.reserved / cap) * 100}%"></i>` : ''}</div>
    <span class="muted" style="font-size:12px">Frei für dich: ${g.free} MW${g.myReserved ? ` (davon ${g.myReserved} MW reserviert)` : ''}</span></div>`;
}
function ownBar(r: RegionKey): string {
  const Sx = V().sites.filter((x) => x.r === r);
  return `<span class="obar" aria-hidden="true">${V()
    .players.map((p) => {
      const n = Sx.filter((x) => x.owner === p.id).length;
      return n ? `<i style="width:${(n / Sx.length) * 100}%;background:${pc(p.id)}"></i>` : '';
    })
    .join('')}</span>`;
}
function ownerLegend(r: RegionKey): string {
  const Sx = V().sites.filter((x) => x.r === r),
    free = Sx.filter((x) => x.owner < 0).length;
  return `<div class="olegend" aria-label="Flächen je Konzern">${V()
    .players.filter((p) => !p.out)
    .map((p) => {
      const n = Sx.filter((x) => x.owner === p.id).length;
      return `<span class="ochip${n ? '' : ' zero'}${p.human ? ' me' : ''}" style="--oc:${pc(p.id)}"><i class="mb">${mono(p.id)}</i>${esc(p.human ? 'Du · ' + p.name : p.name)}<b>${n}</b></span>`;
    })
    .join('')}<span class="ochip free"><i class="mb"></i>Frei<b>${free}</b></span></div>`;
}
function vSites(): string {
  const v = V(),
    r = UI.region,
    R = REGIONS[r];
  const pills = REGION_KEYS.map(
    (k) =>
      `<button class="rpill" aria-pressed="${k === r}" data-act="region" data-v="${k}">${REGION_TEXT[k].name}<span class="n">${v.sites.filter((x) => x.r === k && x.owner === v.playerId).length}/16</span>${ownBar(k)}</button>`,
  ).join('');
  return `<div class="regions">${pills}</div>
  <div class="field-layout">
    <section class="panel">
      <div class="phead"><h2>${REGION_TEXT[r].name}</h2><span class="muted">${R.types.map((t) => PLANT_NAME[t]).join(' · ')}</span></div>
      <p class="muted" style="margin:0 0 12px">${REGION_TEXT[r].desc}</p>
      <div class="region-bar">
        ${R.wind ? `<div class="stat"><span class="label">Wind</span><span class="v">${R.wind[0].toLocaleString('de-DE')}–${R.wind[1].toLocaleString('de-DE')} m/s</span></div>` : ''}
        ${R.sun ? `<div class="stat"><span class="label">Sonne</span><span class="v">${R.sun[0]}–${R.sun[1]} kWh/kWp</span></div>` : ''}
        ${gridBar(r)}
        <button class="btn" data-act="reserve" data-v="${r}" ${v.grid[r].free < v.constants.reserveMw ? 'disabled' : ''}>${v.constants.reserveMw} MW reservieren <small>${money(v.constants.reserveCost, true)} · ${v.constants.reserveQuarters} Q</small></button>
      </div>
      <div class="scene"><canvas data-scene="${r}" aria-hidden="true"></canvas><div class="hits">${hits(r)}</div></div>
      ${ownerLegend(r)}
      <p class="muted" style="font-size:12px;margin:6px 0 0">Tipp auf eine Parzelle. Rahmen, Fahne und Etikett in Konzernfarbe zeigen, wem die Fläche gehört; ★ markiert deine eigenen.</p>
    </section>
    <aside class="panel" id="detail">${detail()}</aside>
  </div>`;
}
function hits(r: RegionKey): string {
  const g = geo(100, 100),
    v = V();
  return v.sites
    .filter((x) => x.r === r)
    .map((x) => {
      const qd = quad(g, x.i),
        l = g.X(qd.u0, qd.cy),
        w = g.X(qd.u1, qd.cy) - l,
        s = siteStatus(x),
        own = x.owner >= 0;
      const o = own ? v.players[x.owner]! : null,
        val = !own ? (x.surveyed ? siteQuality(x) : money(x.lease, true)) : o!.human ? s.t : esc(shortName(o!));
      return `<button class="hit ${UI.sel === x.id ? 'sel' : ''}" style="left:${l}%;top:${qd.y0}%;width:${w}%;height:${qd.y1 - qd.y0}%" data-act="sel" data-v="${x.id}" aria-label="${siteName(x)}: ${own ? (o!.human ? 'deine Fläche' : 'gehört ' + esc(o!.name)) + ', ' + s.t : 'frei, ' + s.t}">
      <span class="stag${own ? ' own' : ''}${x.owner === v.playerId ? ' me' : ''}"${own ? ` style="--oc:${pc(x.owner)}"` : ''}>${own ? `<i class="mb">${mono(x.owner)}</i>` : ''}${siteName(x)}${own && s.k === 'bad' ? '<i class="alert">!</i>' : ''}<span class="sval">${val}</span></span></button>`;
    })
    .join('');
}
function btn(
  act: string,
  v: string,
  label: string,
  price: number,
  o: { dis?: boolean; cls?: string; confirm?: boolean } = {},
): string {
  const dis = o.dis || (price > 0 && meP().cash < price) || S.busy,
    key = act + ':' + v;
  if (o.confirm && UI.confirm === key)
    return `<button class="btn confirm" data-act="${act}" data-v="${v}" data-ok="1">Wirklich? Bestätigen</button>`;
  return `<button class="btn ${o.cls || ''}" data-act="${act}" data-v="${v}" ${dis ? 'disabled' : ''}><span>${label}</span>${price ? `<small>${price > 0 ? money(price, true) : '+' + money(-price, true)}</small>` : ''}</button>`;
}
function detail(): string {
  const v = V();
  const x = v.sites.find((s) => s.id === UI.sel);
  if (!x)
    return `<h3>Standort wählen</h3><p class="muted">Tipp auf eine Fläche, um Details zu sehen.</p>
    <dl class="facts"><dt>1. Pachten</dt><dd>Fläche sichern</dd><dt>2. Genehmigung</dt><dd>1–5 Quartale</dd><dt>3. Bauen</dt><dd>Standortsuche & Montage</dd><dt>4. Netz</dt><dd>Anschluss-Puzzle</dd></dl>`;
  const s = siteStatus(x),
    R = REGIONS[x.r],
    own = x.owner >= 0,
    mine = x.owner === v.playerId;
  const o = own ? v.players[x.owner]! : null;
  const band = own
    ? `<div class="oband" style="--oc:${pc(x.owner)}"><i class="mb">${mono(x.owner)}</i><span><span class="label">${mine ? 'Deine Fläche' : 'Gepachtet von'}</span><b>${esc(o!.name)}</b></span></div>`
    : `<div class="oband free"><i class="mb"></i><span><span class="label">Freie Fläche</span><b>Noch nicht verpachtet</b></span></div>`;
  let f = `<dt>Region</dt><dd>${REGION_TEXT[x.r].name}</dd><dt>Pacht</dt><dd>${money(x.lease)}</dd>`;
  if (x.known) {
    if (x.wind != null) f += `<dt>Windgeschwindigkeit</dt><dd>${x.wind.toLocaleString('de-DE')} m/s</dd>`;
    if (x.sun != null) f += `<dt>Globalstrahlung</dt><dd>${x.sun} kWh/kWp</dd>`;
    if (x.r === 'al') f += `<dt>Gefälle für Wasserkraft</dt><dd>${x.hydro ? 'ja' : 'nein'}</dd>`;
  } else f += `<dt>Ertrag</dt><dd>unbekannt</dd>`;
  if (mine && x.type && x.own) {
    const P = PLANTS[x.type];
    f += `<dt>Anlage</dt><dd>${PLANT_NAME[x.type]}</dd><dt>Leistung</dt><dd>${P.mw} MW${P.mwh ? ' / ' + P.mwh + ' MWh' : ''}</dd>`;
    if (x.built) f += `<dt>Wirkungsgrad</dt><dd>${Math.round(x.own.eff * 100)} %</dd>`;
    if (operating(x))
      f += isStoreT(x.type)
        ? `<dt>Arbitrage/Quartal</dt><dd>≈ ${money(x.own.storeRevenue, true)}</dd>`
        : `<dt>Erzeugung ${QN[v.q]}</dt><dd>≈ ${mwh(x.own.genEstimate)}</dd>`;
    f += `<dt>Wert</dt><dd>${money(x.own.value, true)}</dd>`;
  }
  const a: string[] = [];
  if (!own) {
    if (!x.surveyed) a.push(btn('survey', x.id, 'Ertragsgutachten', x.surveyCost));
    a.push(btn('lease', x.id, 'Fläche pachten', x.lease, { cls: 'primary' }));
  } else if (mine && x.own) {
    if (!x.type) {
      const types = R.types.filter((t) => !((t === 'hydro' || t === 'pump') && !x.hydro));
      types.forEach((t) =>
        a.push(
          btn('permit', x.id + '|' + t, 'Genehmigung: ' + PLANT_NAME[t], v.costs[t].permit, {
            cls: t === R.types[0] ? 'primary' : '',
          }),
        ),
      );
      a.push(
        `<p class="muted" style="font-size:12px;margin:0">Bau ab ≈ ${types.map((t) => PLANT_NAME[t] + ' ' + money(v.costs[t].build, true)).join(', ')}</p>`,
      );
    } else if (x.permit === 'rejected') {
      a.push(btn('permit', x.id + '|' + x.type, 'Erneut beantragen', v.costs[x.type].permit, { cls: 'primary' }));
      a.push(btn('retype', x.id, 'Anderen Anlagentyp wählen', 0));
    } else if (x.permit === 'approved' && !x.built) {
      if (x.fail) a.push(btn('build', x.id, 'Montage wiederholen', v.costs[x.type].retry, { cls: 'primary' }));
      else a.push(btn('build', x.id, 'Bauen: ' + PLANT_NAME[x.type], v.costs[x.type].build, { cls: 'primary' }));
    } else if (x.built && !x.grid) {
      const ok = v.grid[x.r].free >= PLANTS[x.type].mw;
      a.push(btn('connect', x.id, 'Ans Netz anschließen', v.costs[x.type].grid, { cls: 'primary', dis: !ok }));
      if (!ok)
        a.push(
          `<p class="muted" style="font-size:12px;margin:0">Nicht genug freie Netzkapazität (${PLANTS[x.type].mw} MW nötig). Warte auf Netzausbau oder reserviere rechtzeitig.</p>`,
        );
    }
    if (x.fault && x.grid && x.type) {
      a.push(btn('fixSelf', x.id, 'Netz selbst stabilisieren', v.constants.selfRepairCost, { cls: 'primary' }));
      a.push(btn('fixPro', x.id, 'Servicetrupp (sicher)', v.costs[x.type].service));
    }
    a.push(btn('sellSite', x.id, 'Projekt verkaufen', -x.own.sellValue, { cls: 'danger', confirm: true }));
  } else {
    const lt = TRICK_KEYS.filter((k) => v.tricks[k].targets.includes(x.id));
    if (lt.length)
      a.push(
        `<button class="btn" data-act="trickGo" data-v="${x.id}|${lt[0]}"><span>Lobby-Aktion planen …</span></button>`,
      );
  }
  return `${band}<div class="phead"><h3>${siteName(x)}</h3><span class="chip ${s.k}">${s.t}</span></div><dl class="facts">${f}</dl><div class="actions">${a.join('')}</div>`;
}

/* ---------- market ---------- */
function vMarket(): string {
  const v = V(),
    contracts = v.me.contracts;
  const offers = v.offers
    .map(
      (
        o,
      ) => `<div class="offer"><div class="top"><b>${esc(o.buyer)}</b><span class="chip acc">${eur(o.price)}</span></div>
    <div class="kv"><span>Menge <b>${mwh(o.vol)}</b>/Quartal</span><span>Laufzeit <b>${o.quarters} Q</b></span><span>Volumen <b>${money(o.vol * o.quarters * o.price, true)}</b></span></div>
    <div class="row" style="justify-content:space-between"><span class="muted" style="font-size:12px">Fehlmengen kaufst du zum Börsenpreis +15 % zu · gültig ${o.expires - v.turn} Q</span><button class="btn primary" data-act="accept" data-v="${o.id}" ${contracts.length >= v.constants.maxContracts || S.busy ? 'disabled' : ''}>Abschließen</button></div></div>`,
    )
    .join('');
  const act = contracts
    .map(
      (c) =>
        `<tr><td>${esc(c.buyer)}</td><td class="r num">${mwh(c.vol)}</td><td class="r num">${eur(c.price)}</td><td class="r num">${c.left}</td></tr>`,
    )
    .join('');
  const next = v.me.nextGen,
    need = v.me.contractVolume;
  return `<div class="grid g2">
    <div class="stack" style="gap:14px">
      <section class="panel"><div class="phead"><h3>Börse</h3><span class="mono">${eur(v.market.price)} · Spread ${eur(v.market.spread)}</span></div><div class="chart" data-chart="price"></div>
      <p class="muted" style="margin:10px 0 0;font-size:13px">Strom wird automatisch zum Börsenpreis verkauft. Solarstrom erzielt im Sommer weniger, weil dann alle gleichzeitig einspeisen. Speicher verdienen am Spread zwischen billigen und teuren Stunden – je mehr Wind und Sonne im Markt, desto größer.</p></section>
      <section class="panel"><h3 style="margin-bottom:8px">Deine Lieferverpflichtung</h3>
        <dl class="facts"><dt>Erwartete Erzeugung ${QN[v.q]}</dt><dd>${mwh(next)}</dd><dt>Vertraglich gebunden</dt><dd>${mwh(need)}</dd></dl>
        ${need > next ? '<span class="chip bad">Mehr verkauft als erzeugt – Zukauf droht</span>' : ''}</section>
    </div>
    <div class="stack" style="gap:14px">
      <section class="panel"><div class="phead"><h3>PPA-Angebote</h3><span class="muted">${contracts.length}/${v.constants.maxContracts} aktiv</span></div><div class="stack">${offers}</div></section>
      <section class="panel"><h3 style="margin-bottom:8px">Laufende Verträge</h3>
      ${act ? `<div class="tw"><table class="t"><thead><tr><th>Abnehmer</th><th class="r">je Q</th><th class="r">Preis</th><th class="r">Rest</th></tr></thead><tbody>${act}</tbody></table></div>` : '<p class="muted" style="margin:0">Keine. Ein Power Purchase Agreement sichert dir einen festen Preis, verlangt aber die volle Menge.</p>'}</section>
    </div></div>`;
}

/* ---------- bank ---------- */
function vBank(): string {
  const v = V(),
    P = meP(),
    lim = v.me.creditLimit,
    free = Math.max(0, lim - P.loan);
  return `<div class="grid g2e"><section class="panel stack"><h2>Hausbank</h2>
    <dl class="facts"><dt>Kredit</dt><dd>${money(P.loan)}</dd><dt>Kreditrahmen</dt><dd>${money(lim)}</dd><dt>Noch verfügbar</dt><dd>${money(free)}</dd><dt>Zinsen</dt><dd>${(v.constants.interest * 100).toLocaleString('de-DE')} % / Quartal</dd><dt>Zinslast</dt><dd>${money(P.loan * v.constants.interest)} / Quartal</dd></dl>
    <div class="row">${[5e6, 20e6, 50e6].map((a) => `<button class="btn" data-act="borrow" data-v="${a}" ${free < a || S.busy ? 'disabled' : ''}>+ ${money(a, true)}</button>`).join('')}</div>
    <div class="row">${[5e6, 20e6].map((a) => `<button class="btn" data-act="repay" data-v="${a}" ${P.loan < a || P.cash < a || S.busy ? 'disabled' : ''}>${money(a, true)} tilgen</button>`).join('')}<button class="btn" data-act="repay" data-v="all" ${!P.loan || P.cash < P.loan || S.busy ? 'disabled' : ''}>Alles tilgen</button></div>
  </section><section class="panel"><h3 style="margin-bottom:8px">Projektfinanzierung</h3>
    <p class="muted" style="margin:0 0 8px">Der Rahmen beträgt 60 % deiner Vermögenswerte, mindestens ${money(v.constants.minCredit)}. Erneuerbare sind kapitalintensiv: Ein Offshore-Park lässt sich kaum ohne Kredit bauen.</p>
    <p class="muted" style="margin:0">Rutscht die Kasse zum Quartalsende ins Minus, gibt es einen Notkredit. Reicht der Rahmen nicht, ist dein Konzern insolvent.</p></section></div>`;
}

/* ---------- lobby ---------- */
function vLobby(): string {
  const v = V(),
    T = v.tricks[UI.trick],
    ts = T.targets.map((id) => v.sites.find((s) => s.id === id)!).filter(Boolean);
  if (UI.target && !ts.find((x) => x.id === UI.target)) UI.target = '';
  const opts = ts
    .map(
      (x) =>
        `<option value="${x.id}" ${UI.target === x.id ? 'selected' : ''}>${siteName(x)} · ${PLANT_NAME[x.type!]} · ${esc(v.players[x.owner]!.name)}</option>`,
    )
    .join('');
  return `<div class="grid g2"><section class="panel stack">
    <div class="phead"><h2>Lobby & Tricks</h2><span class="muted">${v.me.tricksLeft} Aktionen in diesem Quartal übrig</span></div>
    <div class="sab">${TRICK_KEYS.map((k) => `<button class="sabopt" aria-pressed="${UI.trick === k}" data-act="trick" data-v="${k}"><b>${TRICK_TEXT[k].name}</b><span class="mono">${money(v.tricks[k].cost, true)} · ${Math.round(v.tricks[k].chance * 100)} %</span><span class="muted" style="font-size:12px">${TRICK_TEXT[k].desc}</span></button>`).join('')}</div>
    <label for="trickTarget" class="label">Ziel</label>
    <select id="trickTarget" data-act="trickTarget">${ts.length ? '<option value="">Projekt wählen …</option>' + opts : '<option value="">Gerade kein passendes Ziel</option>'}</select>
    <div class="row"><button class="btn primary big" data-act="doTrick" ${!UI.target || meP().cash < T.cost || v.me.tricksLeft <= 0 || S.busy ? 'disabled' : ''}>Auftrag vergeben · ${money(T.cost, true)}</button></div>
  </section><section class="panel"><h3 style="margin-bottom:8px">Risiko</h3>
    <p class="muted" style="margin:0 0 8px">Eine Klage ist legal: Scheitert sie, ist nur das Geld weg. Eine aufgeflogene Bürgerinitiative kostet ${money(v.tricks.bi.fine, true)} Imageschaden, ein aufgeflogener Hackerangriff ${money(v.tricks.hack.fine, true)} Strafe.</p>
    <p class="muted" style="margin:0">Sicherer spielst du mit Netzreservierungen unter Standorte: Wer die Kapazität hat, bekommt den Anschluss.</p></section></div>`;
}

/* ---------- rivals & news ---------- */
const byRank = (a: PlayerSummary, b: PlayerSummary) => Number(a.out) - Number(b.out) || b.worth - a.worth;
function vRivals(): string {
  const v = V();
  const rows = v.players
    .slice()
    .sort(byRank)
    .map(
      (
        p,
      ) => `<tr><td><span class="row" style="flex-wrap:nowrap"><i class="dot" style="--oc:${pc(p.id)}"></i>${esc(p.name)}${p.human ? ' <span class="chip acc">Du</span>' : ''}${p.out ? ' <span class="chip bad">Insolvent</span>' : ''}</span></td>
    <td class="r num">${p.out ? '–' : money(p.worth, true)}</td><td class="r num">${money(p.cash, true)}</td><td class="r num">${money(p.loan, true)}</td><td class="r num">${p.sites}</td><td class="r num">${p.mw} MW</td><td class="r num">${mwh(p.genLast)}</td><td class="r num">${tons(p.co2)}</td></tr>`,
    )
    .join('');
  return `<section class="panel"><div class="phead"><h2>Konkurrenz</h2><span class="muted">Stand ${qStr(v.year, v.q)}</span></div>
  <div class="tw"><table class="t"><thead><tr><th>Konzern</th><th class="r">Vermögen</th><th class="r">Kasse</th><th class="r">Kredit</th><th class="r">Flächen</th><th class="r">Leistung</th><th class="r">Erzeugung</th><th class="r">CO₂ vermieden</th></tr></thead><tbody>${rows}</tbody></table></div></section>
  <section class="panel" style="margin-top:14px"><h3 style="margin-bottom:8px">Verlauf</h3><div class="chart" data-chart="worth"></div></section>`;
}
function newsList(): { d: string; kind: NewsKind; text: string }[] {
  const v = V();
  return v.news.flatMap((n) => newsTexts(v, n.event).map((t) => ({ d: qStr(n.year, n.q), ...t })));
}
function vNews(): string {
  const k: Record<string, string> = { bad: 'bad', world: 'warn', sab: 'warn', comp: 'acc', info: '' },
    l: Record<string, string> = { bad: 'Gegen dich', world: 'Welt', sab: 'Lobby', comp: 'Konkurrenz', info: 'Info' };
  return `<section class="panel"><h2 style="margin-bottom:8px">Nachrichten</h2><ul class="list">${newsList()
    .map(
      (n) =>
        `<li><span class="mono muted" style="font-size:12px;min-width:62px">${n.d}</span><span class="chip ${k[n.kind] || ''}">${l[n.kind] || 'Info'}</span><span>${n.text}</span></li>`,
    )
    .join('')}</ul></section>`;
}

/* ---------- charts ---------- */
interface Series {
  name: string;
  color: string;
  vals: (number | null)[];
  fmt: (v: number) => string;
}
function drawChart(el: HTMLElement): void {
  const v = V();
  const type = el.dataset.chart;
  let series: Series[];
  if (type === 'price')
    series = [
      { name: 'Strompreis', color: 'var(--c0)', vals: v.market.priceHist, fmt: (x) => eur(x) },
      { name: 'Speicher-Spread', color: 'var(--c3)', vals: v.market.spreadHist, fmt: (x) => eur(x) },
    ];
  else series = v.players.map((p) => ({ name: p.name, color: pc(p.id), vals: p.hist, fmt: (x) => money(x) }));
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

/* ---------- modals: report, end, start ---------- */
export function showReport(rep: QuarterReport, rivals: RivalActionLog[]): void {
  const v = V();
  const lines = rep.lines
    .map(
      (l) =>
        `<span>${esc(reportLineText(l))}</span><span class="v ${l.amount < 0 ? 'down' : ''}" data-count="${l.amount}">${money(l.amount)}</span>`,
    )
    .join('');
  const big = REGION_KEYS.map((r) => ({
    r,
    mw: v.sites
      .filter((x) => x.r === r && x.owner === v.playerId && operating(x))
      .reduce((a, x) => a + PLANTS[x.type!].mw, 0),
  })).sort((a, b) => b.mw - a.mw)[0]!;
  const br = big.mw ? big.r : UI.region;
  const evs = rep.events.map((e) => reportEventText(v, e)).filter((e) => !!e);
  const ev = evs
    .map(
      (e) =>
        `<li><span class="chip ${e.kind}">${{ bad: 'Achtung', warn: 'Ereignis', good: 'Gut', info: 'Info' }[e.kind] || 'Info'}</span><span>${e.text}</span></li>`,
    )
    .join('');
  const delta = rep.endCash - rep.startCash;
  openModal(`<div class="banner"><canvas data-scene="${br}" data-mini="1" aria-hidden="true"></canvas><div class="bcap"><span class="label">Quartalsbericht</span><h2>${qStr(rep.year, rep.q)}</h2></div><div class="bdelta ${delta < 0 ? 'neg' : ''}"><span class="label">Kasse</span><b data-count="${delta}">${money(delta)}</b></div></div>
    <div class="rep"><span>Erzeugung</span><span class="v" data-count="${rep.gen}" data-fmt="mwh">${mwh(rep.gen)}</span><span>Ø Börsenpreis</span><span class="v">${eur(rep.price)}</span>${lines}
    <span class="sum">Veränderung Kasse</span><span class="v sum ${delta < 0 ? 'down' : 'up'}" data-count="${delta}">${money(delta)}</span></div>
    ${ev ? `<ul class="list">${ev}</ul>` : ''}${compLog(rivals)}<div class="foot"><button class="btn primary" data-act="closeReport">Weiter</button></div>`);
  animateRivals();
  if (evs.some((e) => e.kind === 'bad')) SND.alarm();
  else if (delta >= 0) SND.coin();
  else SND.report();
}
function compLog(rivals: RivalActionLog[]): string {
  const v = V();
  const L: { id: number; t: string }[] = [];
  for (const r of rivals)
    for (const e of r.events) {
      const t = rivalActionText(v, e);
      if (!t) continue;
      const fromNews = e.type === 'trickSucceeded' || e.type === 'trickFailed';
      L.push({ id: r.playerId, t: fromNews ? t : esc(v.players[r.playerId]!.name) + ' ' + t + '.' });
    }
  return `<details class="comp" ${L.length ? 'open' : ''}><summary><b>Konkurrenz</b> <span class="muted">${L.length ? L.length + ' Aktionen' : 'ruhiges Quartal'}</span></summary><ul class="list" id="compList">${L.map((c) => `<li class="rv"><i class="dot" style="--oc:${pc(c.id)};margin-top:5px"></i><span>${c.t}</span></li>`).join('')}</ul></details>`;
}
/** Shows the rival actions one after the other. */
function animateRivals(): void {
  const items = Array.from(document.querySelectorAll<HTMLElement>('#compList li.rv'));
  if (RMO) return;
  items.forEach((li, i) => {
    li.classList.add('hidden-rv');
    setTimeout(() => li.classList.remove('hidden-rv'), 250 + i * 280);
  });
}
export function showEnd(): void {
  const v = V();
  const reason =
    {
      time: 'Die Zeit ist um.',
      monopoly: 'Alle Konkurrenten sind insolvent!',
      bankrupt: 'Dein Konzern ist insolvent.',
    }[v.over as string] ?? '';
  const rank = v.players.slice().sort(byRank);
  const won = v.over !== 'bankrupt' && rank[0]!.human;
  openModal(`<h2>${won ? 'Du führst die Energiewende an!' : 'Spielende'}</h2><p class="muted" style="margin:0">${reason} Du hast ${tons(v.me.co2)} CO₂ vermieden.</p>
    <div class="tw"><table class="t"><thead><tr><th>#</th><th>Konzern</th><th class="r">Vermögen</th><th class="r">CO₂ vermieden</th></tr></thead><tbody>
    ${rank.map((p, i) => `<tr><td class="num">${i + 1}</td><td><span class="row" style="flex-wrap:nowrap"><i class="dot" style="--oc:${pc(p.id)}"></i>${esc(p.name)}</span></td><td class="r num">${p.out ? 'insolvent' : money(p.worth, true)}</td><td class="r num">${tons(p.co2)}</td></tr>`).join('')}</tbody></table></div>
    <div class="foot"><button class="btn" data-act="closeModal">Endstand ansehen</button><button class="btn primary" data-act="newGameDlg">Neues Spiel</button></div>`);
}
export function showStart(canContinue: boolean, name = 'Deichwatt AG', difficulty: Difficulty = 'normal'): void {
  openModal(`<div class="banner tall"><canvas data-scene="nd" data-mini="1" aria-hidden="true"></canvas><div class="bcap"><span class="label">2026 – 2035</span><h2 class="title">${LOGO}Wattmogul</h2></div></div>
    <p style="margin:0">2026. Vier Energiekonzerne ringen um die besten Flächen Europas: Wind an der Küste, Offshore-Parks in der Nordsee, Solar in Iberien, Wasserkraft in den Alpen. Pachten, genehmigen lassen, bauen, ans Netz bringen – und der Konkurrenz ab und zu eine Klage an den Hals hängen.</p>
    <div class="field-grid">
      <label for="sName">Konzernname<input type="text" id="sName" value="${esc(name)}" maxlength="24"></label>
      <div class="field-grid-info"><span class="label">Spieldauer</span><b>${GAME_YEARS} Jahre · ${GAME_YEARS * 4} Quartale</b><span class="muted">2026 bis Ende 2035</span></div>
    </div>
    <label class="field" for="sDiff">Konkurrenz<select id="sDiff">${(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => `<option value="${d}" ${d === difficulty ? 'selected' : ''}>${DIFFICULTY_TEXT[d]}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" id="sAuto"> Minispiele überspringen (Ergebnis wird ausgewürfelt)</label>
    <p class="muted" style="margin:0;font-size:12px">Alle Firmen und Personen im Spiel sind frei erfunden. Ereignisse nach 2026 sind fiktive Szenarien. Dein Spielstand liegt auf dem Server; nur dieser Browser kennt den Zugangsschlüssel.</p>
    <div class="foot">${canContinue ? '<button class="btn" data-act="continue">Weiterspielen</button>' : ''}<button class="btn primary big" data-act="start">Spiel starten</button></div>`);
}
export function showBuilt(x: SiteView): void {
  const v = V();
  if (!x.type) return;
  const P = PLANTS[x.type],
    free = v.grid[x.r].free;
  openModal(
    `<h2>${PLANT_NAME[x.type]} steht</h2><p style="margin:0">Jetzt fehlt nur noch der Netzanschluss (${P.mw} MW, frei in ${REGION_TEXT[x.r].name}: ${free} MW).</p><div class="foot"><button class="btn" data-act="closeModal">Später</button><button class="btn primary" data-act="connectNow" data-v="${x.id}" ${free < P.mw ? 'disabled' : ''}>Anschließen · ${money(v.costs[x.type].grid, true)}</button></div>`,
  );
}
export { closeModal };
