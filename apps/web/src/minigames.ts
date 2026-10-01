/**
 * Skill minigames, ported from legacy/src/mini.js. The playing field is generated from the
 * challenge seed; the result (efficiency or success) is sent back to the server.
 */
import { createRng, gauss, pick, rand, randint, shuffle, type Challenge, type Random, type SiteView } from '@power-tycoon/engine';
import { clamp } from './format.js';
import { closeModal, openModal } from './modal.js';
import { SND } from './sound.js';
import { $ } from './state.js';
import { PLANT_NAME, siteName } from './texts.js';
import { PLANTS } from '@power-tycoon/engine';

function setupCanvas(cv: HTMLCanvasElement, W: number, H: number): CanvasRenderingContext2D {
  const d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * d;
  cv.height = H * d;
  const c = cv.getContext('2d')!;
  c.setTransform(d, 0, 0, d, 0, 0);
  return c;
}
function resultBox(ok: boolean, title: string, text: string, done: () => void, label?: string): void {
  const box = document.createElement('div');
  box.className = 'stack';
  if (ok) SND.ok();
  else SND.fail();
  box.innerHTML =
    '<div class="row"><span class="chip ' +
    (ok ? 'good' : 'bad') +
    '">' +
    (label || (ok ? 'Erfolg' : 'Fehlschlag')) +
    '</span><h3>' +
    title +
    '</h3></div><p class="muted" style="margin:0">' +
    text +
    '</p><div class="foot"><button class="btn primary" id="mgDone">Weiter</button></div>';
  $('#mcard')!.appendChild(box);
  const b = $<HTMLButtonElement>('#mgDone')!;
  b.focus();
  b.onclick = () => {
    closeModal();
    done();
  };
}
const TURB =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="13.5" cy="23" rx="3" ry=".9" fill="rgba(0,0,0,.25)"/><path d="M11.4 23h1.8l-.4-13h-1z" fill="#fff" stroke="#8a948f" stroke-width=".4"/><g class="spin" style="transform-origin:12px 9px"><path d="M12 9 12.6 1.2 11.4 1.2Z M12 9 5.2 12.6 5.8 13.6Z M12 9 18.8 12.6 18.2 13.6Z" fill="#fff" stroke="#6f7a75" stroke-width=".5" stroke-linejoin="round"/></g><circle cx="12" cy="9" r="1.3" fill="#fff" stroke="#6f7a75" stroke-width=".5"/></svg>';
const HOUSE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 9 7l5 5v8H4z" fill="#f4efe4" stroke="#6b5a48" stroke-width=".8"/><path d="M3 12.5 9 6.5l6 6" fill="none" stroke="#b5533c" stroke-width="2.2"/><rect x="7.5" y="15" width="3" height="5" fill="#6b5a48"/><path d="M13 14 17 10l4 4v6h-8z" fill="#efe6d6" stroke="#6b5a48" stroke-width=".8"/><path d="M12.5 14.5 17 10l4.5 4.5" fill="none" stroke="#b5533c" stroke-width="2"/></svg>';
const TREES =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="13" cy="21" rx="8" ry="1.6" fill="rgba(0,0,0,.25)"/><rect x="7.3" y="14" width="1.4" height="6" fill="#5b4632"/><circle cx="8" cy="11" r="5" fill="#2f6b34"/><rect x="15.3" y="15" width="1.4" height="5" fill="#5b4632"/><circle cx="16" cy="12" r="4" fill="#3d7d3a"/></svg>';
const PANEL =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18l-3 10H0z" transform="translate(1.5 0)" fill="#1d3a8a" stroke="#fff" stroke-width="1.2"/><path d="M8 8 6 18M14 8l-2 10M5 13h15" stroke="#9fb5ea" stroke-width=".9"/></svg>';

/** Plays the minigame for a challenge and resolves with the outcome to report. */
export function playChallenge(ch: Challenge, x: SiteView): Promise<number | boolean> {
  const R = createRng(ch.seed);
  switch (ch.kind) {
    case 'layout':
      return miniLayout(x, R);
    case 'rotor':
      return miniRotor(x, R);
    case 'cable':
      return miniCable(x, R);
    case 'frequency':
      return miniFreq(x, R);
  }
}

/* ---------- 1. Site layout ---------- */
function miniLayout(x: SiteView, R: Random): Promise<number> {
  return new Promise((res) => {
    const solar = x.type === 'solar',
      off = x.type === 'off';
    const C = 8,
      Rows = 5,
      N = solar ? 6 : off ? 6 : 5;
    const seed = [rand(R, 0, 6), rand(R, 0, 6), rand(R, 0, 6)] as const;
    interface Cell {
      c: number;
      r: number;
      v: number;
      kind: 'ok' | 'block' | 'shade';
      on: boolean;
    }
    const cells: Cell[] = [];
    for (let r = 0; r < Rows; r++)
      for (let c = 0; c < C; c++) {
        let v =
          0.88 +
          0.12 * Math.sin(c * 0.9 + seed[0]) * Math.cos(r * 1.1 + seed[1]) +
          0.06 * Math.sin((c + r) * 1.7 + seed[2]);
        if (solar) v += (r - 2) * 0.03;
        let kind: Cell['kind'] = 'ok';
        if (!off && R() < (solar ? 0.1 : 0.14)) kind = 'block';
        else if (solar && R() < 0.14) {
          kind = 'shade';
          v = 0.45;
        }
        cells.push({ c, r, v: clamp(v, 0.4, 1.12), kind, on: false });
      }
    const at = (c: number, r: number) => cells[r * C + c]!;
    function yieldOf(k: number): number {
      const t = cells[k]!;
      let y = t.v;
      if (solar) {
        const s = t.r + 1 < Rows && at(t.c, t.r + 1).on;
        if (s) y *= 0.78;
      } else {
        for (let d = 1; d <= 3; d++) if (t.c - d >= 0 && at(t.c - d, t.r).on) y *= 0.72 + (d - 1) * 0.08;
        for (const dr of [-1, 1]) {
          const n = t.r + dr >= 0 && t.r + dr < Rows ? at(t.c, t.r + dr) : null;
          if (n && n.on) y *= 0.92;
        }
      }
      return y;
    }
    const ideal = cells
      .filter((t) => t.kind !== 'block')
      .map((t) => t.v)
      .sort((a, b) => b - a)
      .slice(0, N)
      .reduce((a, b) => a + b, 0);
    function score(): number {
      const on = cells.map((t, k) => (t.on ? yieldOf(k) : 0)).reduce((a, b) => a + b, 0);
      return clamp(0.8 + (0.35 * on) / ideal, 0.8, 1.15);
    }
    const col = (v: number) => {
      const t = clamp((v - 0.72) / 0.4, 0, 1);
      return solar
        ? `hsl(${52 - t * 20},${55 + t * 30}%,${82 - t * 30}%)`
        : off
          ? `hsl(${200 + t * 10},${55 + t * 15}%,${62 - t * 28}%)`
          : `hsl(${100 + t * 40},${35 + t * 20}%,${78 - t * 38}%)`;
    };
    openModal(
      `<h2>Standortsuche · ${siteName(x)}</h2>
      <p class="muted" style="margin:0">${solar ? `Platziere ${N} Modulfelder. Kräftigere Farben bekommen mehr Sonne. Grüne Felder mit Bäumen liegen im Schatten, graue sind Schutzgebiet. Ein Modulfeld direkt südlich (unterhalb) eines anderen verschattet dieses.` : `Platziere ${N} Windräder. Dunkleres Grün bedeutet mehr Wind. Der Wind kommt von Westen (links): Hinter jeder Anlage entsteht ein Nachlauf, der die nächsten drei Felder rechts davon bremst.${off ? '' : ' Auf Siedlungen darf nicht gebaut werden.'}`}</p>
      <div class="hud"><span>${solar ? 'Süden ↓' : 'Wind → von Westen'}</span><span id="lScore">Wirkungsgrad –</span><span id="lCnt">0/${N}</span></div>
      <div class="laywrap ${solar ? 'sunny' : 'windy'}"><div class="lay" id="lay" style="grid-template-columns:repeat(${C},minmax(0,1fr))"></div></div>
      <div class="legend"><span><i class="lg" style="background:${col(0.75)}"></i>${solar ? 'wenig Sonne' : 'schwacher Wind'}</span><span><i class="lg" style="background:${col(1.1)}"></i>${solar ? 'viel Sonne' : 'starker Wind'}</span>${solar ? '<span><i class="lg" style="background:#7f9a7c"></i>Schatten</span>' : ''}${off ? '' : `<span><i class="lg block"></i>${solar ? 'Schutzgebiet' : 'Siedlung'}</span>`}${solar ? '' : '<span><i class="lg wakeL"></i>Nachlauf</span>'}</div>
      <div class="foot"><button class="btn primary big" id="lOk" disabled>Layout übernehmen</button></div>`,
      { locked: true, wide: true },
    );
    const lay = $('#lay')!;
    function draw(): void {
      const n = cells.filter((t) => t.on).length;
      const wake = new Set<string>();
      if (!solar)
        cells.forEach((t) => {
          if (t.on) for (let d = 1; d <= 3; d++) if (t.c + d < C) wake.add(t.c + d + ',' + t.r);
        });
      lay.innerHTML = cells
        .map(
          (t, k) =>
            `<button class="lc ${t.kind === 'block' ? 'block' : ''} ${t.kind === 'shade' ? 'shade' : ''} ${off ? 'sea' : ''} ${wake.has(t.c + ',' + t.r) && !t.on ? 'wake' : ''} ${t.on ? 'on' : ''}" data-k="${k}" style="--bg:${t.kind === 'shade' ? '#7f9a7c' : col(t.v)}" aria-label="Feld ${t.c + 1},${t.r + 1}${t.on ? ' belegt' : ''}${t.kind === 'block' ? ' gesperrt' : ''}" ${t.kind === 'block' ? 'disabled' : ''}>${t.on ? (solar ? PANEL : TURB) : t.kind === 'block' ? (solar ? TREES : HOUSE) : t.kind === 'shade' ? TREES : ''}</button>`,
        )
        .join('');
      $('#lCnt')!.textContent = n + '/' + N;
      $('#lScore')!.textContent = 'Wirkungsgrad ' + (n ? Math.round(score() * 100) + ' %' : '–');
      $<HTMLButtonElement>('#lOk')!.disabled = n !== N;
    }
    lay.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.lc');
      if (!b) return;
      const t = cells[+b.dataset.k!]!;
      if (t.kind === 'block') return;
      if (!t.on && cells.filter((q) => q.on).length >= N) return;
      t.on = !t.on;
      if (t.on) SND.place();
      else SND.click();
      draw();
      lay.querySelector<HTMLElement>(`[data-k="${b.dataset.k}"]`)?.focus();
    });
    $<HTMLButtonElement>('#lOk')!.onclick = () => {
      const s = Math.round(score() * 100) / 100;
      $('#lOk')!.parentElement!.remove();
      resultBox(
        s >= 1,
        'Wirkungsgrad ' + Math.round(s * 100) + ' %',
        s >= 1.05
          ? 'Ein Top-Layout. Der Park liefert dauerhaft mehr als die Planung.'
          : s >= 0.95
            ? 'Solide Planung. Der Park läuft ungefähr nach Prognose.'
            : 'Viel Nachlauf oder Schatten. Der Park bleibt dauerhaft unter seinen Möglichkeiten.',
        () => res(s),
        s >= 1 ? 'Gut geplant' : 'Suboptimal',
      );
    };
    draw();
  });
}

/* ---------- 2. Rotor assembly ---------- */
function miniRotor(x: SiteView, R: Random): Promise<boolean> {
  return new Promise((res) => {
    const off = x.type === 'off',
      W = 320,
      H = 380,
      hubX = 160,
      hubY = 150,
      pivotX = 160;
    openModal(
      `<h2>Rotor-Montage · ${siteName(x)}</h2>
      <p class="muted" style="margin:0">Das Rotorblatt pendelt am Kranhaken${off ? ' – auf See schwankt zusätzlich das Errichterschiff' : ''}. Drück „Absetzen“, wenn die Blattwurzel genau vor der Nabe hängt. Drei Blätter müssen dran, drei Fehlversuche beenden die Montage.</p>
      <div class="hud"><span id="rB">Blätter 0/3</span><span id="rM">Fehlversuche 0/3</span></div>
      <div class="game-wrap"><canvas id="mg"></canvas></div>
      <div class="row" style="justify-content:center" id="mgCtl"><button class="btn primary big" id="bSet">Absetzen</button></div>`,
      { locked: true },
    );
    const cv = $<HTMLCanvasElement>('#mg')!,
      ctx = setupCanvas(cv, W, H);
    const S = { blades: 0, miss: 0, t: 0, drop: 0, dropX: 0, state: 'swing', flash: 0, flashOk: false, done: false };
    const amp = () => (off ? 62 : 48) + S.blades * 10,
      spd = () => (off ? 2.3 : 1.8) + S.blades * 0.35;
    const hookX = () => pivotX + Math.sin(S.t * spd()) * amp() + Math.sin(S.t * 3.7) * (off ? 9 : 4);
    const act = () => {
      if (S.state !== 'swing' || S.done) return;
      S.state = 'drop';
      S.drop = 0;
      S.dropX = hookX();
      SND.whoosh();
    };
    $<HTMLButtonElement>('#bSet')!.onclick = act;
    const kd = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        act();
      }
    };
    window.addEventListener('keydown', kd);
    let last = performance.now(),
      raf = 0;
    function frame(t: number): void {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (S.state === 'swing') S.t += dt;
      if (S.state === 'drop') {
        S.drop += dt * 2.4;
        if (S.drop >= 1) {
          const ok = Math.abs(S.dropX - hubX) <= 11;
          S.flash = 0.6;
          S.flashOk = ok;
          if (ok) {
            S.blades++;
            SND.clank();
          } else {
            S.miss++;
            SND.fail();
          }
          $('#rB')!.textContent = 'Blätter ' + S.blades + '/3';
          $('#rM')!.textContent = 'Fehlversuche ' + S.miss + '/3';
          S.state = 'swing';
          S.t += rand(R, 0, 3);
          if (S.blades >= 3 || S.miss >= 3) {
            S.done = true;
            window.removeEventListener('keydown', kd);
            const ok2 = S.blades >= 3;
            $('#mgCtl')!.remove();
            setTimeout(() => {
              cancelAnimationFrame(raf);
              resultBox(
                ok2,
                ok2 ? 'Rotor montiert' : 'Montage abgebrochen',
                ok2
                  ? 'Alle drei Blätter sitzen. Die Anlage ist fertig und wartet auf den Netzanschluss.'
                  : 'Zu viele beschädigte Blätter. Die Montage kann wiederholt werden (10 % der Baukosten).',
                () => res(ok2),
              );
            }, 900);
          }
        }
      }
      S.flash = Math.max(0, S.flash - dt);
      const bob = off ? Math.sin(t / 500) * 4 : 0;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, off ? '#9cc3dd' : '#a8d3ee');
      g.addColorStop(1, off ? '#d6e6ef' : '#e7f2f7');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      if (off) {
        ctx.fillStyle = '#2f6f93';
        ctx.fillRect(0, H - 60, W, 60);
        ctx.strokeStyle = 'rgba(255,255,255,.4)';
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          const yy = H - 50 + i * 6;
          ctx.moveTo(0, yy);
          for (let xx = 0; xx <= W; xx += 20) ctx.lineTo(xx, yy + Math.sin(xx / 30 + t / 400 + i) * 2);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#a9c98f';
        ctx.beginPath();
        ctx.moveTo(0, H - 60);
        for (let xx = 0; xx <= W; xx += 10) ctx.lineTo(xx, H - 62 - Math.sin(xx / 40) * 8);
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.fill();
        ctx.fillStyle = '#8cbf6a';
        ctx.fillRect(0, H - 40, W, 40);
        for (let k = 0; k < 3; k++) {
          const bx = 40 + k * 110,
            by = H - 66;
          ctx.strokeStyle = '#dfe6e3';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx, by - 40);
          ctx.stroke();
          const a = t / 600 + k;
          for (let j = 0; j < 3; j++) {
            ctx.beginPath();
            ctx.moveTo(bx, by - 40);
            ctx.lineTo(bx + Math.cos(a + j * 2.09) * 14, by - 40 + Math.sin(a + j * 2.09) * 14);
            ctx.stroke();
          }
        }
        ctx.lineWidth = 1;
      }
      for (let k = 0; k < 3; k++) {
        const cx = ((k * 140 + (t / 40) * (k + 1)) % (W + 120)) - 60,
          cy = 30 + k * 28;
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, 7);
        ctx.arc(cx + 14, cy + 3, 11, 0, 7);
        ctx.arc(cx - 13, cy + 4, 10, 0, 7);
        ctx.fill();
      }
      {
        const bx = ((t / 25) % (W + 80)) - 40,
          by = 70 + Math.sin(t / 400) * 6;
        ctx.strokeStyle = '#3a3f3d';
        ctx.lineWidth = 1.3;
        for (let j = 0; j < 3; j++) {
          const ox = bx - j * 14,
            oy = by + j * 5,
            f = Math.sin(t / 120 + j) * 3;
          ctx.beginPath();
          ctx.moveTo(ox - 5, oy - f);
          ctx.lineTo(ox, oy);
          ctx.lineTo(ox + 5, oy - f);
          ctx.stroke();
        }
        ctx.lineWidth = 1;
      }
      // tower
      ctx.fillStyle = '#eef1f0';
      ctx.beginPath();
      ctx.moveTo(hubX - 5, hubY);
      ctx.lineTo(hubX + 5, hubY);
      ctx.lineTo(hubX + 10, H - (off ? 60 : 40));
      ctx.lineTo(hubX - 10, H - (off ? 60 : 40));
      ctx.fill();
      ctx.strokeStyle = '#b9c2be';
      ctx.stroke();
      // mounted blades
      ctx.save();
      ctx.translate(hubX, hubY);
      for (let k = 0; k < S.blades; k++) {
        ctx.save();
        ctx.rotate(-Math.PI / 2 + (k * Math.PI * 2) / 3);
        ctx.fillStyle = '#f7f9f8';
        ctx.strokeStyle = '#9aa5a0';
        ctx.beginPath();
        ctx.moveTo(6, -4);
        ctx.quadraticCurveTo(60, -9, 98, -1);
        ctx.lineTo(98, 1);
        ctx.quadraticCurveTo(60, 4, 6, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      // nacelle and hub
      ctx.fillStyle = '#dfe5e2';
      ctx.fillRect(hubX - 2, hubY - 10, 40, 20);
      ctx.strokeStyle = '#9aa5a0';
      ctx.strokeRect(hubX - 2, hubY - 10, 40, 20);
      ctx.fillStyle = '#c7d0cc';
      ctx.beginPath();
      ctx.arc(hubX, hubY, 9, 0, 7);
      ctx.fill();
      ctx.stroke();
      // crane
      ctx.strokeStyle = '#e0a100';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(30, H);
      ctx.lineTo(30, 20);
      ctx.lineTo(W - 10, 20);
      ctx.stroke();
      ctx.lineWidth = 1;
      // blade on the hook
      const hx = S.state === 'drop' ? S.dropX : hookX();
      const hy = S.state === 'drop' ? 40 + S.drop * (hubY - 40 - 14) : 40 + bob;
      ctx.strokeStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(pivotX, 20);
      ctx.lineTo(hx, hy - 40);
      ctx.stroke();
      if (!S.done || S.state === 'drop') {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.fillStyle = '#f7f9f8';
        ctx.strokeStyle = '#6d7a74';
        ctx.beginPath();
        ctx.moveTo(-4, -44);
        ctx.quadraticCurveTo(-9, -20, -3, 14);
        ctx.lineTo(3, 14);
        ctx.quadraticCurveTo(9, -20, 4, -44);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e0a100';
        ctx.fillRect(-5, 10, 10, 5);
        ctx.restore();
      }
      // target mark
      ctx.strokeStyle = 'rgba(47,98,217,.6)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hubX, hubY - 60);
      ctx.lineTo(hubX, hubY - 18);
      ctx.stroke();
      ctx.setLineDash([]);
      if (S.flash > 0) {
        ctx.fillStyle = S.flashOk ? `rgba(46,158,87,${S.flash * 0.5})` : `rgba(210,59,43,${S.flash * 0.5})`;
        ctx.fillRect(0, 0, W, H);
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  });
}

/* ---------- 3. Grid connection ---------- */
const N_ = 1,
  E_ = 2,
  S_ = 4,
  W_ = 8;
const rot = (m: number) => ((m << 1) | (m >> 3)) & 15;
function miniCable(x: SiteView, R: Random): Promise<boolean> {
  return new Promise((res) => {
    const C = x.r === 'ns' ? 7 : 6,
      Rows = 5,
      rs = randint(R, 0, Rows - 1),
      rt = randint(R, 0, Rows - 1);
    const grid: number[][] = Array.from({ length: Rows }, () => Array<number>(C).fill(0));
    const seen = new Set<string>(),
      path: [number, number][] = [];
    const dfs = (c: number, r: number): boolean => {
      if (c < 0 || r < 0 || c >= C || r >= Rows) return false;
      const k = c + ',' + r;
      if (seen.has(k)) return false;
      seen.add(k);
      path.push([c, r]);
      if (c === C - 1 && r === rt) return true;
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
    dfs(0, rs);
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
    for (let r = 0; r < Rows; r++)
      for (let c = 0; c < C; c++) {
        if (!grid[r]![c]) grid[r]![c] = pick(R, filler);
        for (let k = randint(R, 1, 3); k > 0; k--) grid[r]![c] = rot(grid[r]![c]!);
      }
    const T = 36 + C * 4;
    let left = T,
      won = false,
      over = false;
    const mw = x.type ? PLANTS[x.type].mw : 0;
    openModal(
      `<h2>Netzanschluss · ${siteName(x)}</h2>
      <p class="muted" style="margin:0">Dreh die Kabelstücke per Klick, bis Strom vom ${x.type ? PLANT_NAME[x.type] : ''} (links) zum Umspannwerk (rechts) fließt.</p>
      <div class="hud"><span id="pT">${T} s</span><span id="pS">Kein Kontakt</span></div>
      <div class="timebar"><i id="pBar" style="width:100%"></i></div>
      <div class="pipegrid cablegrid ${x.r === 'ns' ? 'seabed' : ''}" id="pg" style="grid-template-columns:repeat(${C + 2},minmax(0,1fr))"></div>`,
      { locked: true, wide: true },
    );
    const pg = $('#pg')!;
    function flow(): Set<string> {
      const on = new Set<string>();
      if (!(grid[rs]![0]! & W_)) return on;
      const q: [number, number][] = [[0, rs]];
      on.add('0,' + rs);
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
          if (nc < 0 || nr < 0 || nc >= C || nr >= Rows) continue;
          const k = nc + ',' + nr;
          if (on.has(k) || !(grid[nr]![nc]! & ob)) continue;
          on.add(k);
          q.push([nc, nr]);
        }
      }
      return on;
    }
    const svg = (m: number, on: boolean) => {
      const col = on ? '#FFD23F' : '#8b949e';
      let s = '<svg viewBox="0 0 60 60" aria-hidden="true" class="' + (on ? 'live' : '') + '">';
      const seg: Record<number, string> = { [N_]: '30,30 30,0', [E_]: '30,30 60,30', [S_]: '30,30 30,60', [W_]: '30,30 0,30' };
      for (const b of [N_, E_, S_, W_])
        if (m & b)
          s += `<polyline points="${seg[b]}" stroke="#2b3430" stroke-width="12" fill="none"/><polyline points="${seg[b]}" stroke="${col}" stroke-width="5" fill="none"/>${on ? `<polyline class="pulse" points="${seg[b]}" stroke="#fff" stroke-width="2.5" fill="none" stroke-dasharray="4 10"/>` : ''}`;
      return s + `<circle cx="30" cy="30" r="8" fill="#2b3430"/><circle cx="30" cy="30" r="3.5" fill="${col}"/></svg>`;
    };
    function draw(): void {
      const on = flow();
      won = on.has(C - 1 + ',' + rt) && !!(grid[rt]![C - 1]! & E_);
      let h = '';
      for (let r = 0; r < Rows; r++) {
        h += `<div class="cell edge">${r === rs ? `<svg viewBox="0 0 60 60"><rect x="6" y="10" width="36" height="40" rx="6" fill="#2F62D9"/><rect x="42" y="26" width="18" height="8" fill="#2b3430"/><text x="24" y="35" font-size="11" fill="#fff" text-anchor="middle" font-family="monospace">${mw}MW</text></svg>` : ''}</div>`;
        for (let c = 0; c < C; c++)
          h += `<button class="cell" data-c="${c}" data-r="${r}" aria-label="Kabel ${c + 1},${r + 1} drehen">${svg(grid[r]![c]!, on.has(c + ',' + r))}</button>`;
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
      grid[r]![c] = rot(grid[r]![c]!);
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
      $('#pBar')!.style.width = (left / T) * 100 + '%';
      $('#pT')!.textContent = Math.ceil(left) + ' s';
      if (left <= 0) end(false);
    }, 250);
    function end(ok: boolean): void {
      if (over) return;
      over = true;
      clearInterval(iv);
      setTimeout(
        () =>
          resultBox(
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

/* ---------- 4. Keep the grid stable ---------- */
function miniFreq(x: SiteView, R: Random): Promise<boolean> {
  return new Promise((res) => {
    const W = 320,
      H = 280,
      NEED = 15,
      LIMIT = 38;
    openModal(
      `<h2>Netz stabilisieren · ${siteName(x)}</h2>
      <p class="muted" style="margin:0">Nach der Störung schwankt das Netz. Halte die Frequenz nahe 50 Hz, indem du die Einspeisung mit ← → oder den Tasten regelst. Sammle ${NEED} Sekunden im grünen Band. Fällt die Frequenz unter 49,1 Hz oder steigt über 50,9 Hz, gibt es einen Blackout.</p>
      <div class="hud"><span id="fS">Stabil 0/${NEED} s</span><span id="fT">${LIMIT} s</span></div>
      <div class="timebar"><i id="fBar" style="width:0%;background:var(--good)"></i></div>
      <div class="game-wrap"><canvas id="mg"></canvas></div>
      <div class="row" style="justify-content:center" id="mgCtl"><button class="btn big" id="fDn">− Leistung</button><button class="btn primary big" id="fGo">Start</button><button class="btn big" id="fUp">+ Leistung</button></div>`,
      { locked: true },
    );
    const cv = $<HTMLCanvasElement>('#mg')!,
      ctx = setupCanvas(cv, W, H);
    const S = {
      run: false,
      done: false,
      D: 1000,
      Gn: 1000,
      set: 1000,
      f: 50,
      ok: 0,
      t: 0,
      next: 3,
      up: false,
      dn: false,
      trace: [] as number[],
    };
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        S.up = true;
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        S.dn = true;
        e.preventDefault();
      }
      if ((e.key === ' ' || e.key === 'Enter') && !S.run && !S.done) {
        start();
        e.preventDefault();
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') S.up = false;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') S.dn = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const hold = (el: HTMLElement, k: 'up' | 'dn') => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        S[k] = true;
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => el.addEventListener(t, () => (S[k] = false)));
    };
    hold($('#fUp')!, 'up');
    hold($('#fDn')!, 'dn');
    const start = () => {
      S.run = true;
      const b = $<HTMLButtonElement>('#fGo')!;
      b.disabled = true;
      b.textContent = 'Läuft …';
      last = performance.now();
    };
    $<HTMLButtonElement>('#fGo')!.onclick = start;
    let last = performance.now(),
      raf = 0;
    function finish(ok: boolean): void {
      S.done = true;
      S.run = false;
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      $('#mgCtl')!.remove();
      setTimeout(() => {
        cancelAnimationFrame(raf);
        resultBox(
          ok,
          ok ? 'Netz stabil' : 'Blackout',
          ok
            ? 'Die Frequenz ist stabil, das Kraftwerk ist wieder am Netz.'
            : 'Die Schutzschaltung hat ausgelöst. Das Kraftwerk bleibt vom Netz, bis du es erneut versuchst oder den Servicetrupp rufst.',
          () => res(ok),
        );
      }, 700);
    }
    function frame(t: number): void {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (S.run) {
        S.t += dt;
        if (S.up) S.set += 110 * dt;
        if (S.dn) S.set -= 110 * dt;
        S.Gn += clamp(S.set - S.Gn, -90 * dt, 90 * dt);
        S.D += gauss(R) * 40 * dt * 3;
        S.next -= dt;
        if (S.next <= 0) {
          S.D += pick(R, [-1, 1]) * rand(R, 70, 150);
          S.next = rand(R, 2.5, 5);
        }
        const ft = 50 + (S.Gn - S.D) / 220;
        S.f += (ft - S.f) * dt * 1.8;
        if (Math.abs(S.f - 50) <= 0.2) S.ok += dt;
        S.trace.push(S.f);
        if (S.trace.length > 160) S.trace.shift();
        $('#fS')!.textContent = 'Stabil ' + Math.floor(S.ok) + '/' + NEED + ' s';
        $('#fT')!.textContent = Math.ceil(LIMIT - S.t) + ' s';
        $('#fBar')!.style.width = Math.min(100, (S.ok / NEED) * 100) + '%';
        if (Math.abs(S.f - 50) > 0.9) finish(false);
        else if (S.ok >= NEED) finish(true);
        else if (S.t >= LIMIT) finish(false);
      }
      ctx.fillStyle = '#0f1715';
      ctx.fillRect(0, 0, W, H);
      const Y = (f: number) => 140 - (f - 50) * 120;
      ctx.fillStyle = 'rgba(76,191,115,.18)';
      ctx.fillRect(0, Y(50.2), W, Y(49.8) - Y(50.2));
      ctx.fillStyle = 'rgba(242,112,95,.22)';
      ctx.fillRect(0, 0, W, Y(50.9));
      ctx.fillRect(0, Y(49.1), W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.12)';
      ctx.fillStyle = '#93a59d';
      ctx.font = '11px "JetBrains Mono",monospace';
      for (const f of [49.2, 49.6, 50, 50.4, 50.8]) {
        ctx.beginPath();
        ctx.moveTo(40, Y(f));
        ctx.lineTo(W, Y(f));
        ctx.stroke();
        ctx.fillText(f.toFixed(1), 4, Y(f) + 4);
      }
      ctx.strokeStyle = '#E3A008';
      ctx.lineWidth = 2;
      ctx.beginPath();
      S.trace.forEach((f, i) => {
        const xx = 40 + (i * (W - 50)) / 160;
        if (i) ctx.lineTo(xx, Y(f));
        else ctx.moveTo(xx, Y(f));
      });
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = '#fff';
      ctx.font = '600 22px "JetBrains Mono",monospace';
      ctx.textAlign = 'right';
      ctx.fillText(S.f.toFixed(2) + ' Hz', W - 10, 30);
      ctx.font = '11px "JetBrains Mono",monospace';
      ctx.fillStyle = '#93a59d';
      ctx.fillText('Last ' + Math.round(S.D) + ' MW · Einspeisung ' + Math.round(S.Gn) + ' MW', W - 10, H - 10);
      ctx.textAlign = 'left';
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  });
}
