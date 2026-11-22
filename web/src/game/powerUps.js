// Draws power-ups on the board as the server spawns them, and removes them once collected or burnt.

import {
  acquireEntity,
  releaseEntity,
} from "./entities.js";

// Server power-up ID -> pooled entity.
const powerUps = new Map();

/**
 * Shows newly spawned power-ups and removes collected or burnt ones.
 *
 * @param {{ powerUps?: Array<{ id: number, kind: string, col: number, row: number }>, collected?: Array<{ id: number, player: number }>, burnt?: number[] }} data
 */
export function updatePowerUps(data) {
  if (!data) return;

  for (const powerUp of data.powerUps || []) {
    if (powerUps.has(powerUp.id)) continue;

    const entity = acquireEntity("powerUps", {
      x: powerUp.col,
      y: powerUp.row,
      kind: powerUp.kind,
    });

    if (entity) powerUps.set(powerUp.id, entity);
  }

  for (const collected of data.collected || []) {
    removePowerUp(collected.id);
  }

  for (const id of data.burnt || []) {
    removePowerUp(id);
  }
}

/**
 * Releases a power-up and returns its element to the pool.
 *
 * @param {number} id
 */
function removePowerUp(id) {
  const entity = powerUps.get(id);
  if (!entity) return;

  releaseEntity(entity);
  powerUps.delete(id);
}

/**
 * Clears all power-ups when a match ends or restarts.
 */
export function clearPowerUps() {
  for (const entity of powerUps.values()) {
    releaseEntity(entity);
  }
  powerUps.clear();
}

