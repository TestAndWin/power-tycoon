/** Lobby tab: choose a trick and a target. */
import { TRICK_KEYS, trickTargetIds } from '@power-tycoon/engine';
import { esc, money } from '../format.js';
import { UI } from '../state.js';
import { PLANT_NAME, siteName, TRICK_TEXT } from '../texts.js';
import { disabledUnless, V } from './common.js';

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
        `<option value="${x.id}" ${UI.target === x.id ? 'selected' : ''}>${siteName(x)} · ${PLANT_NAME[x.type!]} · ${esc(v.players[x.owner]!.name)}</option>`,
    )
    .join('');
  return `<div class="grid g2"><section class="panel stack">
    <div class="phead"><h2>Lobby & Tricks</h2><span class="muted">${v.me.tricksLeft} Aktionen in diesem Quartal übrig</span></div>
    <div class="sab">${TRICK_KEYS.map((k) => `<button class="sabopt" aria-pressed="${UI.trick === k}" data-act="trick" data-v="${k}"><b>${TRICK_TEXT[k].name}</b><span class="mono">${money(v.tricks[k].cost, true)} · ${Math.round(v.tricks[k].chance * 100)} %</span><span class="muted" style="font-size:12px">${TRICK_TEXT[k].desc}</span></button>`).join('')}</div>
    <label for="trickTarget" class="label">Ziel</label>
    <select id="trickTarget" data-act="trickTarget">${ts.length ? '<option value="">Projekt wählen …</option>' + opts : '<option value="">Gerade kein passendes Ziel</option>'}</select>
    <div class="row"><button class="btn primary big" data-act="doTrick" ${UI.target ? disabledUnless({ type: 'lobby', trick: UI.trick, siteId: UI.target }) : 'disabled'}>Auftrag vergeben · ${money(T.cost, true)}</button></div>
  </section><section class="panel"><h3 style="margin-bottom:8px">Risiko</h3>
    <p class="muted" style="margin:0 0 8px">Eine Klage ist legal: Scheitert sie, ist nur das Geld weg. Eine aufgeflogene Bürgerinitiative kostet ${money(v.tricks.bi.fine, true)} Imageschaden, ein aufgeflogener Hackerangriff ${money(v.tricks.hack.fine, true)} Strafe.</p>
    <p class="muted" style="margin:0">Sicherer spielst du mit Netzreservierungen unter Standorte: Wer die Kapazität hat, bekommt den Anschluss.</p></section></div>`;
}
