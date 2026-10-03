/**
 * Company identities: crest tokens and CEO portraits (inline SVG, board game style) and how a rival
 * stands against the player. Player 0 is the human, 1–3 are the rivals.
 */
import type { PlayerSummary } from '@power-tycoon/engine';
import { STANDING_TEXT } from '../texts.js';

const INK = '#2a2016';
const tint = (pid: number, pct: number): string => `color-mix(in srgb,var(--c${pid}) ${pct}%,#fff8ea)`;

/** White glyph on the crest of each company (24×24). */
const GLYPH: Record<number, string> = {
  0: '<path d="M13.5 3 6 13.5h5L9.8 21 18 10h-5.2z" fill="#fff"/>',
  1: '<path d="M3 11.5c3.2-3.4 6.2-3.2 9 .8 2.8-4 5.8-4.2 9-.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 17.5c2-1.4 4-1.4 6 0s4 1.4 6 0 3-1.4 4 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  2: '<path d="M6.5 16a5.5 5.5 0 0 1 11 0z" fill="#fff"/><path d="M12 5.5v2.5M5 9l1.8 1.6M19 9l-1.8 1.6M3 16h18" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M7 19.5h10" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>',
  3: '<path d="M2.5 19 9 8l3.8 6 2.2-3.2L21.5 19z" fill="#fff"/><path d="M9 8l-2.2 3.8 1.6-.6 1 1.2 1.2-1.6z" fill="var(--c3)"/>',
};

/** Round company token with the crest glyph; `size` in px. */
export function crest(pid: number, size = 28): string {
  return `<span class="crest" style="--oc:var(--c${pid});width:${size}px;height:${size}px" aria-hidden="true"><svg viewBox="0 0 24 24" width="${Math.round(size * 0.68)}" height="${Math.round(size * 0.68)}">${GLYPH[pid] ?? GLYPH[0]}</svg></span>`;
}

const S = `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`;
const eyes = (y: number, dx = 5.5) =>
  `<circle cx="${40 - dx}" cy="${y}" r="1.7" fill="${INK}"/><circle cx="${40 + dx}" cy="${y}" r="1.7" fill="${INK}"/>`;
const cheeks = (y: number) =>
  `<circle cx="31" cy="${y}" r="2.6" fill="#e9826a" opacity=".35"/><circle cx="49" cy="${y}" r="2.6" fill="#e9826a" opacity=".35"/>`;
const shoulders = (fill: string) => `<path d="M6 86C8 65 23 57 40 57s32 8 34 29z" fill="${fill}" ${S}/>`;

/** Bust of the company boss inside the clipped circle (80×80). */
const BUST: Record<number, string> = {
  // the player: a neutral silhouette with a star
  0: `${shoulders('var(--c0)')}<circle cx="40" cy="36" r="14.5" fill="${tint(0, 38)}" ${S}/>
    <path d="m40 62.5 1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="#fff"/>`,
  // Hinnerk Ostendorp: harbour captain with cap, white beard and red scarf
  1: `${shoulders('#2b3a55')}<circle cx="31" cy="72" r="1.6" fill="#e2b13c"/><circle cx="49" cy="72" r="1.6" fill="#e2b13c"/>
    <rect x="34" y="47" width="12" height="12" fill="#f1c7a5" ${S}/>
    <path d="M27 58q13 9 26 0l-1 6q-12 8-24 0z" fill="var(--c1)" ${S}/>
    <ellipse cx="40" cy="37" rx="14" ry="16" fill="#f1c7a5" ${S}/>
    <path d="M26 37q1 20 14 20t14-20q-4 10-14 10t-14-10z" fill="#f6f2ea" ${S}/>
    <path d="M33 45.5q7-4 14 0-7 1.5-14 0z" fill="#e4ded2" stroke="${INK}" stroke-width="1.4"/>
    ${eyes(35)}<path d="M31 31.5h6M43 31.5h6" stroke="#f6f2ea" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M40 36q2.5 4-.8 5" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M24.5 28q1-13 15.5-13t15.5 13z" fill="#2b3a55" ${S}/>
    <path d="M23 28q17 5 34 0l-1 3.5q-16 5-32 0z" fill="#1d1d22" ${S}/>
    <circle cx="40" cy="22" r="2.6" fill="#e2b13c" stroke="${INK}" stroke-width="1.4"/>`,
  // Inés Valcárcel: dark hair with bun, sunglasses in the hair, teal blazer
  2: `<path d="M24 41q-2-23 16-23t16 23q0 10-4 14H28q-4-4-4-14z" fill="#2b1a12" ${S}/>
    <circle cx="40" cy="15" r="6" fill="#2b1a12" ${S}/>
    ${shoulders('var(--c2)')}<path d="M33 57.5 40 70l7-12.5z" fill="#fff8ea" ${S}/>
    <rect x="34.5" y="48" width="11" height="11" fill="#d9a27a" ${S}/>
    <ellipse cx="40" cy="38" rx="13" ry="15.5" fill="#d9a27a" ${S}/>
    <path d="M27 35q2-13 13-13t13 13q-6-7-13-6.5Q33 29 27 35z" fill="#2b1a12" ${S}/>
    <path d="M28.5 25.5q5.5-3 9.5 0M42 25.5q4-3 9.5 0" fill="none" stroke="#1d1d22" stroke-width="3.6" stroke-linecap="round"/>
    ${eyes(37)}${cheeks(42)}
    <path d="M36 45.5q4 3 8 0-4 1.2-8 0z" fill="#b8323a" stroke="#b8323a" stroke-width="1.4" stroke-linejoin="round"/>
    <circle cx="26.8" cy="44" r="2" fill="#e2b13c" stroke="${INK}" stroke-width="1.2"/><circle cx="53.2" cy="44" r="2" fill="#e2b13c" stroke="${INK}" stroke-width="1.2"/>`,
  // Dr. Ueli Brunner: banker with round glasses, grey side parting, mustard tie
  3: `${shoulders('#3b3d48')}<path d="M32.5 57.5 40 72l7.5-14.5z" fill="#fff8ea" ${S}/>
    <path d="M38 58.5h4l1.6 13L40 76l-3.6-4.5z" fill="var(--c3)" ${S}/>
    <rect x="34" y="47" width="12" height="12" fill="#f3d0b4" ${S}/>
    <ellipse cx="40" cy="37" rx="13.5" ry="16" fill="#f3d0b4" ${S}/>
    <path d="M26 35q0-16 14-16t14 16q-2-8-10-8.5-9-.5-15 4.5z" fill="#a8a49c" ${S}/>
    ${eyes(36.5)}<circle cx="34.5" cy="36.5" r="4.4" fill="none" stroke="${INK}" stroke-width="1.8"/><circle cx="45.5" cy="36.5" r="4.4" fill="none" stroke="${INK}" stroke-width="1.8"/><path d="M38.9 36.3h2.2" stroke="${INK}" stroke-width="1.8"/>
    <path d="M36 46.5q4 1.6 8 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
};

/** Round CEO portrait; `size` in px. */
export function portrait(pid: number, size = 64): string {
  const id = `pc${pid}`;
  return `<span class="portrait" style="--oc:var(--c${pid});width:${size}px;height:${size}px" aria-hidden="true"><svg viewBox="0 0 80 80" width="${size}" height="${size}"><defs><clipPath id="${id}"><circle cx="40" cy="40" r="38"/></clipPath></defs><circle cx="40" cy="40" r="38" fill="${tint(pid, 24)}"/><g clip-path="url(#${id})">${BUST[pid] ?? BUST[0]}</g><circle cx="40" cy="40" r="38" fill="none" stroke="${INK}" stroke-width="3"/></svg></span>`;
}

export type StandingKey = keyof typeof STANDING_TEXT;
type Kind = 'good' | 'warn' | 'bad' | '';

/** How a rival stands against the player, by net worth. */
export function standing(p: PlayerSummary, me: PlayerSummary): { key: StandingKey; t: string; k: Kind } {
  const key: StandingKey = p.out
    ? 'out'
    : p.worth > me.worth * 1.15
      ? 'leads'
      : p.worth > me.worth
        ? 'ahead'
        : p.worth > me.worth * 0.9
          ? 'close'
          : 'behind';
  const k: Record<StandingKey, Kind> = { leads: 'bad', ahead: 'warn', close: 'warn', behind: 'good', out: '' };
  return { key, t: STANDING_TEXT[key], k: k[key] };
}

/** Change of net worth in the last quarter, null without two recorded quarters. */
export function trend(p: PlayerSummary): number | null {
  const h = p.hist.filter((x): x is number => x != null);
  return h.length > 1 ? h[h.length - 1]! - h[h.length - 2]! : null;
}
