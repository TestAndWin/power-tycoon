/** Dialogs: quarterly report, end of game, start screen and "plant built". */
import {
  DIFFICULTY_KEYS,
  GAME_YEARS,
  operating,
  PLANTS,
  REGION_KEYS,
  type Difficulty,
  type QuarterReport,
  type RivalActionLog,
  type SiteView,
} from '@power-tycoon/engine';
import { esc, eur, money, mwh, qStr, tons } from '../format.js';
import { openModal } from '../modal.js';
import { playerColor } from '../players.js';
import { SND } from '../sound.js';
import { RMO, UI } from '../state.js';
import {
  DIFFICULTY_TEXT,
  PLANT_NAME,
  REGION_TEXT,
  reportEventText,
  reportLineText,
  rivalActionText,
} from '../texts.js';
import { disabledUnless, LOGO, V } from './common.js';
import { byRank } from './rivals.js';

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
  return `<details class="comp" ${L.length ? 'open' : ''}><summary><b>Konkurrenz</b> <span class="muted">${L.length ? L.length + ' Aktionen' : 'ruhiges Quartal'}</span></summary><ul class="list" id="compList">${L.map((c) => `<li class="rv"><i class="dot" style="--oc:${playerColor(c.id)};margin-top:5px"></i><span>${c.t}</span></li>`).join('')}</ul></details>`;
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
    ${rank.map((p, i) => `<tr><td class="num">${i + 1}</td><td><span class="row" style="flex-wrap:nowrap"><i class="dot" style="--oc:${playerColor(p.id)}"></i>${esc(p.name)}</span></td><td class="r num">${p.out ? 'insolvent' : money(p.worth, true)}</td><td class="r num">${tons(p.co2)}</td></tr>`).join('')}</tbody></table></div>
    <div class="foot"><button class="btn" data-act="closeModal">Endstand ansehen</button><button class="btn primary" data-act="newGameDlg">Neues Spiel</button></div>`);
}
export function showStart(canContinue: boolean, name = 'Deichwatt AG', difficulty: Difficulty = 'normal'): void {
  openModal(`<div class="banner tall"><canvas data-scene="nd" data-mini="1" aria-hidden="true"></canvas><div class="bcap"><span class="label">2026 – 2035</span><h2 class="title">${LOGO}Wattmogul</h2></div></div>
    <p style="margin:0">2026. Vier Energiekonzerne ringen um die besten Flächen Europas: Wind an der Küste, Offshore-Parks in der Nordsee, Solar in Iberien, Wasserkraft in den Alpen. Pachten, genehmigen lassen, bauen, ans Netz bringen – und der Konkurrenz ab und zu eine Klage an den Hals hängen.</p>
    <div class="field-grid">
      <label for="sName">Konzernname<input type="text" id="sName" value="${esc(name)}" maxlength="24"></label>
      <div class="field-grid-info"><span class="label">Spieldauer</span><b>${GAME_YEARS} Jahre · ${GAME_YEARS * 4} Quartale</b><span class="muted">2026 bis Ende 2035</span></div>
    </div>
    <label class="field" for="sDiff">Konkurrenz<select id="sDiff">${DIFFICULTY_KEYS.map((d) => `<option value="${d}" ${d === difficulty ? 'selected' : ''}>${DIFFICULTY_TEXT[d]}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" id="sAuto"> Minispiele überspringen (Ergebnis wird ausgewürfelt)</label>
    <p class="muted" style="margin:0;font-size:12px">Alle Firmen und Personen im Spiel sind frei erfunden. Ereignisse nach 2026 sind fiktive Szenarien. Dein Spielstand liegt auf dem Server; nur dieser Browser kennt den Zugangsschlüssel.</p>
    <div class="foot">${canContinue ? '<button class="btn" data-act="continue">Weiterspielen</button>' : ''}<button class="btn primary big" data-act="start">Spiel starten</button></div>`);
}
export function showBuilt(x: SiteView): void {
  const v = V();
  if (!x.type) return;
  const P = PLANTS[x.type],
    free = v.grid[x.r].free,
    connect = { type: 'connectGrid', siteId: x.id } as const;
  openModal(
    `<h2>${PLANT_NAME[x.type]} steht</h2><p style="margin:0">Jetzt fehlt nur noch der Netzanschluss (${P.mw} MW, frei in ${REGION_TEXT[x.r].name}: ${free} MW).</p><div class="foot"><button class="btn" data-act="closeModal">Später</button><button class="btn primary" data-act="connectNow" data-v="${x.id}" ${disabledUnless(connect)}>Anschließen · ${money(v.costs[x.type].grid, true)}</button></div>`,
  );
}
