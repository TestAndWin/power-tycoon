/** Bank tab: loan, credit limit, borrowing and repaying. */
import { money } from '../format.js';
import { disabledUnless, meP, V } from './common.js';

const REPAY_STEPS = [5e6, 20e6];

export function vBank(): string {
  const v = V(),
    P = meP(),
    lim = v.me.creditLimit,
    free = Math.max(0, lim - P.loan);
  return `<div class="grid g2e"><section class="panel stack"><h2>Hausbank</h2>
    <dl class="facts"><dt>Kredit</dt><dd>${money(P.loan)}</dd><dt>Kreditrahmen</dt><dd>${money(lim)}</dd><dt>Noch verfügbar</dt><dd>${money(free)}</dd><dt>Zinsen</dt><dd>${(v.constants.interest * 100).toLocaleString('de-DE')} % / Quartal</dd><dt>Zinslast</dt><dd>${money(P.loan * v.constants.interest)} / Quartal</dd></dl>
    <div class="row">${[5e6, 20e6, 50e6].map((a) => `<button class="btn" data-act="borrow" data-v="${a}" ${disabledUnless({ type: 'borrow', amount: a })}>+ ${money(a, true)}</button>`).join('')}</div>
    <div class="row">${repayButtons(P.loan)}</div>
  </section><section class="panel"><h3 style="margin-bottom:8px">Projektfinanzierung</h3>
    <p class="muted" style="margin:0 0 8px">Der Rahmen beträgt 60 % deiner Vermögenswerte, mindestens ${money(v.constants.minCredit)}. Erneuerbare sind kapitalintensiv: Ein Offshore-Park lässt sich kaum ohne Kredit bauen.</p>
    <p class="muted" style="margin:0">Rutscht die Kasse zum Quartalsende ins Minus, gibt es einen Notkredit. Reicht der Rahmen nicht, ist dein Konzern insolvent.</p></section></div>`;
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
