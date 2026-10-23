import { createLoop, createFpsMeter } from '/framework/index.js';

// Shows the frame rate while developing; turned off for the final build.
const SHOW_FPS = true;

/**
 * Runs once per frame. Empty for now: movement and drawing come in later tickets.
 *
 * @param {number} delta - Milliseconds since the previous frame.
 */
function update(delta) {}

const loop = createLoop(update);
let fpsMeter = null;

/**
 * Starts the frame loop (and the FPS meter during development).
 */
export function startLoop() {
  if (loop.isRunning()) return;
  loop.start();
  if (SHOW_FPS) fpsMeter = createFpsMeter({ parent: document.body });
}

/**
 * Stops the frame loop and removes the FPS meter.
 */
export function stopLoop() {
  loop.stop();
  if (fpsMeter) {
    fpsMeter.stop();
    fpsMeter = null;
  }
}
