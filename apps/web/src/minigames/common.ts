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

/** Hides the game controls without changing the dialog's height. */
export function hideControls(el: HTMLElement | null): void {
  if (!el) return;
  el.style.visibility = 'hidden';
  el.querySelectorAll('button').forEach((b) => (b.disabled = true));
}

/**
 * Shows the outcome as an overlay on the game board (the dialog keeps its height);
 * "Weiter" closes the dialog and calls `done`.
 */
export function resultBox(ok: boolean, title: string, text: string, done: () => void, label?: string): void {
  const box = document.createElement('div');
  box.className = 'mg-result';
  if (ok) SND.ok();
  else SND.fail();
  box.innerHTML =
    '<div class="mg-result-card"><div class="row"><span class="chip ' +
    (ok ? 'good' : 'bad') +
    '">' +
    (label || (ok ? 'Erfolg' : 'Fehlschlag')) +
    '</span><h3>' +
    title +
    '</h3></div><p class="muted" style="margin:0">' +
    text +
    '</p><div class="foot"><button class="btn primary" id="mgDone">Weiter</button></div></div>';
  $('#mcard .game-wrap, #mcard .laywrap, #mcard .pipegrid')!.appendChild(box);
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
  hideControls($('#mgCtl'));
  setTimeout(() => {
    loop.stop();
    resultBox(ok, title, text, done);
  }, delay);
}
