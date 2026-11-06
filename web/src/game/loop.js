import { createLoop, createFpsMeter } from "/framework/index.js";
import { initEntityPools, updateEntities } from "./entities.js";

// Shows the frame rate while developing.
const SHOW_FPS = true;

/**
 * Runs once per frame.
 * @param {number} delta - Milliseconds since the previous frame.
 */
function update(delta) {
  updateEntities(delta);
}

const loop = createLoop(update);
let fpsMeter = null;

/**
 * Starts the game loop and connects the entity pools.
 * @param {HTMLElement} container - The .entities container.
 */
export function startLoop(container) {
  if (!container) {
    console.error("Entity container was not provided.");
    return;
  }

  initEntityPools(container);

  if (loop.isRunning()) return;

  loop.start();

  if (SHOW_FPS) {
    fpsMeter = createFpsMeter({ parent: document.body });
  }
}

/**
 * Stops the game loop and removes the FPS meter.
 */
export function stopLoop() {
  loop.stop();

  if (fpsMeter) {
    fpsMeter.stop();
    fpsMeter = null;
  }
}
EOF;
