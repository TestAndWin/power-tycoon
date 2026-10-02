/** How players are marked in the UI and the scenes. */
import { S } from './state.js';

/** CSS colour of a player (`--c0` … `--c3`). */
export const playerColor = (id: number): string => `var(--c${id})`;

/** Letter on a player's flag and labels: ★ for the human, else the company's initial. */
export const playerMark = (pid: number): string => {
  const p = S.view?.players[pid];
  if (!p) return '?';
  return p.human ? '★' : (p.name.trim()[0] || '?').toUpperCase();
};
