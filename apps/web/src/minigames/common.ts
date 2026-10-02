/** Building blocks shared by the minigames: canvas setup, animation loop, key handling, result box. */
import { closeModal } from '../modal.js';
import { SND } from '../sound.js';
import { $ } from '../state.js';

/** Canvas of W × H CSS pixels, sharp on high-density screens. */
export function setupCanvas(cv: HTMLCanvasElement, W: number, H: number): CanvasRenderingContext2D {
  const d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * d;
  cv.height = H * d;
  const c = cv.getContext('2d')!;
  c.setTransform(d, 0, 0, d, 0, 0);
  return c;
}

/** Calls `frame(t, dt)` on every animation frame (dt in seconds, at most 0.05) until stopped. */
export function animate(frame: (t: number, dt: number) => void): { stop: () => void; resetClock: () => void } {
  let last = performance.now(),
    raf = 0;
  const tick = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    frame(t, dt);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    stop: () => cancelAnimationFrame(raf),
    resetClock: () => (last = performance.now()),
  };
}

/** Registers window key handlers; the returned function removes them again. */
export function listenKeys(handlers: {
  keydown?: (e: KeyboardEvent) => void;
  keyup?: (e: KeyboardEvent) => void;
}): () => void {
  if (handlers.keydown) window.addEventListener('keydown', handlers.keydown);
  if (handlers.keyup) window.addEventListener('keyup', handlers.keyup);
  return () => {
    if (handlers.keydown) window.removeEventListener('keydown', handlers.keydown);
    if (handlers.keyup) window.removeEventListener('keyup', handlers.keyup);
  };
}

/** Appends the outcome to the open minigame dialog; "Weiter" closes it and calls `done`. */
export function resultBox(ok: boolean, title: string, text: string, done: () => void, label?: string): void {
  const box = document.createElement('div');
  box.className = 'stack';
  if (ok) SND.ok();
  else SND.fail();
  box.innerHTML =
    '<div class="row"><span class="chip ' +
    (ok ? 'good' : 'bad') +
    '">' +
    (label || (ok ? 'Erfolg' : 'Fehlschlag')) +
    '</span><h3>' +
    title +
    '</h3></div><p class="muted" style="margin:0">' +
    text +
    '</p><div class="foot"><button class="btn primary" id="mgDone">Weiter</button></div>';
  $('#mcard')!.appendChild(box);
  const b = $<HTMLButtonElement>('#mgDone')!;
  b.focus();
  b.onclick = () => {
    closeModal();
    done();
  };
}

/**
 * Ends an animated minigame: removes the controls (`#mgCtl`), lets the last frames play for `delay` ms,
 * then stops the animation and shows the result.
 */
export function finishAnimated(
  loop: { stop: () => void },
  delay: number,
  ok: boolean,
  title: string,
  text: string,
  done: () => void,
): void {
  $('#mgCtl')!.remove();
  setTimeout(() => {
    loop.stop();
    resultBox(ok, title, text, done);
  }, delay);
}
