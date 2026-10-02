/** News tab and the news list of the overview. */
import { qStr } from '../format.js';
import { newsTexts, type NewsKind } from '../texts.js';
import { V } from './common.js';

export function newsList(): { d: string; kind: NewsKind; text: string }[] {
  const v = V();
  return v.news.flatMap((n) => newsTexts(v, n.event).map((t) => ({ d: qStr(n.year, n.q), ...t })));
}
export function vNews(): string {
  const k: Record<string, string> = { bad: 'bad', world: 'warn', sab: 'warn', comp: 'acc', info: '' },
    l: Record<string, string> = { bad: 'Gegen dich', world: 'Welt', sab: 'Lobby', comp: 'Konkurrenz', info: 'Info' };
  return `<section class="panel"><h2 style="margin-bottom:8px">Nachrichten</h2><ul class="list">${newsList()
    .map(
      (n) =>
        `<li><span class="mono muted" style="font-size:12px;min-width:62px">${n.d}</span><span class="chip ${k[n.kind] || ''}">${l[n.kind] || 'Info'}</span><span>${n.text}</span></li>`,
    )
    .join('')}</ul></section>`;
}
