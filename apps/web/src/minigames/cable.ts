/**
 * Minigame 3 – grid connection: rotate cable pieces until power flows from the plant to the substation.
 * With scarce grid capacity it is a duel: a rival lays its own line and wins if its bar is full first.
 */
import { pick, randint, shuffle, type Challenge, type Random, type SiteView } from '@power-tycoon/engine';
import { esc } from '../format.js';
import { openModal } from '../modal.js';
import { playerColor } from '../players.js';
import { SND } from '../sound.js';
import { $, S } from '../state.js';
import { PLANT_NAME, siteName } from '../texts.js';
import { crest } from '../ui/companies.js';
import { resultBox } from './common.js';

/** Connection bits of a cable piece. */
export const N_ = 1,
  E_ = 2,
  S_ = 4,
  W_ = 8;
/** A piece turned by 90° clockwise. */
export const rotate = (m: number): number => ((m << 1) | (m >> 3)) & 15;

export interface CablePuzzle {
  cols: number;
  rows: number;
  /** grid[row][col]: connection bits of each piece. */
  grid: number[][];
  /** Row of the plant (left edge) and of the substation (right edge). */
  from: number;
  to: number;
}

/** A random but solvable puzzle: a random path from left to right, filled up and scrambled. */
export function createCablePuzzle(R: Random, cols: number, rows = 5): CablePuzzle {
  const from = randint(R, 0, rows - 1),
    to = randint(R, 0, rows - 1);
  const grid: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  const seen = new Set<string>(),
    path: [number, number][] = [];
  const dfs = (c: number, r: number): boolean => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
    const k = c + ',' + r;
    if (seen.has(k)) return false;
    seen.add(k);
    path.push([c, r]);
    if (c === cols - 1 && r === to) return true;
    const d: [number, number][] = shuffle(R, [
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 0],
    ]);
    if (R() < 0.5) d.unshift([1, 0]);
    for (const [a, b] of d) if (dfs(c + a, r + b)) return true;
    path.pop();
    return false;
  };
  dfs(0, from);
  const bit = (dc: number, dr: number) => (dc === 1 ? E_ : dc === -1 ? W_ : dr === -1 ? N_ : S_);
  path.forEach(([c, r], i) => {
    let m = 0;
    if (i === 0) m |= W_;
    else {
      const [pc, pr] = path[i - 1]!;
      m |= bit(pc - c, pr - r);
    }
    if (i === path.length - 1) m |= E_;
    else {
      const [nc, nr] = path[i + 1]!;
      m |= bit(nc - c, nr - r);
    }
    grid[r]![c] = m;
  });
  const filler = [5, 10, 3, 6, 12, 9, 3, 6, 7, 14, 13, 11];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (!grid[r]![c]) grid[r]![c] = pick(R, filler);
      for (let k = randint(R, 1, 3); k > 0; k--) grid[r]![c] = rotate(grid[r]![c]!);
    }
  return { cols, rows, grid, from, to };
}

/** Pieces that carry power from the plant ("c,r"). */
export function powered(p: CablePuzzle): Set<string> {
  const { grid, cols, rows, from } = p;
  const on = new Set<string>();
  if (!(grid[from]![0]! & W_)) return on;
  const q: [number, number][] = [[0, from]];
  on.add('0,' + from);
  const D = [
    [N_, 0, -1, S_],
    [E_, 1, 0, W_],
    [S_, 0, 1, N_],
    [W_, -1, 0, E_],
  ] as const;
  while (q.length) {
    const [c, r] = q.shift()!;
    const m = grid[r]![c]!;
    for (const [b, dc, dr, ob] of D) {
      if (!(m & b)) continue;
      const nc = c + dc,
        nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const k = nc + ',' + nr;
      if (on.has(k) || !(grid[nr]![nc]! & ob)) continue;
      on.add(k);
      q.push([nc, nr]);
    }
  }
  return on;
}

/** Does power reach the substation? */
export const isConnected = (p: CablePuzzle, on: Set<string>): boolean =>
  on.has(p.cols - 1 + ',' + p.to) && !!(p.grid[p.to]![p.cols - 1]! & E_);

function pieceSvg(m: number, on: boolean): string {
  const col = on ? '#FFD23F' : '#8b949e';
  let s = '<svg viewBox="0 0 60 60" aria-hidden="true" class="' + (on ? 'live' : '') + '">';
  const seg: Record<number, string> = {
    [N_]: '30,30 30,0',
    [E_]: '30,30 60,30',
    [S_]: '30,30 30,60',
    [W_]: '30,30 0,30',
  };
  for (const b of [N_, E_, S_, W_])
    if (m & b)
      s += `<polyline points="${seg[b]}" stroke="#2b3430" stroke-width="12" fill="none"/><polyline points="${seg[b]}" stroke="${col}" stroke-width="5" fill="none"/>${on ? `<polyline class="pulse" points="${seg[b]}" stroke="#fff" stroke-width="2.5" fill="none" stroke-dasharray="4 10"/>` : ''}`;
  return s + `<circle cx="30" cy="30" r="8" fill="#2b3430"/><circle cx="30" cy="30" r="3.5" fill="${col}"/></svg>`;
}

/** Seconds the rival needs for the whole board in a duel. */
export const duelTime = (pace: number, cols: number, rows: number): number => Math.round(pace * cols * rows);

export function miniCable(x: SiteView, R: Random, ch?: Challenge): Promise<boolean> {
  return new Promise((res) => {
    const p = createCablePuzzle(R, x.r === 'ns' ? 7 : 6);
    const { cols: C, rows: Rows, grid, from: rs, to: rt } = p;
    const rival = ch?.rival;
    const rivalName = rival ? esc(S.view?.players[rival.playerId]?.name ?? 'Konkurrenz') : '';
    const T = rival ? duelTime(rival.pace, C, Rows) : 36 + C * 4;
    let left = T,
      won = false,
      over = false;
    const mw = x.mw;
    const hud = rival
      ? `<div class="duelbar" style="--oc:${playerColor(rival.playerId)}">${crest(rival.playerId, 26)}<span class="stack" style="gap:3px"><b>${rivalName} verlegt mit</b><div class="timebar"><i id="pBar" style="width:0%"></i></div></span><span class="mono" id="pT">${T} s</span></div>
        <div class="hud"><span>Du</span><span id="pS">Kein Kontakt</span></div>`
      : `<div class="hud"><span id="pT">${T} s</span><span id="pS">Kein Kontakt</span></div>
      <div class="timebar"><i id="pBar" style="width:100%"></i></div>`;
    openModal(
      `<h2>${rival ? 'Kabel-Duell' : 'Netzanschluss'} · ${siteName(x)}</h2>
      <p class="muted" style="margin:0">${
        rival
          ? `Die Netzkapazität ist knapp. ${rivalName} will dasselbe Umspannwerk. Dreh die Kabelstücke schneller richtig, als die Konkurrenz ihre Leitung legt!`
          : `Dreh die Kabelstücke per Klick, bis Strom vom ${x.type ? PLANT_NAME[x.type] : ''} (links) zum Umspannwerk (rechts) fließt.`
      }</p>
      ${hud}
      <div class="pipegrid cablegrid ${x.r === 'ns' ? 'seabed' : ''}" id="pg" style="grid-template-columns:repeat(${C + 2},minmax(0,1fr))"></div>`,
      { locked: true, wide: true },
    );
    const pg = $('#pg')!;
    function draw(): void {
      const on = powered(p);
      won = isConnected(p, on);
      let h = '';
      for (let r = 0; r < Rows; r++) {
        h += `<div class="cell edge">${r === rs ? `<svg viewBox="0 0 60 60"><rect x="6" y="10" width="36" height="40" rx="6" fill="#2F62D9"/><rect x="42" y="26" width="18" height="8" fill="#2b3430"/><text x="24" y="35" font-size="11" fill="#fff" text-anchor="middle" font-family="monospace">${mw}MW</text></svg>` : ''}</div>`;
        for (let c = 0; c < C; c++)
          h += `<button class="cell" data-c="${c}" data-r="${r}" aria-label="Kabel ${c + 1},${r + 1} drehen">${pieceSvg(grid[r]![c]!, on.has(c + ',' + r))}</button>`;
        h += `<div class="cell edge">${r === rt ? `<svg viewBox="0 0 60 60"><rect x="0" y="26" width="16" height="8" fill="#2b3430"/><path d="M16 50V16l14-8 14 8v34z" fill="${won ? '#E3A008' : '#8b949e'}"/><path d="M26 22l6 8h-5l5 10" stroke="#fff" stroke-width="2.5" fill="none"/></svg>` : ''}</div>`;
      }
      pg.innerHTML = h;
      $('#pS')!.textContent = won ? 'Strom fließt!' : 'Kein Kontakt';
    }
    pg.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.cell[data-c]');
      if (!b || over) return;
      const c = +b.dataset.c!,
        r = +b.dataset.r!;
      grid[r]![c] = rotate(grid[r]![c]!);
      SND.click();
      draw();
      pg.querySelector<HTMLElement>(`[data-c="${c}"][data-r="${r}"]`)?.focus();
      if (won) end(true);
    });
    const iv = setInterval(() => {
      if (!$('#pBar')) {
        clearInterval(iv);
        return;
      }
      left -= 0.25;
      $('#pBar')!.style.width = (rival ? 1 - left / T : left / T) * 100 + '%';
      $('#pT')!.textContent = Math.ceil(left) + ' s';
      if (left <= 0) end(false);
    }, 250);
    function end(ok: boolean): void {
      if (over) return;
      over = true;
      clearInterval(iv);
      setTimeout(
        () =>
          rival
            ? resultBox(
                ok,
                ok ? 'Duell gewonnen' : rivalName + ' war schneller',
                ok
                  ? 'Du hast das Umspannwerk zuerst erreicht. Das Kraftwerk speist ab jetzt jedes Quartal ein.'
                  : 'Die Konkurrenz hat sich die Kapazität gesichert. Die Hälfte der Anschlusskosten bekommst du zurück.',
                () => res(ok),
                ok ? 'Sieg' : 'Niederlage',
              )
            : resultBox(
                ok,
                ok ? 'Am Netz' : 'Zeit abgelaufen',
                ok
                  ? 'Das Kraftwerk speist ab jetzt jedes Quartal ein.'
                  : 'Der Netzbetreiber hat das Zeitfenster geschlossen. Die Anschlusskosten sind weg, du kannst es erneut versuchen.',
                () => res(ok),
              ),
        ok ? 500 : 100,
      );
    }
    draw();
  });
}
