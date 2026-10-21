import { createLoop } from './scheduler.js';

// How often the numbers on screen are refreshed. Updating less often than every frame keeps
// the meter itself from costing much.
const REFRESH_MS = 500;

/**
 * Shows the frames per second and the slowest frame in a corner of the page,
 * to check that an app stays at 60 fps while developing. Not meant for the
 * finished app.
 *
 * @example
 * const meter = createFpsMeter();
 * meter.stop(); // removes it
 *
 * @param {Object} [options]
 * @param {HTMLElement} [options.parent=document.body] - Where to put the meter.
 * @returns {{ stop: Function }} Call `stop()` to remove the meter.
 */
export function createFpsMeter({ parent = document.body } = {}) {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'fixed',
    top: '8px',
    right: '8px',
    zIndex: '2147483647',
    padding: '4px 8px',
    font: '12px/1.4 monospace',
    color: '#fff',
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '4px',
    pointerEvents: 'none',
    contain: 'strict',
    width: '150px',
    height: '18px',
  });
  el.textContent = '… fps';
  parent.appendChild(el);

  let frames = 0;
  let elapsed = 0;
  let slowest = 0;

  const loop = createLoop((delta) => {
    if (delta === 0) return; // first frame, or just back from a hidden tab
    frames += 1;
    elapsed += delta;
    slowest = Math.max(slowest, delta);

    if (elapsed >= REFRESH_MS) {
      el.textContent = `${Math.round((frames * 1000) / elapsed)} fps · slowest ${Math.round(slowest)} ms`;
      frames = 0;
      elapsed = 0;
      slowest = 0;
    }
  });
  loop.start();

  return {
    stop: () => {
      loop.stop();
      el.remove();
    },
  };
}
