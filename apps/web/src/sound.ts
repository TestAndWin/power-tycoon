/** Synthesized sound effects, ported unchanged from legacy/src/sound.js. */
import { mwh, money } from './format.js';
import { RMO } from './state.js';

type Win = Window & { webkitAudioContext?: typeof AudioContext };

export const SND = {
  ctx: null as AudioContext | null,
  on: true,
  init() {
    if (!this.ctx) {
      try {
        const W = window as Win;
        this.ctx = new (window.AudioContext || W.webkitAudioContext!)();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  },
  tone(f: number, d: number, type?: OscillatorType, v?: number, f2?: number | null, delay?: number) {
    if (!this.on) return;
    this.init();
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v || 0.06, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + d + 0.03);
  },
  noise(d: number, v?: number, freq?: number, delay?: number, q?: number) {
    if (!this.on) return;
    this.init();
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + (delay || 0);
    const b = c.createBuffer(1, Math.ceil(c.sampleRate * d), c.sampleRate),
      a = b.getChannelData(0);
    // audio noise is not game randomness
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = b;
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq || 800, t);
    f.Q.value = q || 1;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v || 0.05, t + d * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f).connect(g).connect(c.destination);
    s.start(t);
    s.stop(t + d);
  },
  click() {
    this.tone(1100, 0.04, 'triangle', 0.025);
  },
  place() {
    this.tone(520, 0.07, 'triangle', 0.05, 780);
  },
  coin() {
    this.tone(988, 0.07, 'square', 0.025);
    this.tone(1319, 0.14, 'square', 0.025, null, 0.07);
  },
  ok() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.05, null, i * 0.085));
  },
  fail() {
    this.tone(330, 0.4, 'sawtooth', 0.035, 110);
  },
  alarm() {
    this.tone(880, 0.12, 'square', 0.03);
    this.tone(660, 0.12, 'square', 0.03, null, 0.16);
    this.tone(880, 0.12, 'square', 0.03, null, 0.32);
  },
  whoosh() {
    this.noise(0.6, 0.07, 500, 0, 0.7);
  },
  clank() {
    this.tone(160, 0.15, 'square', 0.04, 80);
    this.noise(0.12, 0.05, 2400, 0.02, 3);
  },
  zap() {
    this.tone(220, 0.25, 'sawtooth', 0.03, 880);
    this.noise(0.15, 0.03, 4000, 0.05, 2);
  },
  report() {
    this.tone(392, 0.12, 'sine', 0.05);
    this.tone(523, 0.18, 'sine', 0.05, null, 0.1);
  },
  /** A folder slides onto the desk. */
  paper() {
    this.noise(0.22, 0.04, 3200, 0, 0.8);
  },
  /** The phone vibrates on the desk. */
  buzz() {
    for (let i = 0; i < 3; i++) this.tone(150, 0.12, 'sawtooth', 0.03, 140, i * 0.2);
  },
  /** The quarter stamp hits the report. */
  stamp() {
    this.tone(110, 0.12, 'square', 0.05, 60);
    this.noise(0.08, 0.06, 900, 0, 1.5);
  },
};
try {
  SND.on = localStorage.getItem('wattmogul-sound') !== 'off';
} catch {
  /* ignore */
}

export function toggleSound(): void {
  SND.on = !SND.on;
  try {
    localStorage.setItem('wattmogul-sound', SND.on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  if (SND.on) {
    SND.init();
    SND.ok();
  }
}

/** Animated count-up of numbers in reports. */
export function countUp(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const v = +el.dataset.count!,
      f = el.dataset.fmt === 'mwh' ? mwh : (x: number) => money(x);
    if (RMO) {
      el.textContent = f(v);
      return;
    }
    const t0 = performance.now(),
      D = 700;
    const step = (n: number) => {
      const k = Math.min(1, (n - t0) / D),
        e = 1 - Math.pow(1 - k, 3);
      el.textContent = f(v * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
