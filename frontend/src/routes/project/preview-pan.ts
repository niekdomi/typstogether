import { makeEventListener } from "@solid-primitives/event-listener";
import { createPointerListeners } from "@solid-primitives/pointer";

// Window after a middle-pan in which to swallow the X11 primary-selection paste.
const PASTE_WINDOW_MS = 300;

/**
 * Middle-drag panning for a scroll container, handling two middle-button quirks:
 * the autoscroll circle (a mousedown default), and on Linux/X11 the
 * primary-selection paste that lands on the focused editor just after a drag.
 * Toggles `cursor-grabbing` while panning. Listeners self-clean, so just call
 * this from a ref.
 */
export function attachPan(el: HTMLElement): void {
  let origin: { x: number; y: number; scrollLeft: number; scrollTop: number } | null = null;
  let lastEnd = 0;

  createPointerListeners({
    target: el,
    pointerTypes: ["mouse"],
    onDown: (e) => {
      if (e.button !== 1) return;
      el.setPointerCapture(e.pointerId);
      el.classList.add("cursor-grabbing");
      origin = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    },
    onMove: (e) => {
      if (!origin) return;
      el.scrollLeft = origin.scrollLeft - (e.clientX - origin.x);
      el.scrollTop = origin.scrollTop - (e.clientY - origin.y);
    },
    onUp: (e) => {
      if (e.button !== 1) return;
      origin = null;
      lastEnd = performance.now();
      el.classList.remove("cursor-grabbing");
    },
  });

  // Suppress the autoscroll circle.
  makeEventListener(el, "mousedown", (e) => {
    if (e.button === 1) {
      e.preventDefault();
    }
  });

  // Swallow the X11 paste, stopImmediatePropagation also blocks CodeMirror's handler.
  makeEventListener(
    globalThis,
    "paste",
    (e) => {
      if (!origin && performance.now() - lastEnd > PASTE_WINDOW_MS) return;
      e.stopImmediatePropagation();
      e.preventDefault();
    },
    { capture: true }
  );
}
