/** Rivals tab: one board per company, ranking table and net worth history; the race of the overview. */
import { REGION_KEYS, type PlayerSummary, type QuarterReport, type RivalActionLog } from '@power-tycoon/engine';
import { esc, money, mwh, qStr, tons } from '../format.js';
import { playerColor } from '../players.js';
import { S } from '../state.js';
import { DETECTIVE_TEXT, newsTexts, REGION_TEXT, rivalActionText, RIVAL_TEXT } from '../texts.js';
import { meP, V } from './common.js';
import { crest, portrait, standing, trend } from './companies.js';

export const byRank = (a: PlayerSummary, b: PlayerSummary) => Number(a.out) - Number(b.out) || b.worth - a.worth;

const trendTag = (p: PlayerSummary): string => {
  const d = trend(p);
  if (d == null || d === 0) return '';
  return `<span class="trend ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${money(Math.abs(d), true)}</span>`;
};

/** Race for market leadership: one lane per company, the token sits at its share of the leader's worth. */
export function raceTrack(): string {
  const v = V(),
    rank = v.players.slice().sort(byRank),
    alive = rank.filter((p) => !p.out).map((p) => p.worth),
    hi = Math.max(...alive),
    lo = Math.min(...alive);
  const lanes = rank
    .map((p, i) => {
      // the leader runs at 92 %, the last one at 12 %: the race shows the gaps, the numbers the amounts
      const pos = p.out ? 0 : hi > lo ? 12 + (80 * (p.worth - lo)) / (hi - lo) : 92;
      return `<li class="lane${p.human ? ' me' : ''}${p.out ? ' out' : ''}" style="--oc:${playerColor(p.id)}">
        <span class="place">${i + 1}</span>
        <span class="who">${crest(p.id, 22)}<b>${esc(p.human ? 'Du · ' + p.name : p.name)}</b></span>
        <span class="track"><span class="trail" style="--p:${pos}"></span><span class="runner" style="--p:${pos}">${portrait(p.id, 40)}</span></span>
        <span class="worth"><b>${p.out ? 'insolvent' : money(p.worth, true)}</b>${trendTag(p)}</span></li>`;
    })
    .join('');
  return `<section class="panel race"><div class="phead"><h3>Rennen um die Marktführung</h3><span class="muted">Nettovermögen · ${v.quartersLeft} Quartale bis zum Ziel</span></div><ol class="lanes">${lanes}</ol></section>`;
}

/** Keeps the last few visible moves of each rival from a quarterly report. */
export function recordRivalMoves(rep: QuarterReport, log: RivalActionLog[]): void {
  const v = V(),
    d = qStr(rep.year, rep.q);
  for (const r of log) {
    const texts = r.events
      .map((e) => rivalActionText(v, e))
      .filter((t): t is string => !!t)
      .map((t) => ({ d, text: /[.!]$/.test(t) ? t : t + '.' }));
    S.rivalMoves[r.playerId] = [...texts.reverse(), ...(S.rivalMoves[r.playerId] ?? [])].slice(0, MOVES);
  }
}
const MOVES = 3;

/** Latest moves of a rival: this session's reports, else its entries in the news feed. */
function moves(pid: number): string[] {
  const v = V(),
    own = S.rivalMoves[pid];
  const list = own?.length
    ? own
    : v.news
        .filter((it) => {
          const e = it.event as { playerId?: number; actorId?: number | null };
          return e.playerId === pid || e.actorId === pid;
        })
        .flatMap((it) => newsTexts(v, it.event).map((t) => ({ d: qStr(it.year, it.q), text: t.text })));
  return list.slice(0, MOVES).map((m) => `<span class="mono muted">${m.d}</span> ${m.text}`);
}

/** What the viewer's spy report says about a rival. */
function intel(p: PlayerSummary): string {
  if (p.out) return '';
  const I = p.intel,
    v = V();
  if (!I)
    return `<div class="moves"><span class="label">Spionage</span><p class="muted">Kein Bericht. <button class="linkish" data-act="tab" data-v="lobby">Spion schicken …</button></p></div>`;
  const until = qStr(v.startYear + Math.floor(I.until / 4), I.until % 4);
  const contracts = I.contracts.length
    ? I.contracts.map((c) => `${esc(c.buyer)} (${mwh(c.vol)}/Q, noch ${c.left} Q)`).join(', ')
    : 'keine Lieferverträge';
  const det = I.detectives
    ? `${DETECTIVE_TEXT[I.detectives.level].name}, noch ${I.detectives.left} Q`
    : 'keine Detektive';
  return `<div class="moves"><span class="label">Spionagebericht · bis ${until}</span><ul><li>${contracts}</li><li>${det} · ${I.tricksLeft} Tricks in diesem Quartal frei</li></ul></div>`;
}

function board(p: PlayerSummary): string {
  const v = V(),
    me = meP(),
    R = RIVAL_TEXT[p.id],
    st = standing(p, me),
    mine = v.sites.filter((s) => s.owner === p.id),
    regions = REGION_KEYS.map((r) => ({ r, n: mine.filter((s) => s.r === r).length }));
  const maxN = Math.max(1, ...regions.map((x) => x.n));
  const m = moves(p.id);
  return `<article class="board${p.out ? ' out' : ''}" style="--oc:${playerColor(p.id)}">
    <header class="bhead">${portrait(p.id, 76)}<div class="bname">${crest(p.id, 26)}<span><b>${esc(p.name)}</b><span class="muted">${R ? esc(R.ceo) + ' · ' + esc(R.role) : ''}</span><span class="chip ${st.k} threat">${st.t}</span></span></div></header>
    ${R ? `<blockquote class="motto">„${esc(R.motto)}“</blockquote><p class="style">${esc(R.style)}</p>` : ''}
    <div class="btoks">
      <span class="btok"><span class="label">Vermögen</span><b>${p.out ? '–' : money(p.worth, true)}</b>${trendTag(p)}</span>
      <span class="btok"><span class="label">Leistung</span><b>${p.mw.toLocaleString('de-DE')} MW</b></span>
      <span class="btok"><span class="label">Kasse</span><b>${money(p.cash, true)}</b></span>
      <span class="btok"><span class="label">Kredit</span><b>${money(p.loan, true)}</b></span>
    </div>
    <div class="turf"><span class="label">Reviere</span>${regions.map((x) => `<span class="tr"><span>${REGION_TEXT[x.r].name}</span><i style="width:${(x.n / maxN) * 100}%"></i><b>${x.n}</b></span>`).join('')}</div>
    ${intel(p)}
    <div class="moves"><span class="label">Letzte Züge</span>${m.length ? `<ul>${m.map((t) => `<li>${t}</li>`).join('')}</ul>` : '<p class="muted">Noch keine öffentlichen Züge.</p>'}</div>
  </article>`;
}

export function vRivals(): string {
  const v = V();
  const boards = v.players
    .filter((p) => !p.human)
    .slice()
    .sort(byRank)
    .map(board)
    .join('');
  const rows = v.players
    .slice()
    .sort(byRank)
    .map(
      (
        p,
        i,
      ) => `<tr><td class="num">${i + 1}</td><td><span class="row" style="flex-wrap:nowrap">${crest(p.id, 22)}${esc(p.name)}${p.human ? ' <span class="chip acc">Du</span>' : ''}${p.out ? ' <span class="chip bad">Insolvent</span>' : ''}</span></td>
    <td class="r num">${p.out ? '–' : money(p.worth, true)}</td><td class="r num">${money(p.cash, true)}</td><td class="r num">${money(p.loan, true)}</td><td class="r num">${p.sites}</td><td class="r num">${p.mw} MW</td><td class="r num">${mwh(p.genLast)}</td><td class="r num">${tons(p.co2)}</td></tr>`,
    )
    .join('');
  return `<div class="boards">${boards}</div>
  <section class="panel" style="margin-top:16px"><div class="phead"><h3>Rangliste</h3><span class="muted">Stand ${qStr(v.year, v.q)}</span></div>
  <div class="tw"><table class="t"><thead><tr><th>#</th><th>Konzern</th><th class="r">Vermögen</th><th class="r">Kasse</th><th class="r">Kredit</th><th class="r">Flächen</th><th class="r">Leistung</th><th class="r">Erzeugung</th><th class="r">CO₂ vermieden</th></tr></thead><tbody>${rows}</tbody></table></div></section>
  <section class="panel" style="margin-top:16px"><h3 style="margin-bottom:8px">Verlauf</h3><div class="chart" data-chart="worth"></div></section>`;
}
