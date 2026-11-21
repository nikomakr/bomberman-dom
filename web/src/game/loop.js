import { createLoop, createFpsMeter } from "/framework/index.js";
import { initEntityPools, updateEntities } from "./entities.js";
import { drawPlayers } from "./players.js";
import { startInput, readInput, stopInput, releaseInput } from "./input.js";
import { updatePrediction } from "./prediction.js";
import { updateEffects } from "./effects.js";
import { store } from "../store.js";

// Shows the frame rate while developing.
const SHOW_FPS = false;

/**
 * Runs once per frame.
 * @param {number} delta - Milliseconds since the previous frame.
 */
function update(delta) {
  // Paused: the loop keeps running, so no frames drop, but nothing moves.
  if (store.getState().paused) {
    releaseInput();
    updateEntities();
    return;
  }

  readInput();
  updatePrediction(delta);

  const now = performance.now();

  drawPlayers(now);
  updateEffects(now);
  updateEntities();
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
  startInput();

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
  stopInput();
  loop.stop();

  if (fpsMeter) {
    fpsMeter.stop();
    fpsMeter = null;
  }
}
