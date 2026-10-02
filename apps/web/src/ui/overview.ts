/** Overview tab: region previews, key figures, open tasks, latest news and charts. */
import { operating, PLANTS, REGION_KEYS } from '@power-tycoon/engine';
import { money, mwh, QN, tons } from '../format.js';
import { REGION_TEXT } from '../texts.js';
import { meP, todo, V } from './common.js';
import { ICON } from './icons.js';
import { newsList } from './news.js';
import { ownBar } from './sites.js';

export function vOverview(): string {
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
    <div class="tile"><span class="ticon">${ICON.worth}</span><span class="label">Nettovermögen</span><span class="big">${money(P.worth)}</span><span class="muted">Rang ${v.me.rank} · noch ${v.quartersLeft} Quartale bis Ende ${v.endYear - 1}</span></div>
    <div class="tile"><span class="ticon">${ICON.power}</span><span class="label">Installierte Leistung</span><span class="big">${v.me.mw.toLocaleString('de-DE')} MW</span><span class="muted">${mine.filter(operating).length} Anlagen am Netz</span></div>
    <div class="tile"><span class="ticon">${ICON.gen}</span><span class="label">Erzeugung ${QN[v.q]}</span><span class="big">${mwh(v.me.nextGen)}</span><span class="muted">Prognose ohne Wetterereignisse</span></div>
    <div class="tile"><span class="ticon">${ICON.leaf}</span><span class="label">CO₂ vermieden</span><span class="big co2">${tons(v.me.co2)}</span><span class="muted">gegenüber Kohle- und Gasstrom</span></div>
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
