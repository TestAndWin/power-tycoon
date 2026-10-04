import { registerScenes } from './scene/index.js';
import { countUp } from './sound.js';
import { $ } from './state.js';

export let modalLocked = false;

/**
 * Opens the dialog with `html`. A `minigame` dialog has one fixed frame for all minigames (width, minimum
 * height, top edge), so a flow of several minigames does not jump; a following minigame replaces the content
 * of the open dialog.
 */
export function openModal(html: string, o: { wide?: boolean; locked?: boolean; minigame?: boolean } = {}): void {
  const c = $('#mcard')!;
  c.className = 'mcard' + (o.wide || o.minigame ? ' wide' : '') + (o.minigame ? ' mg' : '');
  c.innerHTML = html;
  $('#modal')!.hidden = false;
  modalLocked = !!o.locked;
  const f = c.querySelector<HTMLElement>('input,button');
  f?.focus();
  registerScenes();
  countUp(c);
}

export function closeModal(): void {
  $('#modal')!.hidden = true;
  $('#mcard')!.innerHTML = '';
  modalLocked = false;
}

export const modalOpen = (): boolean => !$('#modal')!.hidden;

let toastT: ReturnType<typeof setTimeout> | undefined;
export function toast(t: string): void {
  const el = $('#toast')!;
  el.textContent = t;
  el.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (el.hidden = true), 2600);
}
