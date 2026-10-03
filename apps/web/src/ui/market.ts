/** Power market tab: exchange price, delivery obligations and PPA contracts. */
import { esc, eur, money, mwh, QN } from '../format.js';
import { disabledUnless, V } from './common.js';

export function vMarket(): string {
  const v = V(),
    contracts = v.me.contracts;
  const offers = v.offers
    .map(
      (
        o,
      ) => `<div class="offer"><div class="top"><b>${esc(o.buyer)}</b><span class="chip acc">${eur(o.price)}</span></div>
    <div class="kv"><span>Menge <b>${mwh(o.vol)}</b>/Quartal</span><span>Laufzeit <b>${o.quarters} Q</b></span><span>Volumen <b>${money(o.vol * o.quarters * o.price, true)}</b></span></div>
    <div class="row" style="justify-content:space-between"><span class="muted" style="font-size:12px">Fehlmengen kaufst du zum Börsenpreis +15 % zu · gültig ${o.expires - v.turn} Q</span><button class="btn primary" data-act="accept" data-v="${o.id}" ${disabledUnless({ type: 'acceptContract', offerId: o.id })}>Abschließen</button></div></div>`,
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
      <p class="muted" style="margin:10px 0 0;font-size:13px">Strom wird automatisch zum Börsenpreis verkauft. Solarstrom erzielt im Sommer weniger, weil dann alle gleichzeitig einspeisen. Speicher verdienen am Spread zwischen billigen und teuren Stunden – je mehr Wind und Sonne im Markt, desto größer. Den vollen Spread gibt es für Strom deiner eigenen Anlagen in derselben Region, mit zugekauftem Börsenstrom nur die Hälfte.</p></section>
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
