/** Sites tab: region selector, landscape with clickable plots and the detail panel of the selected site. */
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
} from '@power-tycoon/engine';
import { esc, money, mwh, QN } from '../format.js';
import { playerColor } from '../players.js';
import { geo, quad, redrawStill } from '../scene/index.js';
import { UI } from '../state.js';
import { DUEL_HINT, PLANT_NAME, REGION_TEXT, siteName, siteQuality, SIZE_NAME, sizeSuffix } from '../texts.js';
import { crest } from './companies.js';
import { btn, disabledUnless, shortName, siteOptions, siteStatus, V } from './common.js';

function gridBar(r: RegionKey): string {
  const g = V().grid[r],
    cap = g.capacity;
  const seg = V()
    .players.map((p) => ({ c: playerColor(p.id), mw: g.usedBy[p.id] ?? 0 }))
    .filter((s) => s.mw > 0);
  return `<div class="gridwrap"><div class="row" style="justify-content:space-between"><span class="label">Netzkapazität</span><span class="mono" style="font-size:12px">${g.used} + ${g.reserved} res. / ${cap} MW</span></div>
    <div class="gridbar" role="img" aria-label="${g.used} MW belegt, ${g.reserved} MW reserviert, ${cap} MW gesamt">${seg.map((s) => `<i style="width:${(s.mw / cap) * 100}%;background:${s.c}"></i>`).join('')}${g.reserved ? `<i class="res" style="width:${(g.reserved / cap) * 100}%"></i>` : ''}</div>
    <span class="muted" style="font-size:12px">Frei für dich: ${g.free} MW${g.myReserved ? ` (davon ${g.myReserved} MW reserviert)` : ''}</span></div>`;
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
function ownerLegend(r: RegionKey): string {
  const Sx = V().sites.filter((x) => x.r === r),
    free = Sx.filter((x) => x.owner < 0).length;
  return `<div class="olegend" aria-label="Flächen je Konzern">${V()
    .players.filter((p) => !p.out)
    .map((p) => {
      const n = Sx.filter((x) => x.owner === p.id).length;
      return `<span class="ochip${n ? '' : ' zero'}${p.human ? ' me' : ''}" style="--oc:${playerColor(p.id)}">${crest(p.id, 20)}${esc(p.human ? 'Du · ' + p.name : p.name)}<b>${n}</b></span>`;
    })
    .join('')}<span class="ochip free"><i class="mb"></i>Frei<b>${free}</b></span></div>`;
}
export function vSites(): string {
  const v = V(),
    r = UI.region,
    R = REGIONS[r];
  const pills = REGION_KEYS.map(
    (k) =>
      `<button class="rpill" aria-pressed="${k === r}" data-act="region" data-v="${k}">${REGION_TEXT[k].name}<span class="n">${v.sites.filter((x) => x.r === k && x.owner === v.playerId).length}/${SITES_PER_REGION}</span>${ownBar(k)}</button>`,
  ).join('');
  return `<div class="field-layout">
    <section class="panel">
      <div class="regions" role="group" aria-label="Region">${pills}</div>
      <p class="rdesc muted"><b>${R.types.map((t) => PLANT_NAME[t]).join(' · ')}</b> – ${REGION_TEXT[r].desc}</p>
      <div class="region-bar">
        <dl class="rclimate">${R.wind ? `<dt class="label">Wind</dt><dd class="mono">${R.wind[0].toLocaleString('de-DE')}–${R.wind[1].toLocaleString('de-DE')} m/s</dd>` : ''}${R.sun ? `<dt class="label">Sonne</dt><dd class="mono">${R.sun[0]}–${R.sun[1]} kWh/kWp</dd>` : ''}</dl>
        ${gridBar(r)}
        <button class="btn reserve" data-act="reserve" data-v="${r}" ${disabledUnless({ type: 'reserveGrid', region: r })}>${v.constants.reserveMw} MW reservieren <small>${money(v.constants.reserveCost, true)} · ${v.constants.reserveQuarters} Q</small></button>
      </div>
      <div class="scene"><canvas data-scene="${r}" aria-hidden="true"></canvas><div class="hits">${hits(r)}</div></div>
      ${ownerLegend(r)}
      <p class="muted" style="font-size:12px;margin:6px 0 0">Tipp auf eine Parzelle. Rahmen, Fahne und Etikett in Konzernfarbe zeigen, wem die Fläche gehört; ★ markiert deine eigenen.</p>
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
        svy = !own && x.surveyed,
        val = !own ? (svy ? siteQuality(x) + ' · ' : '') + money(x.lease, true) : o!.human ? s.t : esc(shortName(o!));
      return `<button class="hit ${UI.sel === x.id ? 'sel' : ''}" style="left:${l}%;top:${qd.y0}%;width:${w}%;height:${qd.y1 - qd.y0}%" data-act="sel" data-v="${x.id}" aria-label="${siteName(x)}: ${own ? (o!.human ? 'deine Fläche' : 'gehört ' + esc(o!.name)) + ', ' + s.t : 'frei, ' + s.t}${svy ? ', Ertragsgutachten liegt vor' : ''}">
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
    if (x.built) f += `<dt>Wirkungsgrad</dt><dd>${Math.round(x.own.eff * 100)} %</dd>`;
    if (operating(x))
      f += isStore(x.type)
        ? `<dt>Speicherertrag/Quartal</dt><dd>≈ ${money(x.own.storeRevenue, true)}</dd><dt>Eigener Strom</dt><dd>≈ ${mwh(x.own.storeOwnMwh)} von ${mwh(x.own.storeCapacity)}</dd>`
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
  const storeNote =
    mine && x.type && isStore(x.type)
      ? `<p class="muted" style="font-size:12px;margin:8px 0 0">${storeFeeders(x.r)}</p>`
      : '';
  const regionTypes = REGIONS[x.r].types;
  // permit buttons carry the chosen size
  const pv = (t: PlantType) => `${x.id}|${t}|${UI.size}`;
  const pname = (t: PlantType) => `${PLANT_NAME[t]} · ${plantDef(t, UI.size).mw} MW`;
  const permits: { t: PlantType; opt: ActionOption }[] = [];
  const a: string[] = [];
  for (const opt of siteOptions(x.id)) {
    const act = opt.action;
    switch (act.type) {
      case 'survey':
        a.push(btn('survey', x.id, 'Ertragsgutachten', opt));
        break;
      case 'lease':
        a.push(btn('lease', x.id, 'Fläche pachten', opt, { cls: 'primary' }));
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
        );
        break;
      case 'connectGrid':
        a.push(btn('connect', x.id, 'Ans Netz anschließen', opt, { cls: 'primary' }));
        if (opt.error === 'noGridCapacity')
          a.push(
            `<p class="muted" style="font-size:12px;margin:0">Nicht genug freie Netzkapazität (${x.mw} MW nötig). Warte auf Netzausbau oder reserviere rechtzeitig.</p>`,
          );
        else if (x.own?.duelRisk) a.push(`<p class="duelhint" style="font-size:12px;margin:0">⚔ ${DUEL_HINT}</p>`);
        break;
      case 'repower': {
        const L = plantDef(x.type!, 'large');
        a.push(btn('repower', x.id, `Repowering auf ${L.mw} MW`, opt));
        a.push(
          `<p class="muted" style="font-size:12px;margin:0">${
            opt.error === 'noGridCapacity'
              ? `Für das Repowering fehlen ${repowerMw(x.type!)} MW freie Netzkapazität.`
              : `Größere Anlage auf derselben Fläche: +${repowerMw(x.type!)} MW, dafür ein Quartal Stillstand.`
          }</p>`,
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
      `<p class="muted" style="font-size:12px;margin:6px 0 0">${
        x.permit === 'approved'
          ? `Umplanen: Die Genehmigung für ${PLANT_NAME[x.type!]} bleibt gültig, bis über den neuen Antrag entschieden ist.${x.own?.alt ? ' Bauen verwirft den laufenden Antrag.' : ''}`
          : 'Umplanen: Ein neuer Antrag ersetzt den laufenden – dessen Kosten sind verloren.'
      }</p>`,
      ...permits.map(({ t, opt }) => btn('permit', pv(t), 'Stattdessen beantragen: ' + pname(t), opt)),
    );
    permits.length = 0;
  }
  const permitButtons = permits.map(({ t, opt }) =>
    x.type
      ? btn('permit', pv(t), 'Erneut beantragen: ' + pname(t), opt, { cls: 'primary' })
      : btn('permit', pv(t), 'Genehmigung: ' + pname(t), opt, {
          cls: t === regionTypes[0] ? 'primary' : '',
        }),
  );
  const costs = costsFor(v, UI.size);
  if (permits.length && !x.type)
    permitButtons.push(
      `<p class="muted" style="font-size:12px;margin:0">Bau ab ≈ ${permits.map(({ t }) => `${PLANT_NAME[t]} (${plantDef(t, UI.size).mw} MW) ${money(costs[t].build, true)}`).join(', ')}</p>`,
    );
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
  return `${band}<div class="phead"><h3>${siteName(x)}</h3><span class="chip ${s.k}">${s.t}</span></div><dl class="facts">${f}</dl>${storeNote}<div class="actions">${a.join('')}</div>`;
}
