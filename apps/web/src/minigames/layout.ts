/** Minigame 1 – site layout: place turbines or solar fields on a grid of yield values. */
import { clamp, rand, type Random, type SiteView } from '@power-tycoon/engine';
import { openModal } from '../modal.js';
import { SND } from '../sound.js';
import { $ } from '../state.js';
import { siteName } from '../texts.js';
import { resultBox } from './common.js';
import { HOUSE, PANEL, SUBSTATION, TREES, TURBINE } from './icons.js';

export type LayoutKind = 'solar' | 'onshore' | 'offshore';

export interface LayoutCell {
  c: number;
  r: number;
  /** Relative yield (wind or sun) of the cell. */
  v: number;
  kind: 'ok' | 'block' | 'shade' | 'sub';
  on: boolean;
}

/** Yield lost in the cable per field of distance to the substation. */
export const CABLE_LOSS = 0.02;
/** Share of the best possible yield that still counts as the worst layout (0.80); the best one gives 1.15. */
const SCORE_FLOOR = 0.7;

/**
 * The playing field and its rules: solar fields shade the field north of them, turbines slow down the
 * three fields east of them (wake) and a little the fields above and below. Every unit loses yield in the
 * cable to the substation on the east edge, the more the farther away it stands.
 */
export class LayoutField {
  readonly cols = 8;
  readonly rows = 5;
  /** Number of turbines or fields to place. */
  readonly need: number;
  readonly cells: LayoutCell[] = [];
  /** The substation (east edge): it collects the power, nothing can be placed there. */
  readonly sub: { c: number; r: number };
  /** Best cell values after cable losses, without wake or shade, best first (upper bound for the score). */
  private readonly best: number[];

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
    this.sub = { c: this.cols - 1, r: Math.floor(R() * this.rows) };
    this.at(this.sub.c, this.sub.r).kind = 'sub';
    this.best = this.cells
      .filter((t) => t.kind !== 'block' && t.kind !== 'sub')
      .map((t) => t.v * this.cable(t))
      .sort((a, b) => b - a);
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
    if (t.kind === 'block' || t.kind === 'sub') return false;
    if (!t.on && this.placed() >= this.need) return false;
    t.on = !t.on;
    return true;
  }

  /** Share of the yield of cell `t` that arrives at the substation. */
  cable(t: Pick<LayoutCell, 'c' | 'r'>): number {
    return 1 - CABLE_LOSS * (Math.abs(t.c - this.sub.c) + Math.abs(t.r - this.sub.r));
  }

  /** Yield of cell `k` including shading or wake losses and the cable to the substation. */
  yieldOf(k: number): number {
    const t = this.cells[k]!;
    let y = t.v * this.cable(t);
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

  /**
   * Efficiency of the plant (0.80 … 1.15). While not all units are placed, the placed ones are measured
   * against the best cells of the same number, so the display reacts to every placement.
   */
  score(): number {
    const on = this.cells.map((t, k) => (t.on ? this.yieldOf(k) : 0)).reduce((a, b) => a + b, 0);
    const ideal = this.best.slice(0, this.placed()).reduce((a, b) => a + b, 0);
    if (!ideal) return 0.8;
    return 0.8 + 0.35 * clamp((on / ideal - SCORE_FLOOR) / (1 - SCORE_FLOOR), 0, 1);
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
      <p class="muted" style="margin:0">${solar ? `Platziere ${N} Modulfelder. Kräftigere Farben bekommen mehr Sonne. Grüne Felder mit Bäumen liegen im Schatten, graue sind Schutzgebiet. Ein Modulfeld direkt südlich (unterhalb) eines anderen verschattet dieses.` : `Platziere ${N} Windräder. Dunkleres Grün bedeutet mehr Wind. Der Wind kommt von Westen (links): Hinter jeder Anlage entsteht ein Nachlauf, der die nächsten drei Felder rechts davon bremst.${off ? '' : ' Auf Siedlungen darf nicht gebaut werden.'}`} Jedes Feld Abstand zum Umspannwerk kostet ${Math.round(CABLE_LOSS * 100)} % Kabelverlust.</p>
      <div class="hud"><span>${solar ? 'Süden ↓' : 'Wind → von Westen'}</span><span id="lScore">Wirkungsgrad –</span><span id="lCnt">0/${N}</span></div>
      <div class="laywrap ${solar ? 'sunny' : 'windy'}"><div class="lay" id="lay" style="grid-template-columns:repeat(${C},minmax(0,1fr))"></div></div>
      <div class="legend"><span><i class="lg" style="background:${col(0.75)}"></i>${solar ? 'wenig Sonne' : 'schwacher Wind'}</span><span><i class="lg" style="background:${col(1.1)}"></i>${solar ? 'viel Sonne' : 'starker Wind'}</span>${solar ? '<span><i class="lg" style="background:#7f9a7c"></i>Schatten</span>' : ''}${off ? '' : `<span><i class="lg block"></i>${solar ? 'Schutzgebiet' : 'Siedlung'}</span>`}${solar ? '' : '<span><i class="lg wakeL"></i>Nachlauf</span>'}<span><i class="lg sub"></i>Umspannwerk</span></div>
      <div class="foot"><button class="btn primary big" id="lOk" disabled>Layout übernehmen</button></div>`,
      { locked: true, minigame: true },
    );
    const lay = $('#lay')!;
    const icon = (t: LayoutCell) =>
      t.on
        ? solar
          ? PANEL
          : TURBINE
        : t.kind === 'sub'
          ? SUBSTATION
          : t.kind === 'block'
            ? solar
              ? TREES
              : HOUSE
            : t.kind === 'shade'
              ? TREES
              : '';
    function draw(): void {
      const n = field.placed();
      const wake = field.wake();
      lay.innerHTML = cells
        .map(
          (t, k) =>
            `<button class="lc ${t.kind === 'block' ? 'block' : ''} ${t.kind === 'sub' ? 'sub' : ''} ${t.kind === 'shade' ? 'shade' : ''} ${off ? 'sea' : ''} ${wake.has(t.c + ',' + t.r) && !t.on ? 'wake' : ''} ${t.on ? 'on' : ''}" data-k="${k}" style="--bg:${t.kind === 'shade' ? '#7f9a7c' : col(t.v)}" aria-label="Feld ${t.c + 1},${t.r + 1}${t.on ? ' belegt' : ''}${t.kind === 'block' ? ' gesperrt' : ''}${t.kind === 'sub' ? ' Umspannwerk' : ''}" title="${t.kind === 'sub' ? 'Umspannwerk' : `Kabelverlust ${Math.round((1 - field.cable(t)) * 100)} %`}" ${t.kind === 'block' || t.kind === 'sub' ? 'disabled' : ''}>${icon(t)}</button>`,
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
