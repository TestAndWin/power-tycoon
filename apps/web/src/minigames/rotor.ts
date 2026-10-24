/** Minigame 2 – rotor assembly: drop the swinging blade onto the hub at the right moment. */
import { rand, type Random, type SiteView } from '@power-tycoon/engine';
import { openModal } from '../modal.js';
import { SND } from '../sound.js';
import { $ } from '../state.js';
import { siteName } from '../texts.js';
import { animate, finishAnimated, listenKeys, setupCanvas } from './common.js';

const W = 320,
  H = 380,
  hubX = 160,
  hubY = 150,
  pivotX = 160;

/** Blades needed and misses allowed. */
export const BLADES = 3;
export const MISSES = 3;

/** The assembly: a blade swings on the crane hook; released, it falls and hits the hub or not. */
export class RotorAssembly {
  blades = 0;
  miss = 0;
  /** Swing time (the pendulum phase). */
  t = 0;
  /** Progress of the falling blade (0..1) and where it was released. */
  drop = 0;
  dropX = 0;
  state: 'swing' | 'drop' = 'swing';
  /** Green/red flash after a blade arrived. */
  flash = 0;
  flashOk = false;
  done = false;

  constructor(
    readonly offshore: boolean,
    private readonly R: Random,
  ) {}

  private amp(): number {
    return (this.offshore ? 62 : 48) + this.blades * 10;
  }
  private spd(): number {
    return (this.offshore ? 2.3 : 1.8) + this.blades * 0.35;
  }
  /** x of the blade on the hook. */
  hookX(): number {
    return pivotX + Math.sin(this.t * this.spd()) * this.amp() + Math.sin(this.t * 3.7) * (this.offshore ? 9 : 4);
  }

  /** Releases the blade; false if one is already falling or the assembly is over. */
  release(): boolean {
    if (this.state !== 'swing' || this.done) return false;
    this.state = 'drop';
    this.drop = 0;
    this.dropX = this.hookX();
    return true;
  }

  /** Advances by `dt` seconds; returns whether a blade arrived and fits ('hit') or not ('miss'). */
  update(dt: number): 'hit' | 'miss' | null {
    let arrived: 'hit' | 'miss' | null = null;
    // the hook hangs still once the assembly is over
    if (this.state === 'swing' && !this.done) this.t += dt;
    if (this.state === 'drop') {
      this.drop += dt * 2.4;
      if (this.drop >= 1) {
        const ok = Math.abs(this.dropX - hubX) <= 11;
        this.flash = 0.6;
        this.flashOk = ok;
        if (ok) this.blades++;
        else this.miss++;
        arrived = ok ? 'hit' : 'miss';
        this.state = 'swing';
        if (this.blades >= BLADES || this.miss >= MISSES) this.done = true;
        else this.t += rand(this.R, 0, 3);
      }
    }
    this.flash = Math.max(0, this.flash - dt);
    return arrived;
  }

  get success(): boolean {
    return this.blades >= BLADES;
  }
}

/** A lattice boom from foot to tip: two chords with zigzag bracing. */
function drawLattice(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0),
    nx = (-(y1 - y0) / len) * (w / 2),
    ny = ((x1 - x0) / len) * (w / 2),
    // the boom tapers towards the tip
    at = (f: number, side: number): [number, number] => {
      const s = side * (1 - f * 0.5);
      return [x0 + (x1 - x0) * f + nx * s, y0 + (y1 - y0) * f + ny * s];
    };
  ctx.strokeStyle = '#c98f00';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const n = Math.max(2, Math.round(len / 12));
  for (let i = 0; i <= n; i++) {
    const [px, py] = at(i / n, i % 2 ? 1 : -1);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.strokeStyle = '#e0a100';
  ctx.lineWidth = 2.2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(...at(0, side));
    ctx.lineTo(...at(1, side));
    ctx.stroke();
  }
  ctx.lineWidth = 1;
}

/** Crawler crane with lattice boom; offshore it stands on the installation vessel. */
function drawCrane(ctx: CanvasRenderingContext2D, off: boolean, bob: number): void {
  let gy = H - 40;
  if (off) {
    // installation vessel
    gy = H - 70 + bob;
    ctx.fillStyle = '#5d6c78';
    ctx.strokeStyle = '#2f3a42';
    ctx.beginPath();
    ctx.moveTo(-10, gy);
    ctx.lineTo(132, gy);
    ctx.lineTo(120, gy + 22);
    ctx.lineTo(-10, gy + 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b8402f';
    ctx.fillRect(-10, gy + 16, 128, 6);
    ctx.fillStyle = '#eef1f0';
    ctx.fillRect(4, gy - 16, 22, 16);
    ctx.strokeRect(4, gy - 16, 22, 16);
  }
  const bx = off ? 40 : 20;
  // tracks
  ctx.fillStyle = '#4a4f4d';
  ctx.strokeStyle = '#2b2f2e';
  ctx.beginPath();
  ctx.roundRect(bx, gy - 12, 84, 12, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8b918f';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(bx + 9 + i * 16.5, gy - 6, 3, 0, 7);
    ctx.fill();
  }
  // counterweight, superstructure and cab
  ctx.fillStyle = '#5b5f5d';
  ctx.fillRect(bx - 4, gy - 34, 24, 20);
  ctx.strokeRect(bx - 4, gy - 34, 24, 20);
  ctx.fillStyle = '#e0a100';
  ctx.strokeStyle = '#5c4500';
  ctx.fillRect(bx + 18, gy - 30, 50, 18);
  ctx.strokeRect(bx + 18, gy - 30, 50, 18);
  ctx.fillRect(bx + 66, gy - 40, 16, 28);
  ctx.strokeRect(bx + 66, gy - 40, 16, 28);
  ctx.fillStyle = '#9cc3dd';
  ctx.fillRect(bx + 70, gy - 36, 9, 10);
  // A-frame mast with luffing ropes to the boom tip
  const footX = bx + 52,
    footY = gy - 30,
    mastX = bx + 14,
    mastY = gy - 82,
    tipX = pivotX,
    tipY = 10 + bob;
  drawLattice(ctx, bx + 26, gy - 30, mastX, mastY, 6);
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(bx, gy - 34);
  ctx.lineTo(mastX, mastY);
  ctx.lineTo(tipX - 2, tipY + 2);
  ctx.moveTo(mastX + 2, mastY + 3);
  ctx.lineTo(tipX - 3, tipY + 5);
  ctx.stroke();
  drawLattice(ctx, footX, footY, tipX, tipY, 12);
  // boom head sheave
  ctx.fillStyle = '#5b5f5d';
  ctx.beginPath();
  ctx.arc(tipX, tipY + 3, 3.5, 0, 7);
  ctx.fill();
}

/** Sky, ground or sea, the tower with the mounted blades, the crane and the blade on the hook. */
function drawRotorScene(ctx: CanvasRenderingContext2D, m: RotorAssembly, t: number): void {
  const off = m.offshore;
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
  for (let k = 0; k < m.blades; k++) {
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
  drawCrane(ctx, off, bob);
  // rope, hook block and sling with the blade
  const hx = m.state === 'drop' ? m.dropX : m.hookX();
  const hy = m.state === 'drop' ? 76 + m.drop * (hubY - 76 - 14) : 76 + bob;
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(pivotX, 13 + bob);
  ctx.lineTo(hx, hy - 58);
  ctx.stroke();
  ctx.fillStyle = '#e0a100';
  ctx.strokeStyle = '#5c4500';
  ctx.fillRect(hx - 5, hy - 58, 10, 8);
  ctx.strokeRect(hx - 5, hy - 58, 10, 8);
  if (!m.done || m.state === 'drop') {
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(hx - 4, hy - 43);
    ctx.lineTo(hx, hy - 50);
    ctx.lineTo(hx + 4, hy - 43);
    ctx.stroke();
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
  if (m.flash > 0) {
    ctx.fillStyle = m.flashOk ? `rgba(46,158,87,${m.flash * 0.5})` : `rgba(210,59,43,${m.flash * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export function miniRotor(x: SiteView, R: Random): Promise<boolean> {
  return new Promise((res) => {
    const off = x.type === 'off';
    openModal(
      `<h2>Rotor-Montage · ${siteName(x)}</h2>
      <p class="muted" style="margin:0">Das Rotorblatt pendelt am Kranhaken${off ? ' – auf See schwankt zusätzlich das Errichterschiff' : ''}. Drück „Absetzen“, wenn die Blattwurzel genau vor der Nabe hängt. Drei Blätter müssen dran, drei Fehlversuche beenden die Montage.</p>
      <div class="hud"><span id="rB">Blätter 0/3</span><span id="rM">Fehlversuche 0/3</span></div>
      <div class="game-wrap"><canvas id="mg"></canvas></div>
      <div class="row" style="justify-content:center" id="mgCtl"><button class="btn primary big" id="bSet">Absetzen</button></div>`,
      { locked: true, minigame: true },
    );
    const ctx = setupCanvas($<HTMLCanvasElement>('#mg')!, W, H);
    const m = new RotorAssembly(off, R);
    const act = () => {
      if (!loop.paused() && m.release()) SND.whoosh();
    };
    $<HTMLButtonElement>('#bSet')!.onclick = act;
    const unlisten = listenKeys({
      keydown: (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          act();
        }
      },
    });
    const loop = animate((t, dt) => {
      const arrived = m.update(dt);
      if (arrived) {
        if (arrived === 'hit') SND.clank();
        else SND.fail();
        $('#rB')!.textContent = 'Blätter ' + m.blades + '/3';
        $('#rM')!.textContent = 'Fehlversuche ' + m.miss + '/3';
        if (m.done) {
          unlisten();
          const ok = m.success;
          finishAnimated(
            loop,
            900,
            ok,
            ok ? 'Rotor montiert' : 'Montage abgebrochen',
            ok
              ? 'Alle drei Blätter sitzen. Die Anlage ist fertig und wartet auf den Netzanschluss.'
              : 'Zu viele beschädigte Blätter. Die Montage kann wiederholt werden (10 % der Baukosten).',
            () => res(ok),
          );
        }
      }
      drawRotorScene(ctx, m, t);
    });
  });
}
