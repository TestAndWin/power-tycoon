/** Minigame 4 – keep the grid stable: hold the frequency near 50 Hz while the load jumps. */
import { clamp, gauss, pick, rand, type Random, type SiteView } from '@power-tycoon/engine';
import { openModal } from '../modal.js';
import { $ } from '../state.js';
import { siteName } from '../texts.js';
import { animate, finishAnimated, listenKeys, setupCanvas } from './common.js';

const W = 320,
  H = 280;
/** Seconds needed in the green band, and the time limit. */
export const NEED = 15;
export const LIMIT = 38;

/** Load (D) and feed-in (Gn) in MW; the frequency follows their balance with some inertia. */
export class FrequencyControl {
  run = false;
  done = false;
  D = 1000;
  Gn = 1000;
  /** Feed-in set point, moved by the player. */
  set = 1000;
  f = 50;
  /** Seconds within ±0.2 Hz. */
  ok = 0;
  t = 0;
  /** Time until the next load jump. */
  next = 3;
  up = false;
  dn = false;
  /** Recent frequencies for the chart. */
  trace: number[] = [];

  constructor(private readonly R: Random) {}

  /** Advances a running game by `dt` seconds; returns the result once it is decided. */
  step(dt: number): 'stable' | 'blackout' | 'timeout' | null {
    const R = this.R;
    this.t += dt;
    if (this.up) this.set += 110 * dt;
    if (this.dn) this.set -= 110 * dt;
    this.Gn += clamp(this.set - this.Gn, -90 * dt, 90 * dt);
    this.D += gauss(R) * 40 * dt * 3;
    this.next -= dt;
    if (this.next <= 0) {
      this.D += pick(R, [-1, 1]) * rand(R, 70, 150);
      this.next = rand(R, 2.5, 5);
    }
    const ft = 50 + (this.Gn - this.D) / 220;
    this.f += (ft - this.f) * dt * 1.8;
    if (Math.abs(this.f - 50) <= 0.2) this.ok += dt;
    this.trace.push(this.f);
    if (this.trace.length > 160) this.trace.shift();
    if (Math.abs(this.f - 50) > 0.9) return 'blackout';
    if (this.ok >= NEED) return 'stable';
    if (this.t >= LIMIT) return 'timeout';
    return null;
  }
}

/** Frequency chart with the green band, the red limits and the current values. */
function drawTrace(ctx: CanvasRenderingContext2D, m: FrequencyControl): void {
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
  m.trace.forEach((f, i) => {
    const xx = 40 + (i * (W - 50)) / 160;
    if (i) ctx.lineTo(xx, Y(f));
    else ctx.moveTo(xx, Y(f));
  });
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = '#fff';
  ctx.font = '600 22px "JetBrains Mono",monospace';
  ctx.textAlign = 'right';
  ctx.fillText(m.f.toFixed(2) + ' Hz', W - 10, 30);
  ctx.font = '11px "JetBrains Mono",monospace';
  ctx.fillStyle = '#93a59d';
  ctx.fillText('Last ' + Math.round(m.D) + ' MW · Einspeisung ' + Math.round(m.Gn) + ' MW', W - 10, H - 10);
  ctx.textAlign = 'left';
}

export function miniFreq(x: SiteView, R: Random): Promise<boolean> {
  return new Promise((res) => {
    openModal(
      `<h2>Netz stabilisieren · ${siteName(x)}</h2>
      <p class="muted" style="margin:0">Nach der Störung schwankt das Netz. Halte die Frequenz nahe 50 Hz, indem du die Einspeisung mit ← → oder den Tasten regelst. Sammle ${NEED} Sekunden im grünen Band. Fällt die Frequenz unter 49,1 Hz oder steigt über 50,9 Hz, gibt es einen Blackout.</p>
      <div class="hud"><span id="fS">Stabil 0/${NEED} s</span><span id="fT">${LIMIT} s</span></div>
      <div class="timebar"><i id="fBar" style="width:0%;background:var(--good)"></i></div>
      <div class="game-wrap"><canvas id="mg"></canvas></div>
      <div class="row" style="justify-content:center" id="mgCtl"><button class="btn big" id="fDn">− Leistung</button><button class="btn primary big" id="fGo">Start</button><button class="btn big" id="fUp">+ Leistung</button></div>`,
      { locked: true },
    );
    const ctx = setupCanvas($<HTMLCanvasElement>('#mg')!, W, H);
    const m = new FrequencyControl(R);
    const start = () => {
      m.run = true;
      const b = $<HTMLButtonElement>('#fGo')!;
      b.disabled = true;
      b.textContent = 'Läuft …';
      loop.resetClock();
    };
    const unlisten = listenKeys({
      keydown: (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          m.up = true;
          e.preventDefault();
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          m.dn = true;
          e.preventDefault();
        }
        if ((e.key === ' ' || e.key === 'Enter') && !m.run && !m.done) {
          start();
          e.preventDefault();
        }
      },
      keyup: (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') m.up = false;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') m.dn = false;
      },
    });
    const hold = (el: HTMLElement, k: 'up' | 'dn') => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        m[k] = true;
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => el.addEventListener(t, () => (m[k] = false)));
    };
    hold($('#fUp')!, 'up');
    hold($('#fDn')!, 'dn');
    $<HTMLButtonElement>('#fGo')!.onclick = start;
    const finish = (ok: boolean) => {
      m.done = true;
      m.run = false;
      unlisten();
      finishAnimated(
        loop,
        700,
        ok,
        ok ? 'Netz stabil' : 'Blackout',
        ok
          ? 'Die Frequenz ist stabil, das Kraftwerk ist wieder am Netz.'
          : 'Die Schutzschaltung hat ausgelöst. Das Kraftwerk bleibt vom Netz, bis du es erneut versuchst oder den Servicetrupp rufst.',
        () => res(ok),
      );
    };
    const loop = animate((_t, dt) => {
      if (m.run) {
        const outcome = m.step(dt);
        $('#fS')!.textContent = 'Stabil ' + Math.floor(m.ok) + '/' + NEED + ' s';
        $('#fT')!.textContent = Math.ceil(LIMIT - m.t) + ' s';
        $('#fBar')!.style.width = Math.min(100, (m.ok / NEED) * 100) + '%';
        if (outcome) finish(outcome === 'stable');
      }
      drawTrace(ctx, m);
    });
  });
}
