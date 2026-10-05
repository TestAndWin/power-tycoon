/**
 * Company identities: crest tokens and CEO portraits (inline SVG, board game style) and how a rival
 * stands against the player. Player 0 is the human, 1–3 are the rivals.
 */
import type { Department, ExecGrade, PlayerSummary } from '@power-tycoon/engine';
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

/** A CEO portrait as a standalone SVG document with the player colours filled in (for canvas images). */
export function portraitSvg(pid: number, colors: string[]): string {
  const svg = portrait(pid, 160).replace(/^<span[^>]*>|<\/span>$/g, '');
  return svg
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/color-mix\(in srgb,var\(--c(\d)\) (\d+)%,#fff8ea\)/g, (_m, c: string, pct: string) =>
      mixHex('#fff8ea', colors[+c] ?? '#888888', +pct / 100),
    )
    .replace(/var\(--c(\d)\)/g, (_m, c: string) => colors[+c] ?? '#888888');
}
function mixHex(a: string, b: string, f: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a),
    B = p(b.length === 4 ? '#' + [...b.slice(1)].map((x) => x + x).join('') : b);
  return (
    '#' +
    A.map((v, i) =>
      Math.round(v + (B[i]! - v) * f)
        .toString(16)
        .padStart(2, '0'),
    ).join('')
  );
}

/* ---------- board members (phase 8) ---------- */

interface Look {
  skin: string;
  hair: string;
  style: 'short' | 'bob' | 'long' | 'bald' | 'bun' | 'curly' | 'pony';
  suit: string;
  shirt: string;
  tie?: string;
  beard?: string;
  glasses?: boolean;
  bg: string;
}
const HAIR_BACK: Partial<Record<Look['style'], (c: string) => string>> = {
  bob: (c) => `<path d="M24 46q-3-28 16-28t16 28l-3 7H27z" fill="${c}" ${S}/>`,
  long: (c) => `<path d="M22 60q-4-42 18-42t18 42z" fill="${c}" ${S}/>`,
  bun: (c) => `<circle cx="40" cy="16" r="6.5" fill="${c}" ${S}/>`,
  pony: (c) =>
    `<path d="M50 26q12 6 8 26" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M50 26q12 6 8 26" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
};
const HAIR_FRONT: Record<Look['style'], (c: string) => string> = {
  short: (c) => `<path d="M26.5 34q0-15 13.5-15t13.5 15q-3-7-13.5-7T26.5 34z" fill="${c}" ${S}/>`,
  bob: (c) => `<path d="M26.5 38q0-17 13.5-17t13.5 17q-4-9-11-10-2 5-16 10z" fill="${c}" ${S}/>`,
  long: (c) => `<path d="M26.5 38q0-17 13.5-17t13.5 17q-6-10-13.5-10T26.5 38z" fill="${c}" ${S}/>`,
  bun: (c) => `<path d="M27 35q2-13 13-13t13 13q-6-7-13-6.5Q33 29 27 35z" fill="${c}" ${S}/>`,
  pony: (c) => `<path d="M26.5 36q0-16 13.5-16t13.5 16q-6-8-13.5-8T26.5 36z" fill="${c}" ${S}/>`,
  bald: (c) =>
    `<path d="M26.5 37q-1-8 3-11M53.5 37q1-8-3-11" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`,
  curly: (c) =>
    [
      [28, 31],
      [32, 25],
      [38, 22],
      [44, 22],
      [49, 25],
      [52, 31],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5" fill="${c}" ${S}/>`)
      .join(''),
};
function bust(L: Look): string {
  return `${HAIR_BACK[L.style]?.(L.hair) ?? ''}${shoulders(L.suit)}<path d="M33 57.5 40 70l7-12.5z" fill="${L.shirt}" ${S}/>
    ${L.tie ? `<path d="M38.2 58.5h3.6l1.4 11L40 73l-3.2-3.5z" fill="${L.tie}" ${S}/>` : ''}
    <rect x="34.5" y="47" width="11" height="12" fill="${L.skin}" ${S}/><ellipse cx="40" cy="37.5" rx="13.2" ry="15.8" fill="${L.skin}" ${S}/>
    ${L.beard ? `<path d="M27 41q1 15 13 15t13-15q-3 7-13 7t-13-7z" fill="${L.beard}" ${S}/>` : ''}
    ${HAIR_FRONT[L.style](L.hair)}${eyes(37)}${L.beard ? '' : cheeks(42)}
    ${L.glasses ? `<rect x="30" y="33" width="9" height="7" rx="2" fill="none" stroke="${INK}" stroke-width="1.6"/><rect x="41" y="33" width="9" height="7" rx="2" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M39 36h2" stroke="${INK}" stroke-width="1.6"/>` : ''}
    <path d="M36 45.5q4 3 8 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
}
const LOOKS: Record<Department, Record<ExecGrade, Look>> = {
  dev: {
    junior: { skin: '#f1c7a5', hair: '#6b4a2b', style: 'short', suit: '#5a6b4a', shirt: '#fff8ea', bg: '#e3ead2' },
    senior: { skin: '#f3d0b4', hair: '#e0b25a', style: 'bob', suit: '#7a3b5d', shirt: '#fff8ea', bg: '#f0d9e3' },
  },
  grid: {
    junior: { skin: '#f4d3bc', hair: '#b5533a', style: 'pony', suit: '#4b6b3a', shirt: '#fff8ea', bg: '#e2edd5' },
    senior: {
      skin: '#efc8a8',
      hair: '#cfcac0',
      style: 'bald',
      suit: '#5a4a3a',
      shirt: '#fff8ea',
      beard: '#cfcac0',
      glasses: true,
      bg: '#ece2d4',
    },
  },
  trade: {
    junior: {
      skin: '#d8a581',
      hair: '#2a211c',
      style: 'short',
      suit: '#24324f',
      shirt: '#cfe0f5',
      tie: '#2f5bd3',
      beard: '#3a2e26',
      bg: '#d9e3f4',
    },
    senior: { skin: '#e8b894', hair: '#3b2416', style: 'long', suit: '#2b2b33', shirt: '#f3e3e3', bg: '#f1e1d6' },
  },
  law: {
    junior: {
      skin: '#a86f4c',
      hair: '#1d1a18',
      style: 'curly',
      suit: '#3a3d4a',
      shirt: '#fff8ea',
      tie: '#8e2b2b',
      bg: '#e6dfd3',
    },
    senior: {
      skin: '#f0cdb0',
      hair: '#9c958a',
      style: 'bun',
      suit: '#232a3a',
      shirt: '#fff8ea',
      glasses: true,
      bg: '#e0e4ec',
    },
  },
};
const ASSISTANT_LOOK: Look = {
  skin: '#f3d0b4',
  hair: '#8a4b2a',
  style: 'long',
  suit: '#c9a14a',
  shirt: '#fff8ea',
  glasses: true,
  bg: '#f3e6c8',
};
function lookPortrait(L: Look, id: string, size: number): string {
  return `<span class="portrait" style="width:${size}px;height:${size}px" aria-hidden="true"><svg viewBox="0 0 80 80" width="${size}" height="${size}"><defs><clipPath id="${id}"><circle cx="40" cy="40" r="38"/></clipPath></defs><circle cx="40" cy="40" r="38" fill="${L.bg}"/><g clip-path="url(#${id})">${bust(L)}</g><circle cx="40" cy="40" r="38" fill="none" stroke="${INK}" stroke-width="3"/></svg></span>`;
}
/** Portrait of the board member (or candidate) of department `d` with grade `g`. */
export const execPortrait = (d: Department, g: ExecGrade, size = 48): string =>
  lookPortrait(LOOKS[d][g], `ex-${d}-${g}`, size);
/** Portrait of the assistant who speaks for vacant departments. */
export const assistantPortrait = (size = 48): string => lookPortrait(ASSISTANT_LOOK, 'ex-assistant', size);

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
