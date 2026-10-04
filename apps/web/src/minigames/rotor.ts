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
    if (this.state === 'swing') this.t += dt;
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
        this.t += rand(this.R, 0, 3);
        if (this.blades >= BLADES || this.miss >= MISSES) this.done = true;
      }
    }
    this.flash = Math.max(0, this.flash - dt);
    return arrived;
  }

  get success(): boolean {
    return this.blades >= BLADES;
  }
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
  const hx = m.state === 'drop' ? m.dropX : m.hookX();
  const hy = m.state === 'drop' ? 40 + m.drop * (hubY - 40 - 14) : 40 + bob;
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(pivotX, 20);
  ctx.lineTo(hx, hy - 40);
  ctx.stroke();
  if (!m.done || m.state === 'drop') {
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
      if (m.release()) SND.whoosh();
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
