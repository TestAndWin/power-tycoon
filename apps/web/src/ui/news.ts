/** News tab and the news list of the overview. */
import { qStr } from '../format.js';
import { MILESTONE_NAME, milestoneEffects, newsTexts, SEASON_NAME, type NewsKind } from '../texts.js';
import { V } from './common.js';

export function newsList(): { d: string; kind: NewsKind; text: string }[] {
  const v = V();
  return v.news.flatMap((n) => newsTexts(v, n.event).map((t) => ({ d: qStr(n.year, n.q), ...t })));
}
/** Announced milestones that are still ahead (the next `limit` ones). */
export function milestoneList(limit = Infinity): string {
  const v = V();
  const items = v.milestones.slice(0, limit);
  if (!items.length) return `<p class="muted" style="margin:0">Keine weiteren Termine bis Spielende.</p>`;
  return `<ul class="list">${items
    .map((h) => {
      const n = (h.year - v.startYear) * 4 + h.q - v.turn;
      const when = n === 0 ? 'zum Quartalsende' : n === 1 ? 'nächstes Quartal' : `in ${n} Quartalen`;
      return `<li><span class="mono muted" style="font-size:12px;min-width:62px">${qStr(h.year, h.q)}</span><span><b>${MILESTONE_NAME[h.key]}</b> <span class="muted">· ${when}</span><br><span class="muted">${milestoneEffects(h).join(' · ')}</span></span></li>`;
    })
    .join('')}</ul>`;
}

export function vNews(): string {
  const k: Record<string, string> = { bad: 'bad', good: 'good', world: 'warn', sab: 'warn', comp: 'acc', info: '' },
    l: Record<string, string> = {
      bad: 'Gegen dich',
      good: 'Abgewehrt',
      world: 'Welt',
      sab: 'Lobby',
      comp: 'Konkurrenz',
      info: 'Info',
    };
  const v = V(),
    [lead, ...rest] = newsList();
  return `<article class="paper"><div class="mast"><h2>ENERGIE-KURIER</h2></div>
    <div class="dateline"><span>${SEASON_NAME[v.q]} ${v.year}</span><span>Ausgabe ${qStr(v.year, v.q)}</span></div>
    ${lead ? `<p class="lead">${lead.text}</p>` : ''}
    <div class="cols">${rest
      .map(
        (n) =>
          `<p><span class="d">${n.d} · <span class="chip ${k[n.kind] || ''}">${l[n.kind] || 'Info'}</span></span>${n.text}</p>`,
      )
      .join('')}</div></article>
  <section class="panel" style="margin-top:16px"><h2 style="margin-bottom:8px">Angekündigte Termine</h2>${milestoneList()}</section>`;
}
