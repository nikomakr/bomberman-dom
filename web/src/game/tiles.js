// Draws destroyed blocks as floor by changing only those tiles, so an
// explosion never makes the board rebuild and compare all of its tiles.

let tilesLayer = null;

/**
 * Keeps the board's .tiles element, or null when it is removed.
 *
 * @param {HTMLElement|null} element
 */
export function setTilesLayer(element) {
  tilesLayer = element;
}

/**
 * Shows floor on the given tiles.
 *
 * @param {number[]} indexes - Tile indexes (row * columns + col).
 */
export function drawFloor(indexes) {
  if (!tilesLayer) return;
  for (const index of indexes) {
    const tile = tilesLayer.children[index];
    if (tile) tile.className = "tile tile-floor";
  }
}
