/** Minigame 1 – site layout: place turbines or solar fields on a grid of yield values. */
import { clamp, rand, type Random, type SiteView } from '@power-tycoon/engine';
import { openModal } from '../modal.js';
import { SND } from '../sound.js';
import { $ } from '../state.js';
import { siteName } from '../texts.js';
import { resultBox } from './common.js';
import { HOUSE, PANEL, TREES, TURBINE } from './icons.js';

export type LayoutKind = 'solar' | 'onshore' | 'offshore';

export interface LayoutCell {
  c: number;
  r: number;
  /** Relative yield (wind or sun) of the cell. */
  v: number;
  kind: 'ok' | 'block' | 'shade';
  on: boolean;
}

/**
 * The playing field and its rules: solar fields shade the field north of them, turbines slow down the
 * three fields east of them (wake) and a little the fields above and below.
 */
export class LayoutField {
  readonly cols = 8;
  readonly rows = 5;
  /** Number of turbines or fields to place. */
  readonly need: number;
  readonly cells: LayoutCell[] = [];
  /** Sum of the best values (upper bound for the score). */
  private readonly ideal: number;

  constructor(
    readonly kind: LayoutKind,
    R: Random,
  ) {
    const solar = kind === 'solar',
      off = kind === 'offshore';
    this.need = solar ? 6 : off ? 6 : 5;
    const seed = [rand(R, 0, 6), rand(R, 0, 6), rand(R, 0, 6)] as const;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        let v =
          0.88 +
          0.12 * Math.sin(c * 0.9 + seed[0]) * Math.cos(r * 1.1 + seed[1]) +
          0.06 * Math.sin((c + r) * 1.7 + seed[2]);
        if (solar) v += (r - 2) * 0.03;
        let kind: LayoutCell['kind'] = 'ok';
        if (!off && R() < (solar ? 0.1 : 0.14)) kind = 'block';
        else if (solar && R() < 0.14) {
          kind = 'shade';
          v = 0.45;
        }
        this.cells.push({ c, r, v: clamp(v, 0.4, 1.12), kind, on: false });
      }
    this.ideal = this.cells
      .filter((t) => t.kind !== 'block')
      .map((t) => t.v)
      .sort((a, b) => b - a)
      .slice(0, this.need)
      .reduce((a, b) => a + b, 0);
  }

  at(c: number, r: number): LayoutCell {
    return this.cells[r * this.cols + c]!;
  }

  placed(): number {
    return this.cells.filter((t) => t.on).length;
  }

  /** Places or removes at cell `k`; false if that is not possible (blocked, or all placed). */
  toggle(k: number): boolean {
    const t = this.cells[k]!;
    if (t.kind === 'block') return false;
    if (!t.on && this.placed() >= this.need) return false;
    t.on = !t.on;
    return true;
  }

  /** Yield of cell `k` including shading or wake losses. */
  yieldOf(k: number): number {
    const t = this.cells[k]!;
    let y = t.v;
    if (this.kind === 'solar') {
      const s = t.r + 1 < this.rows && this.at(t.c, t.r + 1).on;
      if (s) y *= 0.78;
    } else {
      for (let d = 1; d <= 3; d++) if (t.c - d >= 0 && this.at(t.c - d, t.r).on) y *= 0.72 + (d - 1) * 0.08;
      for (const dr of [-1, 1]) {
        const n = t.r + dr >= 0 && t.r + dr < this.rows ? this.at(t.c, t.r + dr) : null;
        if (n && n.on) y *= 0.92;
      }
    }
    return y;
  }

  /** Efficiency of the plant (0.80 … 1.15). */
  score(): number {
    const on = this.cells.map((t, k) => (t.on ? this.yieldOf(k) : 0)).reduce((a, b) => a + b, 0);
    return clamp(0.8 + (0.35 * on) / this.ideal, 0.8, 1.15);
  }

  /** Cells in the wake of a placed turbine ("c,r"). */
  wake(): Set<string> {
    const wake = new Set<string>();
    if (this.kind !== 'solar')
      for (const t of this.cells) {
        if (t.on) for (let d = 1; d <= 3; d++) if (t.c + d < this.cols) wake.add(t.c + d + ',' + t.r);
      }
    return wake;
  }
}

export function miniLayout(x: SiteView, R: Random): Promise<number> {
  return new Promise((res) => {
    const solar = x.type === 'solar',
      off = x.type === 'off';
    const field = new LayoutField(solar ? 'solar' : off ? 'offshore' : 'onshore', R);
    const { cols: C, need: N, cells } = field;
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
      { locked: true, minigame: true },
    );
    const lay = $('#lay')!;
    const icon = (t: LayoutCell) =>
      t.on ? (solar ? PANEL : TURBINE) : t.kind === 'block' ? (solar ? TREES : HOUSE) : t.kind === 'shade' ? TREES : '';
    function draw(): void {
      const n = field.placed();
      const wake = field.wake();
      lay.innerHTML = cells
        .map(
          (t, k) =>
            `<button class="lc ${t.kind === 'block' ? 'block' : ''} ${t.kind === 'shade' ? 'shade' : ''} ${off ? 'sea' : ''} ${wake.has(t.c + ',' + t.r) && !t.on ? 'wake' : ''} ${t.on ? 'on' : ''}" data-k="${k}" style="--bg:${t.kind === 'shade' ? '#7f9a7c' : col(t.v)}" aria-label="Feld ${t.c + 1},${t.r + 1}${t.on ? ' belegt' : ''}${t.kind === 'block' ? ' gesperrt' : ''}" ${t.kind === 'block' ? 'disabled' : ''}>${icon(t)}</button>`,
        )
        .join('');
      $('#lCnt')!.textContent = n + '/' + N;
      $('#lScore')!.textContent = 'Wirkungsgrad ' + (n ? Math.round(field.score() * 100) + ' %' : '–');
      $<HTMLButtonElement>('#lOk')!.disabled = n !== N;
    }
    lay.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.lc');
      if (!b) return;
      const k = +b.dataset.k!;
      if (!field.toggle(k)) return;
      if (cells[k]!.on) SND.place();
      else SND.click();
      draw();
      lay.querySelector<HTMLElement>(`[data-k="${b.dataset.k}"]`)?.focus();
    });
    $<HTMLButtonElement>('#lOk')!.onclick = () => {
      const s = Math.round(field.score() * 100) / 100;
      $('#lOk')!.parentElement!.style.visibility = 'hidden';
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
