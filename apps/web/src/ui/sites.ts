/** Sites (the map table): region cards, landscape with clickable plots and the detail card of the selected site. */
import {
  costsFor,
  isStore,
  LARGE,
  operating,
  PLANT_SIZE_KEYS,
  plantDef,
  REGION_KEYS,
  REGIONS,
  repowerMw,
  SITES_PER_REGION,
  STORE_MARKET_SHARE,
  TRICK_KEYS,
  type ActionOption,
  type PlantType,
  type RegionKey,
  type SiteView,
} from '@power-tycoon/engine';
import { esc, money, mwh, pct, QN } from '../format.js';
import { playerColor } from '../players.js';
import { geo, quad, redrawStill } from '../scene/index.js';
import { UI } from '../state.js';
import {
  DUEL_HINT,
  PLANT_NAME,
  REGION_TEXT,
  reservationText,
  siteName,
  siteQuality,
  SIZE_NAME,
  sizeSuffix,
} from '../texts.js';
import { crest } from './companies.js';
import { btn, disabledUnless, fundsHint, shortName, siteOptions, siteStatus, V } from './common.js';

function gridBar(r: RegionKey): string {
  const g = V().grid[r],
    cap = g.capacity;
  const seg = V()
    .players.map((p) => ({ c: playerColor(p.id), mw: g.usedBy[p.id] ?? 0 }))
    .filter((s) => s.mw > 0);
  // used and reserved capacity in the bar's tooltip, so the row above the map stays flat
  const detail = `${g.used} MW belegt + ${g.reserved} MW reserviert von ${cap} MW`;
  return `<div class="gridwrap" title="${detail}"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span class="label">Netz</span><span style="font-size:12px"><span class="mono">${g.free} MW</span> <span class="muted">frei für dich</span>${g.myReserved ? ' ' + info(`Davon ${reservationText(g.myReservations)}.`) : ''}</span></div>
    <div class="gridbar" role="img" aria-label="${detail}">${seg.map((s) => `<i style="width:${(s.mw / cap) * 100}%;background:${s.c}"></i>`).join('')}${g.reserved ? `<i class="res" style="width:${(g.reserved / cap) * 100}%"></i>` : ''}</div></div>`;
}
export function ownBar(r: RegionKey): string {
  const Sx = V().sites.filter((x) => x.r === r);
  return `<span class="obar" aria-hidden="true">${V()
    .players.map((p) => {
      const n = Sx.filter((x) => x.owner === p.id).length;
      return n ? `<i style="width:${(n / Sx.length) * 100}%;background:${playerColor(p.id)}"></i>` : '';
    })
    .join('')}</span>`;
}
/** A small (i) that shows a longer explanation on hover or focus. */
function info(text: string): string {
  return `<span class="info" tabindex="0" role="note" aria-label="${esc(text)}">i<span class="tip" aria-hidden="true">${esc(text)}</span></span>`;
}
export function vSites(): string {
  const v = V(),
    r = UI.region,
    R = REGIONS[r];
  // the regions as picture cards, each with its own little landscape
  const cards = REGION_KEYS.map((k) => {
    const n = v.sites.filter((x) => x.r === k && x.owner === v.playerId).length;
    // the region's description appears next to the card on hover
    return `<div class="rcwrap"><button class="rcard" aria-pressed="${k === r}" data-act="region" data-v="${k}" aria-description="${esc(REGION_TEXT[k].desc)}"><canvas data-scene="${k}" data-mini="1" aria-hidden="true"></canvas><span class="rcap"><b>${REGION_TEXT[k].name}</b><span class="n">${n}/${SITES_PER_REGION}</span>${ownBar(k)}</span></button><span class="tip" aria-hidden="true">${REGION_TEXT[k].desc} ★ markiert deine Flächen.</span></div>`;
  }).join('');
  const climate = [
    R.wind
      ? `<span class="ctok" title="Wind (üblich – einzelne Flächen liegen deutlich darunter oder darüber)"><i aria-hidden="true">≋</i><span class="label">Wind</span>${R.wind[0].toLocaleString('de-DE')}–${R.wind[1].toLocaleString('de-DE')} m/s</span>`
      : '',
    R.sun
      ? `<span class="ctok" title="Sonne (üblich – einzelne Flächen liegen deutlich darunter oder darüber)"><i aria-hidden="true">☀</i><span class="label">Sonne</span>${R.sun[0]}–${R.sun[1]} kWh/kWp</span>`
      : '',
  ].join('');
  const G = v.grid[r];
  // what the region's plants mean for new projects: more resistance, cheaper solar power
  const pressure = [
    G.crowding >= 0.005
      ? `<span class="ctok warn" title="Viele Anlagen in der Region: Genehmigungen werden öfter abgelehnt"><i aria-hidden="true">§</i><span class="label">Widerstand</span>+${pct(G.crowding, 0)} Ablehnung</span>`
      : '',
    G.solarLoss >= 0.005
      ? `<span class="ctok warn" title="${G.solarMw} MW Solar drücken mittags den Preis. Speicher in der Region fangen einen Teil ab."><i aria-hidden="true">☀</i><span class="label">Solarschwemme</span>−${pct(G.solarLoss, 0)} Solarerlös</span>`
      : '',
  ].join('');
  return `<div class="sites">
    <nav class="rcards" aria-label="Region">${cards}</nav>
    <section class="rboard">
      <div class="rinfo">
        <div class="rclimate">${climate}${pressure}</div>
        ${gridBar(r)}
        <button class="btn small reserve" data-act="reserve" data-v="${r}" title="Hält ${v.constants.reserveMw} MW Netzkapazität ${v.constants.reserveQuarters} Quartale für dich frei" ${disabledUnless({ type: 'reserveGrid', region: r })}>${v.constants.reserveMw} MW reservieren <small>${money(v.constants.reserveCost, true)}</small></button>
      </div>
      <div class="scene"><canvas data-scene="${r}" aria-hidden="true"></canvas><div class="hits">${hits(r)}</div>
        <div class="rplate"><b>${REGION_TEXT[r].name}</b><span>${R.types.map((t) => PLANT_NAME[t]).join(' · ')}</span></div>
      </div>
    </section>
    <aside class="panel" id="detail">${detail()}</aside>
  </div>`;
}
/**
 * Selects a plot without re-rendering the view: only the hit highlight and the detail panel change,
 * so the landscape canvas keeps running instead of flickering.
 */
export function selectSite(id: string): boolean {
  const panel = document.getElementById('detail');
  if (!panel) return false;
  document.querySelectorAll<HTMLElement>('.hits .hit').forEach((h) => h.classList.toggle('sel', h.dataset.v === id));
  panel.innerHTML = detail();
  redrawStill();
  return true;
}
/** Always-visible clipboard mark on free plots the player has already surveyed. */
const SURVEY_MARK =
  '<i class="svy" title="Ertragsgutachten liegt vor"><svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="9" rx="1"/><path d="M4.5 1.2h3v1.6h-3zM4 6.2l1.4 1.4L8 5"/></svg></i>';
/** Margin of a plot's button around the plot (percent of the scene; the gaps between plots are wider). */
const HIT_PAD_X = 0.6;
const HIT_PAD_Y = 2;
function hits(r: RegionKey): string {
  const g = geo(100, 100),
    v = V();
  return v.sites
    .filter((x) => x.r === r)
    .map((x) => {
      // the button covers the plot with a margin into the gaps, so its corner lights and edges select it too
      const qd = quad(g, x.i),
        l = g.X(qd.u0, qd.cy) - HIT_PAD_X,
        w = g.X(qd.u1, qd.cy) - l + HIT_PAD_X,
        s = siteStatus(x),
        own = x.owner >= 0;
      const o = own ? v.players[x.owner]! : null,
        svy = !own && x.surveyed,
        val = !own ? (svy ? siteQuality(x) + ' · ' : '') + money(x.lease, true) : o!.human ? s.t : esc(shortName(o!));
      return `<button class="hit ${UI.sel === x.id ? 'sel' : ''}" style="left:${l}%;top:${qd.y0 - HIT_PAD_Y}%;width:${w}%;height:${qd.y1 - qd.y0 + 2 * HIT_PAD_Y}%" data-act="sel" data-v="${x.id}" aria-label="${siteName(x)}: ${own ? (o!.human ? 'deine Fläche' : 'gehört ' + esc(o!.name)) + ', ' + s.t : 'frei, ' + s.t}${svy ? ', Ertragsgutachten liegt vor' : ''}">
      <span class="stag">${siteName(x)}${own && s.k === 'bad' ? '<i class="alert">!</i>' : ''}${svy ? SURVEY_MARK : ''}<span class="sval">${val}</span></span></button>`;
    })
    .join('');
}
/** Which own plants feed a storage in region `r`, and what happens without them. */
function storeFeeders(r: RegionKey): string {
  const v = V(),
    feeders = v.sites.filter((s) => s.owner === v.playerId && s.r === r && s.type && !isStore(s.type) && operating(s));
  const rule = `Ohne eigenen Strom kauft der Speicher an der Börse – das bringt nur ${Math.round(STORE_MARKET_SHARE * 100)} % des Preisvorteils.`;
  return feeders.length
    ? `Lädt mit Strom deiner Anlagen ${feeders.map(siteName).join(', ')} und verkauft ihn zu teuren Zeiten – dafür gibt es den vollen Spread. ${rule}`
    : `Keine eigene Anlage in dieser Region liefert Strom. ${rule} Bau hier eigene Kraftwerke dazu.`;
}
/** Odds of the automatic assembly of a wind plant, if the player does not play the minigames. */
function buildHint(x: SiteView): string {
  const v = V();
  if (!v.autoOdds || !x.type || plantDef(x.type, x.size).cls !== 'wind') return '';
  return `<p class="hint">Montage gelingt mit ${pct(v.autoOdds.rotor, 0)} (Minispiele ausgewürfelt) – sonst kostet ein weiterer Versuch ${money(costsFor(v, x.size)[x.type].retry, true)}.</p>`;
}

/** Facts and actions of the selected site. The actions are exactly the engine's options for it. */
function detail(): string {
  const v = V();
  const x = v.sites.find((s) => s.id === UI.sel);
  if (!x)
    return `<h3>Standort wählen</h3><p class="muted">Tipp auf eine Fläche, um Details zu sehen.</p>
    <dl class="facts"><dt>1. Pachten</dt><dd>Fläche sichern</dd><dt>2. Genehmigung</dt><dd>1–5 Quartale</dd><dt>3. Bauen</dt><dd>Standortsuche & Montage</dd><dt>4. Netz</dt><dd>Anschluss-Puzzle</dd></dl>`;
  const s = siteStatus(x),
    own = x.owner >= 0,
    mine = x.owner === v.playerId;
  const o = own ? v.players[x.owner]! : null;
  const band = own
    ? `<div class="oband" style="--oc:${playerColor(x.owner)}">${crest(x.owner, 34)}<span><span class="label">${mine ? 'Deine Fläche' : 'Gepachtet von'}</span><b>${esc(o!.name)}</b></span></div>`
    : `<div class="oband free"><i class="mb"></i><span><span class="label">Freie Fläche</span><b>Noch nicht verpachtet</b></span></div>`;
  let f = `<dt>Region</dt><dd>${REGION_TEXT[x.r].name}</dd><dt>Pacht</dt><dd>${money(x.lease)}</dd>`;
  if (x.known) {
    if (x.wind != null) f += `<dt>Windgeschwindigkeit</dt><dd>${x.wind.toLocaleString('de-DE')} m/s</dd>`;
    if (x.sun != null) f += `<dt>Globalstrahlung</dt><dd>${x.sun} kWh/kWp</dd>`;
    if (x.r === 'al') f += `<dt>Gefälle für Wasserkraft</dt><dd>${x.hydro ? 'ja' : 'nein'}</dd>`;
  } else f += `<dt>Ertrag</dt><dd>unbekannt</dd>`;
  if (mine && x.type && x.own) {
    const P = plantDef(x.type, x.size);
    f += `<dt>Anlage</dt><dd>${PLANT_NAME[x.type]}${sizeSuffix(x.size)}</dd><dt>Leistung</dt><dd>${P.mw} MW${P.mwh ? ' / ' + P.mwh + ' MWh' : ''}</dd>`;
    if (x.offline > 0) f += `<dt>Repowering</dt><dd>noch ${x.offline} Q außer Betrieb</dd>`;
    if (x.own.alt) f += `<dt>Neuer Antrag</dt><dd>${PLANT_NAME[x.own.alt.type]} · noch ${x.own.alt.left} Q</dd>`;
    if (x.own.permitRisk != null)
      f += `<dt>Ablehnungsrisiko</dt><dd>${pct(x.own.permitRisk, 0)} · Entscheidung in ${Math.max(1, x.own.permitLeft)} Q</dd>`;
    if (x.built) f += `<dt>Wirkungsgrad</dt><dd>${Math.round(x.own.eff * 100)} %</dd>`;
    if (operating(x))
      f += isStore(x.type)
        ? `<dt>Speicherertrag/Quartal ${info(storeFeeders(x.r))}</dt><dd>≈ ${money(x.own.storeRevenue, true)}</dd><dt>Eigener Strom</dt><dd>≈ ${mwh(x.own.storeOwnMwh)} von ${mwh(x.own.storeCapacity)}</dd>`
        : `<dt>Erzeugung ${QN[v.q]}</dt><dd>≈ ${mwh(x.own.genEstimate)}</dd>`;
    f += `<dt>Wert</dt><dd>${money(x.own.value, true)}</dd>`;
  }
  if (x.intel && x.type) {
    // from a spy report on the owner
    f += `<dt>Anlage</dt><dd>${PLANT_NAME[x.type]}${sizeSuffix(x.size)} · ${x.mw} MW</dd>`;
    if (x.built)
      f += `<dt>Wirkungsgrad</dt><dd>${Math.round(x.intel.eff * 100)} % <span class="chip sab">Spionage</span></dd>`;
    else if (x.permit === 'pending')
      f += `<dt>Genehmigung</dt><dd>noch ${Math.max(1, x.intel.permitLeft)} Q <span class="chip sab">Spionage</span></dd>`;
  }
  if (x.peace > 0 && !x.built && x.permit) f += `<dt>Vor Klagen geschützt</dt><dd>noch ${x.peace} Q</dd>`;
  const regionTypes = REGIONS[x.r].types;
  // permit buttons carry the chosen size
  const pv = (t: PlantType) => `${x.id}|${t}|${UI.size}`;
  const risk = (t: PlantType) => x.permitRisk?.[t]?.[UI.size];
  const pname = (t: PlantType) =>
    `${PLANT_NAME[t]} · ${plantDef(t, UI.size).mw} MW${risk(t) != null ? `<span class="sub">Ablehnungsrisiko ${pct(risk(t)!, 0)}</span>` : ''}`;
  const permits: { t: PlantType; opt: ActionOption }[] = [];
  const a: string[] = [];
  for (const opt of siteOptions(x.id)) {
    const act = opt.action;
    switch (act.type) {
      case 'survey':
        a.push(btn('survey', x.id, 'Ertragsgutachten', opt));
        a.push(
          `<p class="muted" style="font-size:12px;margin:0">Noch ${v.me.surveysLeft} von ${v.me.surveyLimit} Gutachten in diesem Quartal.</p>`,
        );
        break;
      case 'lease':
        a.push(btn('lease', x.id, 'Pachtvertrag unterschreiben', opt, { cls: 'primary' }), fundsHint(opt));
        break;
      case 'applyPermit':
        if ((act.size ?? 'std') === UI.size) permits.push({ t: act.plantType, opt });
        break;
      case 'changePlantType':
        a.push(btn('retype', x.id, 'Anderen Anlagentyp wählen', opt));
        break;
      case 'build':
        a.push(
          btn('build', x.id, x.fail ? 'Montage wiederholen' : 'Bauen: ' + PLANT_NAME[x.type!], opt, { cls: 'primary' }),
          fundsHint(opt),
          buildHint(x),
        );
        break;
      case 'connectGrid':
        a.push(btn('connect', x.id, 'Ans Netz anschließen', opt, { cls: 'primary' }), fundsHint(opt));
        if (v.autoOdds && opt.error !== 'noGridCapacity')
          a.push(
            `<p class="hint">Erfolgschance ${pct(x.own?.duelRisk ? v.autoOdds.cableDuel : v.autoOdds.cable, 0)} (Minispiele ausgewürfelt) – scheitert der Anschluss, ${x.own?.duelRisk ? 'gibt es nur die Hälfte zurück' : 'ist das Geld weg'}.</p>`,
          );
        if (opt.error === 'noGridCapacity')
          a.push(
            `<p class="muted" style="font-size:12px;margin:0">Nicht genug freie Netzkapazität (${x.mw} MW nötig). Warte auf Netzausbau oder reserviere rechtzeitig.</p>`,
          );
        else if (x.own?.duelRisk) a.push(`<p class="duelhint" style="font-size:12px;margin:0">⚔ ${DUEL_HINT}</p>`);
        break;
      case 'repower': {
        const L = plantDef(x.type!, 'large');
        a.push(
          `<div class="withinfo">${btn('repower', x.id, `Repowering auf ${L.mw} MW`, opt)}${info(
            opt.error === 'noGridCapacity'
              ? `Für das Repowering fehlen ${repowerMw(x.type!)} MW freie Netzkapazität.`
              : `Größere Anlage auf derselben Fläche: +${repowerMw(x.type!)} MW, dafür ein Quartal Stillstand.`,
          )}</div>`,
          fundsHint(opt),
        );
        break;
      }
      case 'repairSelf':
        a.push(btn('fixSelf', x.id, 'Netz selbst stabilisieren', opt, { cls: 'primary' }));
        break;
      case 'repairService':
        a.push(btn('fixPro', x.id, 'Servicetrupp (sicher)', opt));
        break;
      case 'sellSite':
        a.push(
          btn('sellSite', x.id, 'Projekt verkaufen', opt, { cls: 'danger', confirm: true, price: -x.own!.sellValue }),
        );
        break;
      default:
        break;
    }
  }
  // permit options first, in the region's order of plant types
  permits.sort((p, q) => regionTypes.indexOf(p.t) - regionTypes.indexOf(q.t));
  // change of mind: apply for another type while a permit is running or granted (offered below the main actions)
  const rethink = !!x.type && x.permit !== 'rejected';
  if (rethink && permits.length) {
    a.push(
      `<p class="label" style="margin:6px 0 0">Umplanen – stattdessen beantragen ${info(
        x.permit === 'approved'
          ? `Die Genehmigung für ${PLANT_NAME[x.type!]} bleibt gültig, bis über den neuen Antrag entschieden ist.${x.own?.alt ? ' Bauen verwirft den laufenden Antrag.' : ''}`
          : 'Ein neuer Antrag ersetzt den laufenden – dessen Kosten sind verloren.',
      )}</p>`,
      ...permits.map(({ t, opt }) => btn('permit', pv(t), pname(t), opt)),
    );
    permits.length = 0;
  }
  const permitButtons = permits.map(({ t, opt }) =>
    x.type
      ? btn('permit', pv(t), 'Erneut beantragen: ' + pname(t), opt, { cls: 'primary' })
      : btn('permit', pv(t), 'Antrag unterschreiben: ' + pname(t), opt, {
          cls: t === regionTypes[0] ? 'primary' : '',
        }),
  );
  const costs = costsFor(v, UI.size);
  if (permits.length && !x.type)
    permitButtons.push(
      `<p class="muted" style="font-size:12px;margin:0">Bau ab ≈ ${permits.map(({ t }) => `${PLANT_NAME[t]} (${plantDef(t, UI.size).mw} MW) ${money(costs[t].build, true)}`).join(', ')}</p>`,
    );
  // missing money for the cheapest permit (the others cost more)
  const cheapest = permits.slice().sort((p, q) => p.opt.cost - q.opt.cost)[0];
  if (cheapest) permitButtons.push(fundsHint(cheapest.opt));
  a.unshift(...permitButtons);
  // the size applies to all permit buttons
  if (siteOptions(x.id).some((o) => o.action.type === 'applyPermit'))
    a.unshift(
      `<div class="sizes" role="group" aria-label="Anlagengröße">${PLANT_SIZE_KEYS.map((k) => `<button class="sizeopt" aria-pressed="${UI.size === k}" data-act="size" data-v="${k}"><b>${SIZE_NAME[k]}</b><span class="muted">${k === 'std' ? 'schnell genehmigt, später aufrüstbar' : `+${Math.round((LARGE.mw - 1) * 100)} % Leistung, etwas günstiger je MW – Genehmigung dauert länger, scheitert öfter`}</span></button>`).join('')}</div>`,
    );
  if (own && !mine) {
    const lt = TRICK_KEYS.find((k) => siteOptions(x.id).some((o) => o.action.type === 'lobby' && o.action.trick === k));
    if (lt)
      a.push(
        `<button class="btn" data-act="trickGo" data-v="${x.id}|${lt}"><span>Lobby-Aktion planen …</span></button>`,
      );
  }
  return `${band}<div class="phead"><h3>${siteName(x)}</h3><span class="chip ${s.k}">${s.t}</span></div><dl class="facts">${f}</dl>${mine ? stamps(x) : ''}<div class="actions">${a.join('')}</div>`;
}

/** The stamps on the papers of an own site: lease contract and the authority's decision. */
function stamps(x: SiteView): string {
  const s: string[] = ['<span class="stampmark green">Gepachtet</span>'];
  if (x.type && !x.built) {
    if (x.permit === 'pending') s.push('<span class="stampmark grey">Antrag eingegangen</span>');
    else if (x.permit === 'approved') s.push('<span class="stampmark">Genehmigt</span>');
    else if (x.permit === 'rejected') s.push('<span class="stampmark">Abgelehnt</span>');
  }
  if (x.built) s.push(`<span class="stampmark ${x.grid ? 'green' : 'grey'}">${x.grid ? 'Am Netz' : 'Gebaut'}</span>`);
  return `<div class="stamps" aria-label="Stempel auf der Akte">${s.join('')}</div>`;
}
