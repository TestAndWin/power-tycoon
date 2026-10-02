/** German number formatting, ported from legacy/src/core.js. */

export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function money(n: number, short?: boolean): string {
  const a = Math.abs(n);
  const s = n < 0 ? '−' : '';
  if (a >= 1e9)
    return s + (a / 1e9).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Mrd. €';
  if (a >= 1e6)
    return (
      s +
      (a / 1e6).toLocaleString('de-DE', {
        minimumFractionDigits: short ? 1 : 2,
        maximumFractionDigits: short ? 1 : 2,
      }) +
      ' Mio. €'
    );
  if (a >= 1e3) return s + Math.round(a / 1e3).toLocaleString('de-DE') + ' Tsd. €';
  return s + Math.round(a) + ' €';
}

export const mwh = (n: number): string =>
  n >= 1e6
    ? (n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' TWh'
    : n >= 1e3
      ? (n / 1e3).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' GWh'
      : Math.round(n).toLocaleString('de-DE') + ' MWh';

export const eur = (n: number): string =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €/MWh';

export const tons = (n: number): string =>
  n >= 1e6
    ? (n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' Mio. t'
    : Math.round(n).toLocaleString('de-DE') + ' t';

export const QN = ['Q1', 'Q2', 'Q3', 'Q4'];
export const qStr = (y: number, q: number): string => QN[q] + ' ' + y;

/** Chart label for history index i (index 0 = first quarter of the game). */
export function quarterLabel(startYear: number, i: number): string {
  const y = startYear + Math.floor(i / 4);
  return QN[i % 4] + ' ' + String(y).slice(2);
}
