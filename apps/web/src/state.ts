import type { PlayerView, TrickType } from '@power-tycoon/engine';
import type { StoredGame } from './api.js';

/** UI state (legacy `UI`). */
export const UI = {
  tab: 'overview',
  region: 'nd' as PlayerView['sites'][number]['r'],
  sel: null as string | null,
  trick: 'klage' as TrickType,
  target: '',
  confirm: null as string | null,
};

/** Current game: the last view from the server replaces the legacy global `G`. */
export const S = {
  view: null as PlayerView | null,
  game: null as StoredGame | null,
  busy: false,
};

export const $ = <T extends HTMLElement = HTMLElement>(s: string): T | null => document.querySelector<T>(s);
export const RMO = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
