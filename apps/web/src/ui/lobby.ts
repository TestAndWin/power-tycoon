/** Lobby tab: spy on rivals, choose a trick and a target, protect yourself with detectives. */
import { DETECTIVE_KEYS, TRICK_KEYS, trickTargetIds, type PlayerSummary } from '@power-tycoon/engine';
import { esc, money, turnStr } from '../format.js';
import { UI } from '../state.js';
import { DETECTIVE_TEXT, detectivesText, PLANT_NAME, siteName, TRICK_TEXT } from '../texts.js';
import { disabledUnless, optionFor, V } from './common.js';
import { crest } from './companies.js';

function spyRow(p: PlayerSummary): string {
  const v = V(),
    I = p.intel;
  const facts = I
    ? `<span class="muted">Bericht bis ${turnStr(v.startYear, I.until)} · ${I.contracts.length} Liefervertr${I.contracts.length === 1 ? 'ag' : 'äge'} · ${detectivesText(I.detectives)} · ${I.tricksLeft} Tricks frei</span>`
    : '<span class="muted">Kein aktueller Bericht. Ohne Bericht keine Lobby-Aktion gegen diesen Konzern.</span>';
  const spy = { type: 'spy', targetId: p.id } as const;
  return `<li class="spyrow">${crest(p.id, 22)}<span class="stack" style="gap:2px"><b>${esc(p.name)}</b>${facts}</span>${
    I
      ? '<span class="chip good">Bericht liegt vor</span>'
      : `<button class="btn" data-act="spy" data-v="${p.id}" ${disabledUnless(spy)}><span>Spion schicken</span><small>${money(v.constants.spyCost, true)}</small></button>`
  }</li>`;
}

function detectives(): string {
  const v = V(),
    mine = v.me.detectives;
  const status = mine
    ? `<p style="margin:0"><span class="chip good">Aktiv</span> ${DETECTIVE_TEXT[mine.level].name} schützt dich noch ${mine.left} Quartal${mine.left > 1 ? 'e' : ''}.</p>`
    : '<p class="muted" style="margin:0">Keine Detektei unter Vertrag. Tricks und Spione der Konkurrenz treffen dich ungeschützt.</p>';
  const offers = DETECTIVE_KEYS.map((k) => {
    const D = v.detectives[k],
      opt = optionFor({ type: 'hireDetectives', level: k });
    if (!opt) return '';
    return `<button class="sabopt" data-act="hire" data-v="${k}" ${disabledUnless(opt.action)}><b>${DETECTIVE_TEXT[k].name}</b><span class="mono">${money(D.cost, true)} · ${v.constants.detectiveQuarters} Q</span><span class="muted" style="font-size:12px">${DETECTIVE_TEXT[k].desc} Erfolgschance gegnerischer Tricks −${Math.round((1 - D.shield) * 100)} %, gescheiterte Täter fliegen zu ${Math.round(D.catchFailed * 100)} % auf.</span></button>`;
  }).join('');
  return `<section class="panel stack"><div class="phead"><h3>Detektive</h3></div>${status}${offers ? `<div class="sab">${offers}</div>` : ''}</section>`;
}

export function vLobby(): string {
  const v = V(),
    T = v.tricks[UI.trick],
    ts = trickTargetIds(v, UI.trick)
      .map((id) => v.sites.find((s) => s.id === id)!)
      .filter(Boolean);
  if (UI.target && !ts.find((x) => x.id === UI.target)) UI.target = '';
  const opts = ts
    .map(
      (x) =>
        `<option value="${x.id}" ${UI.target === x.id ? 'selected' : ''}>${siteName(x)} · ${PLANT_NAME[x.type!]} · ${esc(v.players[x.owner]!.name)}${v.players[x.owner]!.intel ? '' : ' (kein Bericht)'}</option>`,
    )
    .join('');
  const target = v.sites.find((s) => s.id === UI.target);
  const noReport =
    !!target && optionFor({ type: 'lobby', trick: UI.trick, siteId: target.id })?.error === 'noSpyReport';
  const rivals = v.players.filter((p) => p.id !== v.playerId && !p.out);
  return `<div class="grid g2"><section class="panel stack">
    <div class="phead"><h2>Lobby & Tricks</h2><span class="muted">${v.me.tricksLeft} Aktionen in diesem Quartal übrig</span></div>
    <div class="sab">${TRICK_KEYS.map((k) => `<button class="sabopt" aria-pressed="${UI.trick === k}" data-act="trick" data-v="${k}"><b>${TRICK_TEXT[k].name}</b><span class="mono">${money(v.tricks[k].cost, true)} · ${Math.round(v.tricks[k].chance * 100)} %</span><span class="muted" style="font-size:12px">${TRICK_TEXT[k].desc}</span></button>`).join('')}</div>
    <label for="trickTarget" class="label">Ziel</label>
    <select id="trickTarget" data-act="trickTarget">${ts.length ? '<option value="">Projekt wählen …</option>' + opts : '<option value="">Gerade kein passendes Ziel</option>'}</select>
    ${noReport ? `<p class="muted" style="margin:0;font-size:12px">Über ${esc(v.players[target!.owner]!.name)} liegt kein Spionagebericht vor – erst einen Spion schicken.</p>` : ''}
    <div class="row"><button class="btn primary big" data-act="doTrick" ${UI.target ? disabledUnless({ type: 'lobby', trick: UI.trick, siteId: UI.target }) : 'disabled'}>Auftrag vergeben · ${money(T.cost, true)}</button></div>
  </section><section class="panel stack"><div class="phead"><h3>Spionage</h3><span class="muted">${money(v.constants.spyCost, true)} · ${v.constants.spyQuarters} Quartale gültig</span></div>
    <p class="muted" style="margin:0">Ein Spion liefert Standortdaten, Wirkungsgrade, Genehmigungsstände und Lieferverträge eines Konzerns – und ist Voraussetzung für jede Lobby-Aktion gegen ihn. Detektive des Ziels können ihn enttarnen.</p>
    <ul class="list spylist">${rivals.map(spyRow).join('')}</ul>
  </section></div>
  <div class="grid g2" style="margin-top:16px">${detectives()}<section class="panel"><h3 style="margin-bottom:8px">Risiko</h3>
    <p class="muted" style="margin:0 0 8px">Eine Klage ist legal: Scheitert sie, ist nur das Geld weg. Eine aufgeflogene Bürgerinitiative kostet ${money(v.tricks.bi.fine, true)} Strafe und ${money(v.tricks.bi.damages, true)} Schadensersatz, ein aufgeflogener Hackerangriff ${money(v.tricks.hack.fine, true)} Strafe und ${money(v.tricks.hack.damages, true)} Schadensersatz an das Opfer. Hat das Ziel Detektive, gelingen Tricks seltener und Täter fliegen öfter auf – manchmal sogar nach einem Erfolg.</p>
    <p class="muted" style="margin:0">Sicherer spielst du mit Netzreservierungen unter Standorte: Wer die Kapazität hat, bekommt den Anschluss.</p></section></div>`;
}
