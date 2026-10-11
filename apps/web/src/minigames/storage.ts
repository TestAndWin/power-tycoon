/**
 * Minigame 5 – storage schedule: plan a day of charging and discharging against the price curve. The share of
 * the best possible profit rates the storage (efficiency), like the layout rates a park.
 */
import { clamp, PLANTS, rand, type Random, type RegionKey, type SiteView } from '@power-tycoon/engine';
import { openModal } from '../modal.js';
import { SND } from '../sound.js';
import { $ } from '../state.js';
import { siteName } from '../texts.js';
import { resultBox } from './common.js';

export type SlotPlan = 'idle' | 'charge' | 'discharge';

/** Two-hour slots of the day. */
export const SLOTS = 12;
/** Charges the storage holds (one charge per slot). */
export const STORE_CAP = 3;
/** Share of the best profit that still counts as the worst schedule (0.80); the best one gives 1.15. */
const SCORE_FLOOR = 0.4;

const bump = (h: number, at: number, width: number): number => Math.exp(-(((h - at) / width) ** 2));

/** The price curve of a day and the player's plan; charging and discharging must stay within 0 … `STORE_CAP`. */
export class StorageSchedule {
  /** Price per slot in €/MWh. */
  readonly prices: number[] = [];
  readonly plan: SlotPlan[] = Array<SlotPlan>(SLOTS).fill('idle');
  /** Highest possible profit of the day (upper bound for the score). */
  readonly best: number;

  constructor(
    /** Round-trip efficiency: of each charge only this share is sold. */
    readonly eta: number,
    region: RegionKey,
    R: Random,
  ) {
    // much sun means cheap power at noon
    const sunny = region === 'ib' || region === 'al';
    const night = rand(R, 20, 35),
      morning = rand(R, 15, 40),
      noon = sunny ? rand(R, 35, 55) : rand(R, 10, 25),
      evening = rand(R, 40, 65);
    for (let k = 0; k < SLOTS; k++) {
      const h = 2 * k + 1;
      const p =
        75 -
        night * bump(h, 3, 2.6) +
        morning * bump(h, 8, 1.8) -
        noon * bump(h, 13, 2.2) +
        evening * bump(h, 19, 2) +
        rand(R, -7, 7);
      this.prices.push(Math.round(clamp(p, 8, 180)));
    }
    this.best = this.optimum();
  }

  /** Changes slot `k`: idle → charge → discharge → idle. */
  cycle(k: number): SlotPlan {
    const next: Record<SlotPlan, SlotPlan> = { idle: 'charge', charge: 'discharge', discharge: 'idle' };
    return (this.plan[k] = next[this.plan[k]!]);
  }

  /** State of charge after each slot. */
  soc(): number[] {
    let s = 0;
    return this.plan.map((a) => (s += a === 'charge' ? 1 : a === 'discharge' ? -1 : 0));
  }

  /** First slot where the storage would be empty or overfull, or -1. */
  firstError(): number {
    return this.soc().findIndex((s) => s < 0 || s > STORE_CAP);
  }

  /** Profit of the plan in € per MWh of a charge. */
  profit(): number {
    return this.plan.reduce(
      (s, a, k) => s + (a === 'charge' ? -this.prices[k]! : a === 'discharge' ? this.prices[k]! * this.eta : 0),
      0,
    );
  }

  /** Efficiency of the storage (0.80 … 1.15); an impossible plan counts as the worst one. */
  score(): number {
    if (this.firstError() >= 0 || this.best <= 0) return 0.8;
    return 0.8 + 0.35 * clamp((this.profit() / this.best - SCORE_FLOOR) / (1 - SCORE_FLOOR), 0, 1);
  }

  /** Best profit over all plans (dynamic programming over the state of charge). */
  private optimum(): number {
    let v = Array<number>(STORE_CAP + 1).fill(-Infinity);
    v[0] = 0;
    for (const p of this.prices) {
      const n = [...v];
      for (let s = 0; s <= STORE_CAP; s++) {
        if (v[s] === -Infinity) continue;
        if (s < STORE_CAP) n[s + 1] = Math.max(n[s + 1]!, v[s]! - p);
        if (s > 0) n[s - 1] = Math.max(n[s - 1]!, v[s]! + p * this.eta);
      }
      v = n;
    }
    return Math.max(...v);
  }
}

const PLAN_TEXT: Record<SlotPlan, string> = { idle: 'Pause', charge: 'Laden', discharge: 'Entladen' };
/** Short marks on the narrow slots (the legend and the label name them). */
const PLAN_MARK: Record<SlotPlan, string> = { idle: '·', charge: '▲', discharge: '▼' };

export function miniStorage(x: SiteView, R: Random): Promise<number> {
  return new Promise((res) => {
    const eta = PLANTS[x.type === 'pump' ? 'pump' : 'batt'].eta ?? 0.85;
    const m = new StorageSchedule(eta, x.r, R);
    const top = Math.max(...m.prices);
    openModal(
      `<h2>Fahrplan · ${siteName(x)}</h2>
      <p class="muted" style="margin:0">Stell die Steuerung deines ${x.type === 'pump' ? 'Pumpspeichers' : 'Batteriespeichers'} ein. Klick auf einen Zeitblock: Laden, Entladen, Pause. Der Speicher fasst ${STORE_CAP} Ladungen und startet leer. Lade, wenn Strom billig ist, und entlade, wenn er teuer ist. Beim Entladen kommen nur ${Math.round(eta * 100)} % zurück.</p>
      <div class="hud"><span id="sProfit">Gewinn 0 €/MWh</span><span id="sScore">Wirkungsgrad –</span></div>
      <div class="sched" id="sched"></div>
      <div class="legend"><span><i class="lg chg"></i>▲ Laden</span><span><i class="lg dis"></i>▼ Entladen</span><span><i class="lg soc"></i>Füllstand</span><span>Zahlen: Preis in €/MWh, Uhrzeit</span></div>
      <div class="foot"><button class="btn primary big" id="sOk" disabled>Fahrplan übernehmen</button></div>`,
      { locked: true, minigame: true },
    );
    const box = $('#sched')!;
    function draw(): void {
      const soc = m.soc(),
        err = m.firstError();
      box.innerHTML = m.prices
        .map((p, k) => {
          const a = m.plan[k]!;
          const pips = Array.from(
            { length: STORE_CAP },
            (_, i) => `<i class="${i < clamp(soc[k]!, 0, STORE_CAP) ? 'on' : ''}"></i>`,
          ).join('');
          return `<button class="slot ${a} ${k === err ? 'err' : ''}" data-k="${k}" aria-label="${2 * k}–${2 * k + 2} Uhr, ${p} €/MWh: ${PLAN_TEXT[a]}">
            <span class="sp">${p}</span><span class="sbar"><i style="height:${Math.round((p / top) * 100)}%"></i></span>
            <span class="sa" aria-hidden="true">${PLAN_MARK[a]}</span><span class="pips">${pips}</span><span class="sh">${2 * k}</span></button>`;
        })
        .join('');
      const profit = m.profit();
      $('#sProfit')!.textContent =
        err >= 0
          ? soc[err]! < 0
            ? `Um ${2 * err} Uhr ist der Speicher leer`
            : `Um ${2 * err} Uhr ist der Speicher voll`
          : `Gewinn ${Math.round(profit)} €/MWh`;
      $('#sScore')!.textContent =
        'Wirkungsgrad ' + (err < 0 && m.plan.some((a) => a !== 'idle') ? Math.round(m.score() * 100) + ' %' : '–');
      $<HTMLButtonElement>('#sOk')!.disabled = err >= 0 || !m.plan.includes('discharge');
    }
    box.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.slot');
      if (!b) return;
      const k = +b.dataset.k!;
      if (m.cycle(k) === 'idle') SND.click();
      else SND.place();
      draw();
      box.querySelector<HTMLElement>(`[data-k="${k}"]`)?.focus();
    });
    $<HTMLButtonElement>('#sOk')!.onclick = () => {
      const s = Math.round(m.score() * 100) / 100;
      $('#sOk')!.parentElement!.style.visibility = 'hidden';
      resultBox(
        s >= 1,
        'Wirkungsgrad ' + Math.round(s * 100) + ' %',
        s >= 1.05
          ? 'Eine scharfe Steuerung. Der Speicher holt dauerhaft mehr aus dem Spread.'
          : s >= 0.95
            ? 'Solide eingestellt. Der Speicher läuft ungefähr nach Plan.'
            : 'Zu wenig Abstand zwischen Kauf- und Verkaufspreis. Der Speicher bleibt dauerhaft unter seinen Möglichkeiten.',
        () => res(s),
        s >= 1 ? 'Gut eingestellt' : 'Suboptimal',
      );
    };
    draw();
  });
}
