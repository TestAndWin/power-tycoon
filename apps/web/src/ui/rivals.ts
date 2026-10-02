/** Rivals tab: ranking table and net worth history. */
import type { PlayerSummary } from '@power-tycoon/engine';
import { esc, money, mwh, qStr, tons } from '../format.js';
import { playerColor } from '../players.js';
import { V } from './common.js';

export const byRank = (a: PlayerSummary, b: PlayerSummary) => Number(a.out) - Number(b.out) || b.worth - a.worth;
export function vRivals(): string {
  const v = V();
  const rows = v.players
    .slice()
    .sort(byRank)
    .map(
      (
        p,
      ) => `<tr><td><span class="row" style="flex-wrap:nowrap"><i class="dot" style="--oc:${playerColor(p.id)}"></i>${esc(p.name)}${p.human ? ' <span class="chip acc">Du</span>' : ''}${p.out ? ' <span class="chip bad">Insolvent</span>' : ''}</span></td>
    <td class="r num">${p.out ? '–' : money(p.worth, true)}</td><td class="r num">${money(p.cash, true)}</td><td class="r num">${money(p.loan, true)}</td><td class="r num">${p.sites}</td><td class="r num">${p.mw} MW</td><td class="r num">${mwh(p.genLast)}</td><td class="r num">${tons(p.co2)}</td></tr>`,
    )
    .join('');
  return `<section class="panel"><div class="phead"><h2>Konkurrenz</h2><span class="muted">Stand ${qStr(v.year, v.q)}</span></div>
  <div class="tw"><table class="t"><thead><tr><th>Konzern</th><th class="r">Vermögen</th><th class="r">Kasse</th><th class="r">Kredit</th><th class="r">Flächen</th><th class="r">Leistung</th><th class="r">Erzeugung</th><th class="r">CO₂ vermieden</th></tr></thead><tbody>${rows}</tbody></table></div></section>
  <section class="panel" style="margin-top:14px"><h3 style="margin-bottom:8px">Verlauf</h3><div class="chart" data-chart="worth"></div></section>`;
}
