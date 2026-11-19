import { acquireEntity, releaseEntity } from "./entities.js";

import { destroyBlocks } from "../store.js";

const FLAME_DURATION = 500;

const bombs = new Map();
const flames = [];

export function applyEntityChanges(data) {
  // Draw newly placed bombs.
  for (const bomb of data.bombs || []) {
    if (bombs.has(bomb.id)) continue;

    const entity = acquireEntity("bombs", {
      x: bomb.col,
      y: bomb.row,
    });

    if (entity) {
      bombs.set(bomb.id, entity);
    }
  }

  // Remove exploded bombs and draw flames in every affected cell.
  for (const explosion of data.explosions || []) {
    const bomb = bombs.get(explosion.bomb);

    if (bomb) {
      releaseEntity(bomb);
      bombs.delete(explosion.bomb);
    }

    const expiresAt = performance.now() + FLAME_DURATION;

    for (const cell of explosion.cells || []) {
      const entity = acquireEntity("flames", {
        x: cell.col,
        y: cell.row,
      });

      if (entity) {
        flames.push({ entity, expiresAt });
      }
    }
  }

  // Turn every destroyed block into floor in one store update.
  if (data.destroyed && data.destroyed.length > 0) {
    destroyBlocks(data.destroyed);
  }
}

// Called once per animation frame.
export function updateEffects(now) {
  for (let i = flames.length - 1; i >= 0; i--) {
    const flame = flames[i];

    if (now < flame.expiresAt) continue;

    releaseEntity(flame.entity);
    flames.splice(i, 1);
  }
}

// Clear effects when a match ends or the board is replaced.
export function clearEffects() {
  for (const bomb of bombs.values()) {
    releaseEntity(bomb);
  }

  for (const flame of flames) {
    releaseEntity(flame.entity);
  }

  bombs.clear();
  flames.length = 0;
}
