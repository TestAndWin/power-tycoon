import { registerScenes } from './scene.js';
import { countUp } from './sound.js';
import { $ } from './state.js';

export let modalLocked = false;

export function openModal(html: string, o: { wide?: boolean; locked?: boolean } = {}): void {
  const c = $('#mcard')!;
  c.className = 'mcard' + (o.wide ? ' wide' : '');
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
