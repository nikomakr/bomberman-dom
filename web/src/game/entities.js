// Element pools for everything that moves or appears on the board.
// Elements are created once, then hidden and reused, so no new elements
// are made mid-game. Positions are in tiles, like the server's.

// The tileset class for each kind of entity.
const CLASSES = {
  players: (options) => `tile-player-${options.playerNumber || 1}`,
  bombs: () => "tile-bomb",
  flames: () => "tile-flame",
  powerUps: (options) => `tile-power-${options.kind || "bomb"}`,
};

const pools = { players: [], bombs: [], flames: [], powerUps: [] };
const activeEntities = new Set();
let entitiesContainer = null;

/**
 * Connects the pools to the board's .entities layer. A new board (after a
 * restart) empties the pools, because their elements belonged to the old one.
 *
 * @param {HTMLElement} container - The .entities layer.
 */
export function initEntityPools(container) {
  if (!container || container === entitiesContainer) return;
  entitiesContainer = container;
  activeEntities.clear();
  Object.values(pools).forEach((pool) => {
    pool.length = 0;
  });
}

function createPooledElement() {
  const element = document.createElement('div');
  element.style.visibility = 'hidden';
  entitiesContainer.appendChild(element);
  return element;
}

/**
 * Takes an element from the pool (or makes one) and shows it.
 *
 * @param {'players'|'bombs'|'flames'|'powerUps'} type
 * @param {{ x?: number, y?: number, playerNumber?: number, kind?: string }} options
 * @returns {Object|null} The entity, or null if the type or layer is missing.
 */
export function acquireEntity(type, options = {}) {
  const pool = pools[type];
  if (!pool || !entitiesContainer) return null;

  const element = pool.pop() || createPooledElement();
  element.className = `tile entity ${CLASSES[type](options)}`;
  element.style.visibility = 'visible';

  const entity = { element, type, x: options.x || 0, y: options.y || 0, dirty: true };
  activeEntities.add(entity);
  return entity;
}

/**
 * Hides an entity and puts its element back in the pool.
 *
 * @param {Object} entity
 */
export function releaseEntity(entity) {
  if (!entity || !activeEntities.has(entity)) return;
  activeEntities.delete(entity);
  entity.element.style.visibility = 'hidden';
  pools[entity.type].push(entity.element);
}

/**
 * Sets where an entity should be, in tiles. It is drawn on the next frame.
 *
 * @param {Object} entity
 * @param {number} x
 * @param {number} y
 */
export function setEntityPosition(entity, x, y) {
  if (!entity || !activeEntities.has(entity)) return;
  if (entity.x === x && entity.y === y) return;
  entity.x = x;
  entity.y = y;
  entity.dirty = true;
}

/**
 * Runs once per frame: moves only the entities whose position changed.
 */
export function updateEntities() {
  for (const entity of activeEntities) {
    if (!entity.dirty) continue;
    entity.element.style.transform =
      `translate3d(calc(${entity.x} * var(--tile)), calc(${entity.y} * var(--tile)), 0)`;
    entity.dirty = false;
  }
}