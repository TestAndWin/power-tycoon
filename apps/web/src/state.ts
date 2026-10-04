import type { PlantSize, PlayerView, TrickType } from '@power-tycoon/engine';
import type { StoredGame } from './api.js';

/** UI state (legacy `UI`). */
export const UI = {
  tab: 'overview',
  region: 'nd' as PlayerView['sites'][number]['r'],
  sel: null as string | null,
  trick: 'klage' as TrickType,
  /** Plant size for new permits. */
  size: 'std' as PlantSize,
  target: '',
  confirm: null as string | null,
};

/** Current game: the last view from the server replaces the legacy global `G`. */
export const S = {
  view: null as PlayerView | null,
  game: null as StoredGame | null,
  busy: false,
  /** Latest moves of each rival (newest first), collected from the quarterly reports of this session. */
  rivalMoves: {} as Record<number, { d: string; text: string }[]>,
};

export const $ = <T extends HTMLElement = HTMLElement>(s: string): T | null => document.querySelector<T>(s);
export const RMO = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
