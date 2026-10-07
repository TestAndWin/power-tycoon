/**
 * The office (phase 8): the main view on desktop. The canvas scene shows the company; its objects open the
 * areas as folders. Board members speak about open tasks in speech bubbles, rival CEOs call on the phone.
 */
import { operating, REGION_KEYS, type Department, type RegionKey } from '@power-tycoon/engine';
import { esc } from '../format.js';
import { readPlayerColors } from '../players.js';
import { LAMP_HOTSPOT, officeHotspots, OFFICE_H, OFFICE_W, showOffice, type OfficeData } from '../scene/office.js';
import { $, S } from '../state.js';
import {
  ASSISTANT,
  CALL_TEXT,
  DECISION_TEXT,
  decisionContext,
  DEPT_TEXT,
  execName,
  RIVAL_TEXT,
  siteName,
} from '../texts.js';
import { btn, optionFor, siteStatus, todo, V } from './common.js';
import { assistantPortrait, execPortrait, portrait, portraitSvg } from './companies.js';
import { byRank } from './rivals.js';
import { newsList } from './news.js';

/** Region in the window: the one with the largest own capacity (Norddeutschland without plants). */
function windowRegion(): RegionKey {
  const v = V();
  let best: RegionKey = 'nd',
    mw = 0;
  for (const r of REGION_KEYS) {
    const m = v.sites.filter((x) => x.r === r && x.owner === v.playerId && operating(x)).reduce((a, x) => a + x.mw, 0);
    if (m > mw) [best, mw] = [r, m];
  }
  return best;
}

function officeData(): OfficeData {
  const v = V(),
    colors = readPlayerColors();
  const hot = new Set(todo().map((t) => t.x.id));
  const ph = v.market.priceHist;
  const pct = (h: (number | null)[]) => {
    const a = h[h.length - 2],
      b = h[h.length - 1];
    return a && b != null ? ((b - a) / Math.abs(a)) * 100 : 0;
  };
  const ticker =
    v.players
      .filter((p) => !p.out)
      .map((p) => {
        const d = pct(p.hist);
        return `${p.name.split(' ')[0]!.toUpperCase()} ${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
      })
      .join('   ') + `   SPREAD ${Math.round(v.market.spread)} €/MWh   `;
  const card = v.me.decision;
  return {
    hq: v.me.hq,
    q: v.q,
    region: windowRegion(),
    colors,
    price: v.market.price,
    priceDelta: ph.length > 1 ? ph[ph.length - 1]! - ph[ph.length - 2]! : 0,
    priceHist: ph,
    cash: v.me.cash,
    loan: v.me.loan,
    ticker,
    pins: v.sites.filter((x) => x.owner >= 0).map((x) => ({ r: x.r, i: x.i, owner: x.owner, hot: hot.has(x.id) })),
    trophies: v.me.awards.map((a) => ({ cup: a.key === 'cup', gold: a.gold })),
    rivals: v.players
      .filter((p) => p.id !== v.playerId)
      .sort(byRank)
      .map((p) => ({ id: p.id, svg: portraitSvg(p.id, colors) })),
    spy: v.players.some((p) => !!p.intel),
    detectives: !!v.me.detectives,
    ringing: !!card,
    caller: card ? DECISION_TEXT[card.key].kicker.replace(/^(Anruf|Post) (vom|von|aus dem|aus der) /, '') : '',
    headline:
      newsList()[0]?.text.replace(/<[^>]+>/g, '') ?? 'Energiewende: Vier Konzerne im Wettlauf um Europas beste Flächen',
  };
}

/** The office scene with its hotspots (buttons laid over the canvas). */
export function officeScene(): string {
  const v = V(),
    n = todo().length;
  const hot = (
    act: string,
    val: string,
    label: string,
    [x, y, w, h]: [number, number, number, number],
    desk = false,
    badge: string | number = '',
  ) => {
    // vertical position in the cropped office (CSS variables set by the canvas, see `officeCrop`)
    const top = `calc(100% * (${y} - var(${desk ? '--cut' : '--top'}, 0)) / var(--vh, ${OFFICE_H}))`;
    return `<button class="hot${y < 160 ? ' below' : ''}" data-act="${act}" data-v="${val}" style="left:${(x / OFFICE_W) * 100}%;top:${top};width:${(w / OFFICE_W) * 100}%;height:calc(100% * ${h} / var(--vh, ${OFFICE_H}))" aria-label="${esc(label)}"><span class="tag">${esc(label)}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
  };
  const hots =
    officeHotspots(v.me.hq)
      .map(({ k, label, r, desk }) =>
        hot('tab', k, label, r, desk, k === 'sites' && n ? n : k === 'decision' && v.me.decision ? '!' : ''),
      )
      .join('') + hot('lamp', '', 'Schreibtischlampe · an/aus', LAMP_HOTSPOT, true);
  return `<div class="office"><canvas data-office aria-label="Das Büro des Vorstandsvorsitzes" role="img"></canvas>${hots}</div>`;
}

/** Starts or updates the office animation after a render. */
export function mountOffice(): void {
  const cv = $<HTMLCanvasElement>('canvas[data-office]');
  if (cv && S.view) showOffice(cv, officeData());
}

/* ---------- speech bubbles ---------- */

interface Bubble {
  face: string;
  who: string;
  text: string;
  buttons: string;
  cls?: string;
}

/** Who speaks for a department: its board member, or the assistant if the seat is vacant. */
function speaker(d: Department): { face: string; who: string } {
  const e = V().me.board.find((b) => b.dept === d);
  return e
    ? { face: execPortrait(e.dept, e.grade, 40), who: `${esc(execName(e.dept, e.grade))} · ${esc(DEPT_TEXT[d].name)}` }
    : { face: assistantPortrait(40), who: `${ASSISTANT.name} · ${ASSISTANT.role}` };
}
const open = (k: string, label: string) => `<button class="btn small" data-act="tab" data-v="${k}">${label}</button>`;
const goSite = (id: string) => `<button class="btn small" data-act="goSite" data-v="${id}">Akte</button>`;

function bubbles(): Bubble[] {
  const v = V(),
    out: Bubble[] = [];
  if (S.call) {
    const { pid, kind } = S.call;
    out.push({
      face: portrait(pid, 40),
      who: `${esc(RIVAL_TEXT[pid]!.ceo)} · ${esc(v.players[pid]!.name)} ruft an`,
      text: `„${CALL_TEXT[pid]![kind]}“`,
      buttons: '<button class="btn small" data-act="hangUp">Auflegen</button>',
      cls: 'call',
    });
  }
  const card = v.me.decision;
  if (card) {
    const T = DECISION_TEXT[card.key];
    out.push({
      face: assistantPortrait(40),
      who: `${ASSISTANT.name} · ${ASSISTANT.role}`,
      text: `Dein Handy klingelt – ${T.kicker}: <b>${esc(T.title(decisionContext(v, card)))}</b>`,
      buttons: open('decision', 'Rangehen'),
      cls: 'ring',
    });
  }
  for (const { x } of todo()) {
    const { code } = siteStatus(x),
      n = siteName(x);
    const act = (a: string, label: string, action: Parameters<typeof optionFor>[0]) => {
      const o = optionFor(action);
      return o ? btn(a, x.id, label, o, { cls: 'primary small' }) : '';
    };
    if (code === 'leased')
      out.push({
        ...speaker('dev'),
        text: `Für <b>${n}</b> fehlt noch der Genehmigungsantrag.`,
        buttons: goSite(x.id),
      });
    else if (code === 'rejected')
      out.push({
        ...speaker('dev'),
        text: `Die Behörde hat <b>${n}</b> abgelehnt. Neuer Antrag oder ein anderer Anlagentyp?`,
        buttons: goSite(x.id),
      });
    else if (code === 'ready')
      out.push({
        ...speaker('dev'),
        text: `Die Genehmigung für <b>${n}</b> ist da. Soll ich den Bau starten?`,
        buttons: act('build', 'Bau starten', { type: 'build', siteId: x.id }) + goSite(x.id),
      });
    else if (code === 'assemblyFailed')
      out.push({
        ...speaker('grid'),
        text: `Die Montage auf <b>${n}</b> ist abgebrochen. Noch ein Versuch?`,
        buttons: act('build', 'Neuer Versuch', { type: 'build', siteId: x.id }) + goSite(x.id),
      });
    else if (code === 'noGrid')
      out.push({
        ...speaker('grid'),
        text: `<b>${n}</b> steht. Jetzt fehlt nur der Netzanschluss.`,
        buttons: act('connect', 'Anschließen', { type: 'connectGrid', siteId: x.id }) + goSite(x.id),
      });
    else if (code === 'fault')
      out.push({
        ...speaker('grid'),
        text: `Störung auf <b>${n}</b>! Das Kraftwerk ist vom Netz.`,
        buttons: act('fixPro', 'Servicetrupp', { type: 'repairService', siteId: x.id }) + goSite(x.id),
      });
  }
  if (v.me.board.length < v.me.seats && !v.over)
    out.push({
      face: assistantPortrait(40),
      who: `${ASSISTANT.name} · ${ASSISTANT.role}`,
      text: 'Ein Platz im Vorstand ist frei. Ich habe Bewerbungen gesammelt.',
      buttons: open('board', 'Bewerbungen'),
      cls: 'quiet',
    });
  if (!out.length)
    out.push({
      face: assistantPortrait(40),
      who: `${ASSISTANT.name} · ${ASSISTANT.role}`,
      text: v.over ? 'Das Spiel ist vorbei. Ein neues Kapitel?' : 'Alles erledigt. Zeit für neue Flächen?',
      buttons: v.over
        ? '<button class="btn small" data-act="newGameDlg">Neues Spiel</button>'
        : open('sites', 'Zur Landkarte'),
      cls: 'quiet',
    });
  return out;
}

/** The speech bubbles of the board (at most `max`, the rest as a link to the sites). */
export function boardTalk(max = 3): string {
  const all = bubbles(),
    more = all.length - max;
  return `<div class="talk" aria-live="polite">${all
    .slice(0, max)
    .map(
      (b) =>
        `<div class="say ${b.cls ?? ''}">${b.face}<div><div class="who">${b.who}</div><p>${b.text}</p><div class="row">${b.buttons}</div></div></div>`,
    )
    .join(
      '',
    )}${more > 0 ? `<button class="linkish more" data-act="tab" data-v="sites">+ ${more} weitere Aufgabe${more > 1 ? 'n' : ''}</button>` : ''}</div>`;
}

/** Desktop main view: the office, the board talking over its left side. */
export function vOffice(): string {
  return `<div class="office-wrap">${officeScene()}${boardTalk()}</div>`;
}
