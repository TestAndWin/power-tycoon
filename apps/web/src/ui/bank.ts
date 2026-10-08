/** Bank tab: loan, credit limit, borrowing and repaying. */
import { INTEREST_FREE_SHARE, PLANT_BOOK, PLANT_BOOK_MIN, PLANT_DEPRECIATION, rateFor } from '@power-tycoon/engine';
import { money, pct as pctOf } from '../format.js';
import { disabledUnless, meP, V } from './common.js';

const pct = (x: number): string => pctOf(x, 2);

const BORROW_STEPS = [5e6, 20e6, 50e6];
const REPAY_STEPS = [5e6, 20e6];

export function vBank(): string {
  const v = V(),
    P = meP(),
    C = v.constants,
    cr = v.me.credit,
    lim = v.me.creditLimit,
    free = Math.max(0, lim - P.loan);
  return `<div class="grid g2e"><section class="panel stack"><h2>Hausbank</h2>
    <dl class="facts"><dt>Kasse</dt><dd class="${P.cash < 0 ? 'down' : ''}">${money(P.cash)}</dd><dt>Kredit</dt><dd>${money(P.loan)}</dd><dt>Kreditrahmen</dt><dd>${money(lim)}</dd><dt>Noch verfügbar</dt><dd>${money(free)}</dd><dt>Zinssatz</dt><dd>${pct(v.me.interest)} / Quartal</dd><dt>Zinslast</dt><dd>${money(P.loan * v.me.interest)} / Quartal</dd></dl>
    <p class="muted" style="margin:0">Bis ${pct(INTEREST_FREE_SHARE)} des Rahmens zahlst du ${pct(C.interest)}. Nutzt du mehr, wird der ganze Kredit teurer: ${pct(rateFor(lim * 0.75, lim))} bei drei Vierteln, ${pct(C.interest + C.interestRisk)} bei vollem Rahmen.${free > 0 ? ` Schöpfst du den Rahmen aus, zahlst du ${money(lim * rateFor(lim, lim), true)} Zinsen je Quartal.` : ''}</p>
    <div class="row">${borrowButtons(free)}</div>
    <div class="row">${repayButtons(P.loan)}</div>
  </section><section class="panel stack"><h3 style="margin-bottom:0">So setzt sich dein Rahmen zusammen</h3>
    <dl class="facts"><dt>Anlagen &amp; Flächen (${pct(C.creditAssets)} des Buchwerts)</dt><dd>${money(cr.assets)}</dd><dt>Ertrag (${C.creditSales}× Ø Stromerlös der letzten ${C.creditSalesQuarters} Quartale)</dt><dd>${money(cr.sales)}</dd><dt>Förderkredit (Aufholbonus)</dt><dd>${cr.boost ? money(cr.boost) : '–'}</dd></dl>
    <p class="muted" style="margin:0">Buchwert: Eine neue Anlage zählt nur noch ${pct(PLANT_BOOK)} der Baukosten und verliert je Betriebsquartal ${pct(PLANT_DEPRECIATION)} davon, bis ${pct(PLANT_BOOK_MIN)}. Bauen kurz vor Schluss kostet also Vermögen.</p>
    <p class="muted" style="margin:0">Die Kasse zählt nicht: Geliehenes Geld erhöht den Rahmen nicht. Liegt dein Firmenwert mindestens ${pct(C.creditBoostFrom)} hinter dem Spitzenreiter, gibt die Förderbank ${pct(C.creditBoost)} des Rückstands dazu. Der Rahmen beträgt mindestens ${money(C.minCredit)}.</p>
    <p class="muted" style="margin:0">Rutscht die Kasse zum Quartalsende ins Minus, gibt es einen Notkredit. Reicht der Rahmen nicht, ist dein Konzern insolvent.</p></section></div>`;
}

/**
 * Fixed amounts only below the free credit, then "Rahmen ausschöpfen" with the exact rest (in whole euros).
 * Without free credit all fixed buttons stay visible but disabled.
 */
function borrowButtons(free: number): string {
  const rest = Math.floor(free);
  const fixed = BORROW_STEPS.filter((a) => !rest || a < rest).map(
    (a) =>
      `<button class="btn" data-act="borrow" data-v="${a}" ${disabledUnless({ type: 'borrow', amount: a })}>+ ${money(a, true)}</button>`,
  );
  const all = rest
    ? `<button class="btn" data-act="borrow" data-v="${rest}" ${disabledUnless({ type: 'borrow', amount: rest })}>Rahmen ausschöpfen <small>${money(rest, true)}</small></button>`
    : '';
  return fixed.join('') + all;
}

/**
 * Fixed amounts only below the loan (a larger amount would repay the rest, which "Alles tilgen" does
 * with the exact amount). Without a loan all buttons stay visible but disabled.
 */
function repayButtons(loan: number): string {
  const fixed = REPAY_STEPS.filter((a) => !loan || a < loan).map(
    (a) =>
      `<button class="btn" data-act="repay" data-v="${a}" ${disabledUnless({ type: 'repay', amount: a })}>${money(a, true)} tilgen</button>`,
  );
  const all = `<button class="btn" data-act="repay" data-v="all" ${disabledUnless({ type: 'repay', amount: 'all' })}>Alles tilgen${loan ? ` <small>${money(loan, true)}</small>` : ''}</button>`;
  return fixed.join('') + all;
}
